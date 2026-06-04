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
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY (Phase 6 と共通)
 * モデル: claude-opus-4-8
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
教材 PDF の表紙・目次・奥付から抽出されたテキストを読み、その教材のメタ情報を判定します。

## 判定ルール (2026-06-04 grill 確定)

- テキストに明確な根拠がある項目だけ答える。確信が持てない項目は null にする (推測で無理に埋めない)
- 科目・種別・学年は、与えられた選択肢の中から最も適切なものを 1 つだけ選ぶ。どれにも当てはまらない / 1 つに決められない場合は null
- 種別のような固定 3 択は「最も近いもの」を選んでよい (例: 参考書 → テキスト)
- 学年のように、大学受験用で複数学年にまたがる等「1 つに決められない」場合は null にする
- 教材名は表紙の本のタイトルを優先する。奥付から出版社が分かれば末尾に「(出版社名)」を添える。一般名 (「中2 英語 教科書」等) に変換しない

出力は指定された JSON のみ。説明文・前置き・コードブロックは禁止。`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set in .env.local (教材メタ自動検知).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type DetectMetaInput = {
  /** クライアントで抽出した表紙・目次・奥付テキスト */
  coverText: string;
  /** 科目の選択肢 (id を返させる) */
  subjects: { id: string; name: string }[];
  /** 種別の選択肢 (テキスト / 問題集 / 副教材) */
  labels: string[];
  /** 学年の選択肢 (中1〜高3) */
  grades: string[];
};

export type DetectMetaOutput = {
  name: string | null;
  subjectId: string | null;
  label: string | null;
  gradeLevel: string | null;
};

const EMPTY: DetectMetaOutput = {
  name: null,
  subjectId: null,
  label: null,
  gradeLevel: null,
};

export async function detectMaterialMetaViaClaude(
  input: DetectMetaInput,
): Promise<DetectMetaOutput> {
  // テキストが取れていない (スキャン PDF 等) なら呼ばずに全項目 null
  if (!input.coverText.trim()) return EMPTY;

  const subjectList = input.subjects
    .map((s) => `  - id: "${s.id}" / 科目名: "${s.name}"`)
    .join("\n");

  const userPrompt = `次の教材 PDF から抽出した表紙・目次・奥付のテキストを読み、メタ情報を判定してください。

## 抽出テキスト
"""
${input.coverText}
"""

## 選択肢
- 科目 (subjectId には下記の id をそのまま返す。当てはまらなければ null):
${subjectList}
- 種別 (label、いずれか or null): ${input.labels.map((l) => `"${l}"`).join(", ")}
- 学年 (gradeLevel、いずれか or null): ${input.grades.map((g) => `"${g}"`).join(", ")}

## 出力スキーマ (この JSON のみ)
{
  "name": "教材名 (表紙タイトル + 分かれば(出版社)) または null",
  "subjectId": "上記 id のいずれか または null",
  "label": "上記 種別のいずれか または null",
  "gradeLevel": "上記 学年のいずれか または null"
}`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
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
    subjectId: unknown;
    label: unknown;
    gradeLevel: unknown;
  }>;

  // ハルシネーション保険: 選択肢に無い値は null に正規化する
  const name =
    typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
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

  return { name, subjectId, label, gradeLevel };
}
