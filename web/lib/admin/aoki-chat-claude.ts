"use server";

/**
 * 葵 chat AI 応答 (B1、C75 2026-06-04)
 *
 * 2026-05-25 grill 1 確定 12: 教材ごとに葵 chat 独立スレッド。
 * 本ファイルは Server Action として、教材 + ノード文脈 + chat 履歴 +
 * ユーザー発話を Claude Opus 4.8 に渡して葵応答を生成する。
 *
 * 永続化なし (本セッション内のみ in-memory)、Phase 7 で Supabase に保存予定。
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const projectRoot = join(process.cwd(), "..");
  const philosophy = readFileSync(
    join(projectRoot, "PHILOSOPHY.md"),
    "utf-8",
  );
  cachedSystemPrompt = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
ゆい先生 (担任、コーチング担当) と協働して中学生・高校生の学習を支援します。

## 役割の境界

- あなた = 教科の中身を教える、教材の中身について本人と対話する (= ティーチング)
- ゆい先生 = 教えない、引き出す (= コーチング担当)、棲み分け維持
- 受動的補助 (A7): 持ち込まれた教材について「一緒に見る」、能動的に押し付けない

## chat 応答のスタイル

- 中学生・高校生に分かりやすい平易な言葉
- 「答えだけ示す」のではなく、本人が考える余地を残す (= ファインマン式、説明させる)
- 教材の文脈を尊重 (教材外の話には踏み込みすぎない)
- ノードが指定されている場合はそのノードに集中、教材全体の場合は俯瞰
- 応答は 200-400 字程度、長すぎず短すぎず
- 「分かんない」や「もう少し詳しく」を引き出す質問返しも自然に
- markdown 使って OK (見出し / 強調 / 番号付きリスト)

## プロジェクトの憲法 (PHILOSOPHY.md)

${philosophy}

## 応答ルール

ユーザーの発話に対して葵先生として応答してください。応答テキストのみ、前置きなしで返してください。`;
  return cachedSystemPrompt;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set in .env.local (B1 葵 chat).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type AokiChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type AokiChatInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /** 選択中のノード名 (= ノードリストから選んで focus 中)、null なら教材全体 */
  focusNodeName: string | null;
  /** 過去の対話履歴 (古い順) */
  history: AokiChatMessage[];
  /** ユーザーの今回の発話 */
  userMessage: string;
  /**
   * 段階1-C「一緒にめくって読む」: ユーザーが今読書ビューで開いているページ画像
   * (base64 JPEG、prefix 無し、改行連結。現在は 1 枚)。あれば葵は vision でその
   * ページの本文を読んでその場で教える。配列でなく文字列なのは Server Action の
   * array-nesting ガード回避 (C85 と同じ)。
   */
  currentPageImagesPacked?: string;
  /** 読書ビューで今開いている物理ページ番号 (1-indexed)。文脈提示用。 */
  currentPageNumber?: number;
};

export async function respondViaAokiChat(input: AokiChatInput): Promise<string> {
  const messages: Anthropic.MessageParam[] = [];

  // 段階1-C: 読書ビューで今開いているページ画像 (改行連結を分割)
  const pageImages = input.currentPageImagesPacked
    ? input.currentPageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];
  const isReading = pageImages.length > 0;

  // 文脈ヘッダ (= 最初の user message として教材文脈を提示)
  const contextHeader = `## 教材文脈
- 教材名: ${input.materialName}
- 科目: ${input.subjectName}
- 学年: ${input.gradeLevel}
${input.focusNodeName ? `- 今フォーカスしているノード: ${input.focusNodeName}` : "- フォーカス: 教材全体"}
${
  isReading
    ? `- 今、本人はこの教材の PDF を画面で開いて、あなたと一緒に読んでいます${input.currentPageNumber ? ` (今開いているのは ${input.currentPageNumber} ページ目)` : ""}。各メッセージには「今開いているページの画像」が添付されます。その画像の本文を読み取り、ページの内容に即して一緒に読み解いて教えてください (推測でなく、写っている本文に基づく)。`
    : ""
}

以下、本人との対話が続きます。`;

  messages.push({ role: "user", content: contextHeader });
  messages.push({
    role: "assistant",
    content: isReading
      ? `了解しました。${input.materialName} を一緒に開いて、今のページを見ながら進めますね。`
      : `了解しました。${input.materialName} について、${input.focusNodeName ? `特に「${input.focusNodeName}」を中心に` : "教材全体を俯瞰しつつ"} 質問に答えていきますね。`,
  });

  // 過去履歴を追加
  for (const m of input.history) {
    messages.push({ role: m.role, content: m.text });
  }

  // 今回の user message。読書中なら現在ページ画像を先頭に付ける (画像 block → テキスト)。
  if (isReading) {
    const content: Anthropic.ContentBlockParam[] = [
      // ★cache_control (breakpoint) は 1 リクエスト最大 4 個。画像全部に付けると
      // オリエン等で 12 枚送る経路が 400 invalid_request_error になる
      // (2026-06-12 レビュー指摘)。最後の 1 枚だけに付ける (プレフィックス
      // マッチで先行画像もまとめてキャッシュされる)。
      ...pageImages.map(
        (b64, i): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: b64 },
          ...(i === pageImages.length - 1
            ? { cache_control: { type: "ephemeral" as const } }
            : {}),
        }),
      ),
      { type: "text", text: input.userMessage },
    ];
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: input.userMessage });
  }

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (B1 aoki-chat).");
  }
  return textBlock.text;
}
