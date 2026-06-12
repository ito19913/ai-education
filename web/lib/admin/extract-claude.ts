"use server";

/**
 * 教材体系図 AI 抽出 (Step A、C70 2026-05-28)
 *
 * 学習プラン再設計 grill (2026-05-27) → C69 で C2/C3 撤回確定:
 * 「公的カリキュラム DB ではなく、読み込んだ教材から体系図を作る」
 * = 既存 Phase 5 / Phase 6F 設計が本流復活、本ファイルがその第一歩。
 *
 * Step A 版 (本ファイル): 教材メタ (name / subject / grade / label) のみで
 *   Claude Opus 4.8 が一般的体系図を推測。PDF 自体は読まない。
 * Step C 版 (将来): PDF を base64 で Claude native PDF support に渡す。
 *
 * 葵先生 persona = ティーチング担当、テキスト忠実
 * (= 推測でも教材名に紐づく一般的構成、AI 解釈・取捨選択禁止、
 *  2026-05-25 grill 1 確定 10)
 *
 * モデル: claude-opus-4-8 (Phase 6 smoke test と統一)
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL_OPUS } from "@/lib/ai/client";
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";
import { requireUser } from "@/lib/supabase/require-user";
import type { AiExtractedNode } from "@/lib/learn/types";

let cachedAokiSystemPrompt: string | null = null;
function getAokiSystemPrompt(): string {
  if (cachedAokiSystemPrompt) return cachedAokiSystemPrompt;

  cachedAokiSystemPrompt = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
ゆい先生 (担任、コーチング担当) と協働して小〜中学生・高校生の学習を支援します。

## 役割の境界 (TUTOR-ROLE / 2026-05-25 grill 1)

- あなた = 教科の中身を教える (= ティーチング)、受動的補助 (持ち込まれた教材を一緒に見る、能動的に教える役ではない)
- ゆい先生 = 教えない、引き出す (= コーチング、GROW モデル、親⇄ゆい対話 4 方向)
- 棲み分けを保ち、コーチング領域には踏み込まない

## 教材体系図の抽出 (2026-05-25 grill 1 確定 10/11、2026-05-28 後段 C2 撤回で本流復活)

- **テキスト忠実**: 教材の章立てに従って体系図ノードを抽出、AI 解釈や取捨選択は禁止
- **監修ステップなし**: あなたが抽出したものはそのまま保存される (grill 1 確定 9)、誤りは後でチャットで修正
- 出力 = 体系図 (= ノード階層) + 評価コメント (= 葵の見解) の 2 レイヤだが、本タスクは体系図のみ
- 階層構造を持つツリー (3-4 階層程度) を JSON 配列で出力

## プロジェクトの憲法 (PHILOSOPHY.md)

${PHILOSOPHY_MD}

## 今回のタスク

ユーザー (= 親 or 子供本人) が教材を登録しました。体系図 (= 章立て、節立て) を抽出してください。
教材の目次・章立てテキストが与えられた場合は、それに**忠実に** (テキスト忠実、AI 解釈・取捨選択禁止) 構造化してください。目次に載っている単元・章・節をそのまま体系図ノードにし、推測で項目を足さないこと。
目次テキストが無い場合のみ、教材名から一般的な構成を推測してください。
出力は **JSON 配列のみ** (説明文・前置き・コードブロック禁止、parse できる pure JSON)。`;

  return cachedAokiSystemPrompt;
}

export type ExtractMaterialInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  label: string;
  /**
   * 教材 PDF の目次・章立てから抽出したテキスト (段階1-A、2026-06-04)。
   * 与えられた場合はこれに忠実に体系図を作る (推測でなく実構造)。
   * undefined / 空文字なら tocImages → 教材名からの推測の順にフォールバック。
   */
  tocText?: string;
  /**
   * スキャン / 自炊 PDF の目次ページ画像 (base64 JPEG、prefix 無し、C85)。
   * tocText が無くこちらに値があれば、葵が vision で目次を読んで忠実に体系図化する。
   * 真・英文法大全 (186MB スキャン) のような文字レイヤー無し教材への対応。
   *
   * **改行 (\n) 区切りで 1 本の文字列に連結して渡す**こと。Server Action 引数に
   * 大きな配列を直接渡すと Next.js の "Maximum array nesting exceeded" ガードで
   * 500 になるため、配列ではなく 1 文字列にして回避する (C85 で判明)。
   * base64 (A-Za-z0-9+/=) に改行は出現しないので分割は安全。
   */
  tocImagesPacked?: string;
};

/**
 * 教材メタを Claude Opus 4.8 に渡して体系図 JSON を抽出する Server Action。
 *
 * 戻り値は `Omit<AiExtractedNode, "matchedNodeId">` の配列。
 * matchedNodeId (= 既存体系図ノードへの照合 ID) は呼び出し側で
 * lib/admin/mock-extraction.ts の matchToExistingNodes で付与する。
 */
