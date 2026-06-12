"use server";

/**
 * 教材メタ自動検知 (PDF 表紙テキスト → 4 項目判定、2026-06-04)
 *
 * grill (2026-06-04) 確定: 教材登録ウィザード Step1 の UX 反転。
 * PDF をアップロードしたら AI が 教材名 / 科目 / 種別 / 学年 を自動検知してフォームを埋める。
 *
 * 本ファイルは Server Action として、クライアント側 (pdf-extract-text.ts) で抽出した
 * 表紙・目次・奥付のテキストと、選択肢リスト (科目 / 種別 / 学年) を Claude Opus 4.8 に渡し、
 * 4 項目の判定結果を返す。
 *
 * grill 確定ポイント:
 * - 確信のある項目だけ埋め、決め打ちできない項目 (大学受験参考書の学年など) は null
 * - 種別など固定 3 択は最も近いものを選ぶ (参考書 → テキスト)
 * - 教材名は表紙タイトル優先 + 奥付から出版社が分かれば「(出版社名)」を添える
 *
 * メタ判定は分類タスクなので PHILOSOPHY 全文は system に埋め込まない (軽量・高速)。
 * AI の返した値が選択肢に無ければ呼び出し前に null へ正規化する (ハルシネーション保険)。
 *
 * モデル: claude-opus-4-8
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL_HAIKU } from "@/lib/ai/client";
import { requireUser } from "@/lib/supabase/require-user";

const SYSTEM_PROMPT = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
教材 PDF の表紙・目次・奥付 (テキスト、またはスキャン PDF ではページ画像) を読み、その教材のメタ情報を判定します。

## 判定ルール (2026-06-04 grill 確定)

- テキストに明確な根拠がある項目だけ答える。確信が持てない項目は null にする (推測で無理に埋めない)
- 科目・種別・学年は、与えられた選択肢の中から最も適切なものを 1 つだけ選ぶ。どれにも当てはまらない / 1 つに決められない場合は null
- 種別のような固定 3 択は「最も近いもの」を選んでよい (例: 参考書 → テキスト)
- 学年のように、大学受験用で複数学年にまたがる等「1 つに決められない」場合は null にする
- 教材名は表紙の本のタイトルを優先する。奥付から出版社が分かれば末尾に「(出版社名)」を添える。一般名 (「中2 英語 教科書」等) に変換しない
- 出版社 (publisher) は奥付・表紙・背表紙の発行元から判定する。会社名のみ (例「光村図書」「TAC出版」)。分からなければ null
- 著者 (author) は表紙・奥付の著者名・編者名から判定する (例「山田太郎」「○○編集部」)。分からなければ null

出力は指定された JSON のみ。説明文・前置き・コードブロックは禁止。`;

export type DetectMetaInput = {
  /** クライアントで抽出した表紙・目次・奥付テキスト (デジタル PDF) */
  coverText: string;
  /**
   * スキャン / 自炊 PDF の表紙ページ画像 (base64 JPEG、prefix 無し、C85)。
   * coverText が空でこちらに値があれば、葵が vision で表紙を読んでメタ判定する。
   * 改行 (\n) 区切りで 1 文字列に連結して渡す (Server Action の配列ガード回避、extract-claude と同様)。
   */
  coverImagesPacked?: string;
  /** 科目の選択肢 (id を返させる) */
  subjects: { id: string; name: string }[];
  /** 種別の選択肢 (テキスト / 問題集 / 副教材) */
  labels: string[];
  /** 学年の選択肢 (中1〜高3) */
  grades: string[];
};

export type DetectMetaOutput = {
  name: string | null;
  publisher: string | null;
  author: string | null;
  subjectId: string | null;
  label: string | null;
  gradeLevel: string | null;
};

const EMPTY: DetectMetaOutput = {
  name: null,
  publisher: null,
  author: null,
  subjectId: null,
  label: null,
  gradeLevel: null,
};

export async function detectMaterialMetaViaClaude(
  input: DetectMetaInput,
): Promise<DetectMetaOutput> {
  await requireUser();
  const coverImages = input.coverImagesPacked
    ? input.coverImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];
  const hasImages = coverImages.length > 0;
  // テキストも画像も無い (抽出失敗) なら呼ばずに全項目 null
  if (!input.coverText.trim() && !hasImages) return EMPTY;

  const subjectList = input.subjects
    .map((s) => `  - id: "${s.id}" / 科目名: "${s.name}"`)
    .join("\n");

  // スキャン PDF は表紙画像、デジタル PDF は抽出テキストを根拠に判定させる。
  const sourceSection = hasImages
    ? `## 教材の表紙ページ画像
(以下の画像が教材 PDF の表紙・最初のページです。タイトル・出版社・対象学年などを読み取ってください)`
    : `## 抽出テキスト
"""
${input.coverText}
"""`;

  const userPrompt = `次の教材 PDF の表紙から、メタ情報を判定してください。

${sourceSection}

## 選択肢
- 科目 (subjectId には下記の id をそのまま返す。当てはまらなければ null):
${subjectList}
- 種別 (label、いずれか or null): ${input.labels.map((l) => `"${l}"`).join(", ")}
- 学年 (gradeLevel、いずれか or null): ${input.grades.map((g) => `"${g}"`).join(", ")}

## 出力スキーマ (この JSON のみ)
{
  "name": "教材名 (表紙タイトル + 分かれば(出版社)) または null",
  "publisher": "出版社名 または null",
  "author": "著者名・編者名 または null",
  "subjectId": "上記 id のいずれか または null",
  "label": "上記 種別のいずれか または null",
  "gradeLevel": "上記 学年のいずれか または null"
}`;

  // 画像があれば画像ブロック → テキストの順で 1 メッセージにまとめる。
  const content: Anthropic.ContentBlockParam[] = [
    ...coverImages.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      }),
    ),
    { type: "text", text: userPrompt },
  ];

  const res = await getAnthropicClient().messages.create({
    // メタ検知は子に見えない分類タスクなので Haiku で十分 (レビュー Phase 2-④)。
    // 検知結果は登録ダイアログで人間が確認・修正できる。
    model: MODEL_HAIKU,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (detect-meta).");
  }

  const text = textBlock.text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Claude response does not contain JSON object (detect-meta). First 200 chars: ${text.slice(0, 200)}`,
    );
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<{
    name: unknown;
    publisher: unknown;
    author: unknown;
    subjectId: unknown;
    label: unknown;
    gradeLevel: unknown;
  }>;

  // ハルシネーション保険: 選択肢に無い値は null に正規化する
  const name =
    typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : null;
  // 出版社・著者は自由記述 (選択肢無し)。空文字だけ null に落とす。
  const publisher =
    typeof parsed.publisher === "string" && parsed.publisher.trim().length > 0
      ? parsed.publisher.trim()
      : null;
  const author =
    typeof parsed.author === "string" && parsed.author.trim().length > 0
      ? parsed.author.trim()
      : null;
  const subjectId =
    typeof parsed.subjectId === "string" &&
    input.subjects.some((s) => s.id === parsed.subjectId)
      ? parsed.subjectId
      : null;
  const label =
    typeof parsed.label === "string" && input.labels.includes(parsed.label)
      ? parsed.label
      : null;
  const gradeLevel =
    typeof parsed.gradeLevel === "string" &&
    input.grades.includes(parsed.gradeLevel)
      ? parsed.gradeLevel
      : null;

  return { name, publisher, author, subjectId, label, gradeLevel };
}