export async function extractKnowledgeNodesViaClaude(
  input: ExtractMaterialInput,
): Promise<Array<Omit<AiExtractedNode, "matchedNodeId">>> {
  await requireUser();
  const hasTocText = !!(input.tocText && input.tocText.trim().length > 0);
  const tocImages = input.tocImagesPacked
    ? input.tocImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];
  const hasTocImages = tocImages.length > 0;
  // 目次の根拠 (テキスト or 画像) があれば忠実抽出、無ければ教材名から推測。
  const hasToc = hasTocText || hasTocImages;

  // 目次の提示部分: 画像なら「画像を見て」、テキストならテキストを埋め込む。
  const tocSection = hasTocImages
    ? `
## 教材 PDF の先頭〜前付けページ画像 (スキャン教材、最大 32 ページ)
添付画像は教材 PDF の先頭ページ群です。表紙・著者紹介・はじめに・**もくじ (目次/CONTENTS)** などが混在しています。
- この中から **「もくじ」のページを探し出して**、そこに載っている単元・章・節を忠実に構造化してください。
- もくじには各単元の右側に**開始ページ番号**が必ず書かれています。1 つ残らず読み取ってください (ページ番号が今回の最重要項目)。
- 「はじめに」などの本文・前書きの散文は構造の根拠にしないでください (あくまで**もくじを最優先**)。
- もくじがどうしても見当たらない場合のみ、各ページの見出しから推定してください。
`
    : hasTocText
      ? `
## 教材の目次・章立てテキスト (PDF 先頭ページから抽出)
"""
${input.tocText}
"""
`
      : "";

  const userPrompt = `次の教材の体系図 (= ノード構造) を抽出してください。

教材メタ情報:
- 教材名: ${input.materialName}
- 科目: ${input.subjectName}
- 学年: ${input.gradeLevel}
- 種別: ${input.label}
${tocSection}
要求:
${
  hasToc
    ? `- 上記の目次・章立てに**忠実に**、教材に実際に載っている単元・章・節を構造化する (テキスト忠実、推測で項目を足さない)
- ノード数は目次の実際の単元数に合わせる (大単元 + 中単元 + 小単元の階層、最大 60 程度まで)
- **ページ番号 (重要)**: 目次では各行の右端に、その単元の**開始ページ番号**が書かれている。これを 1 つ残らず読み取ること。
  - pageRange は「p.{開始ページ}-{次の単元の開始ページ - 1}」の形で埋める (例: ある単元が p.154、次が p.180 なら "p.154-179")
  - その単元が目次の最後で次が分からない場合は "p.154-" (開始のみ) とする
  - 右端の数字がどうしても読み取れない行だけ "p.?-?" にする (安易に "?" にせず、まず読む努力をすること)`
    : `- 教材名から、その教材の一般的な体系 (= 章立て、節立て) を 3-4 階層で推測抽出 (目次テキストが取れなかったため)
- ノード数は 10-15 個程度 (root 1 + 大単元 3-5 + 中単元 5-9)
- pageRange は概算 (例: "p.42-58"、不明なら "p.?-?")`
}
- 各ノードに以下のフィールドを含める:
  - tempId: 文字列 (例: "ai-1", "ai-2", ...)
  - name: 単元名 (短く、教科書/問題集の章節タイトルになるもの)
  - parentRef: 親の tempId (root ノードは null)
  - description: 1-2 文の概要 (中学生・高校生が読んで分かる平易な日本語)
  - pageRange: ページ範囲 (例: "p.42-58"、不明なら "p.?-?")
  - confidence: 0.85-0.99 の数値
- 出力は **JSON 配列のみ** (説明文・前置き・コードブロック禁止、parse できる pure JSON)

体系図 JSON:`;

  // 目次画像があれば画像ブロック → テキストの順で 1 メッセージにまとめる。
  const content: Anthropic.ContentBlockParam[] = [
    ...tocImages.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      }),
    ),
    { type: "text", text: userPrompt },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    // 目次から多数ノード (最大 60) + 各 description を出すと 8000 では足りず途中で
    // JSON が切れる (C85)。余裕を持って 16000 に。不足時は下の salvage で救う。
    max_tokens: hasToc ? 16000 : 4000,
    system: [
      {
        type: "text",
        text: getAokiSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (C70 extract).");
  }

  // JSON 抽出: 最初の [ から JSON 配列を切り出す。
  // ノード数が多いと max_tokens で出力が途中で切れて閉じ ] が無いことがあるため、
  // その場合は最後の完全な } までを救って配列を閉じる (truncation salvage、C85)。
  const text = textBlock.text;
  const start = text.indexOf("[");
  if (start === -1) {
    throw new Error(
      `Claude response does not contain JSON array (C70 extract). First 200 chars: ${text.slice(0, 200)}`,
    );
  }
  const end = text.lastIndexOf("]");
  let jsonOnly: string;
  if (end > start) {
    jsonOnly = text.slice(start, end + 1);
  } else {
    // 閉じ ] が無い = 途中で切れた。最後の完全なオブジェクト } までで配列を閉じる。
    const lastObj = text.lastIndexOf("}");
    if (lastObj <= start) {
      throw new Error(
        `Claude response JSON array is unrecoverable (C70 extract). First 200 chars: ${text.slice(0, 200)}`,
      );
    }
    jsonOnly = text.slice(start, lastObj + 1) + "]";
    console.warn(
      "[extract] 出力が途中で切れたため salvage しました (末尾ノードが欠落した可能性)。",
    );
  }

  const parsed = JSON.parse(jsonOnly) as Array<{
    tempId: string;
    name: string;
    parentRef: string | null;
    description: string;
    pageRange: string;
    confidence: number;
  }>;

  return parsed;
}
