/**
 * segment-core — まとまり区切り (デジタル本文経路) の純粋ロジック (2026-06-13)
 *
 * segment-claude.ts ("use server") の本体から requireUser を抜いた純関数。
 * Server Action (segment-claude.ts、ユーザー文脈) と Cron ワーカー (app/api/cron/segment、
 * セッション無し) の双方から呼べるよう、ここには "use server" も requireUser も置かない。
 *
 * ★この core は絶対に "use server" を付けないこと★ (付けると再び cookie 文脈を要求する)。
 */

import { getAnthropicClient, MODEL_HAIKU } from "@/lib/ai/client";
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";
import type { ConceptSegment } from "@/lib/learn/types";

export type SegmentFromTextInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /**
   * 本文全ページのテキスト。各ページの先頭に `【pdf:N】` タグ (N = PDF 紙番号) が付いている。
   * extractFullPageTexts (ブラウザ) / packFullPageTextsNode (Node) が生成する改行連結文字列。
   */
  packedText: string;
};

// Claude に渡すテキスト上限 (コスト/速度のため)。
const SEGMENT_TEXT_MAX_CHARS = 160000;

/**
 * デジタル PDF の本文テキストから「まとまり (概念単位)」を区切って ConceptSegment[] を返す。
 * 区切れなければ空配列 (呼び出し側は従来の今ページ要約にフォールバック)。
 */
export async function segmentConceptsFromTextCore(
  input: SegmentFromTextInput,
): Promise<ConceptSegment[]> {
  const body = input.packedText.slice(0, SEGMENT_TEXT_MAX_CHARS).trim();
  if (body.length < 40) return [];

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
あなたの仕事は、教材の本文を読み、「どこからどこまでが 1 つの話のまとまり (= 1 概念) か」を
**生徒の代わりに見抜いて区切る**ことです。

## なぜこれが大事か (このアプリの核心価値)
「ここで話が切り替わる」「ここまでが一区切り」を見抜く力は、できる子は持っていて、
つまずく子は持っていません。その区切りを葵先生が肩代わりするのが、まとめノートの土台です。

## 区切りのルール (grill M1/M9)
- **1 まとまり = 1 概念** (= 話のまとまり)。目次の「章」より細かく、「話が切り替わる所」で切る。
  例: 「時制」という章でも、現在形 / 過去形 / 進行形 / 現在完了 … と話が変わるなら別のまとまり。
- ただし**細かすぎない**: 1 つの説明として完結する単位。例題 1 個ごとには割らない。
- まとまりは**本文の順に連続**し、**重ならず**並べる。
- ★**学習内容そのものでない部分は、まとまりに含めない (出力しない)**★:
  表紙・扉・はじめに・まえがき・目次・本書の使い方・凡例・奥付・索引・著者紹介・広告 など。
  **最初のまとまりは「本文の最初の学習概念」から始めること** (表紙や前付けを最初のまとまりにしない)。
  これらの前付け・後付けページは startPdfPage に含めず、飛ばしてよい。

## ページ番号の扱い (★最重要★)
- 本文は各ページの先頭に **【pdf:N】** が付いています。N は PDF の紙の通し番号です。
- 各まとまりの開始・終了を、**この N (整数) で** 答えてください。本に印刷されたページ番号ではなく、
  必ず 【pdf:N】 の N を使うこと。

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"conceptName": "概念名 (短く)", "startPdfPage": 5, "endPdfPage": 8, "printPageHint": "p.2-5 など本に印刷の番号があれば(任意)"},
  ...
]

## プロジェクトの憲法 (PHILOSOPHY.md)
${PHILOSOPHY_MD}`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

以下はこの教材の本文テキストです (各ページ先頭の 【pdf:N】 が PDF 紙番号)。
話が切り替わる所で概念単位に区切り、各まとまりの startPdfPage / endPdfPage を 【pdf:N】 の N で
答えてください。JSON 配列のみ。

----- 本文ここから -----
${body}
----- 本文ここまで -----

まとまり JSON:`;

  const res = await getAnthropicClient().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 16000,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (segment-core).");
  }

  // JSON 配列の salvage パース (出力途中切れを救う)。
  const text = textBlock.text;
  const start = text.indexOf("[");
  if (start === -1) return [];
  const end = text.lastIndexOf("]");
  let jsonOnly: string;
  if (end > start) {
    jsonOnly = text.slice(start, end + 1);
  } else {
    const lastObj = text.lastIndexOf("}");
    if (lastObj <= start) return [];
    jsonOnly = text.slice(start, lastObj + 1) + "]";
    console.warn("[segment] 出力が途中で切れたため salvage しました。");
  }

  let parsed: Array<{
    conceptName?: string;
    startPdfPage?: number;
    endPdfPage?: number;
    printPageHint?: string;
  }>;
  try {
    parsed = JSON.parse(jsonOnly);
  } catch {
    return [];
  }

  const segments: ConceptSegment[] = [];
  let seq = 0;
  for (const p of parsed) {
    const startPdfPage = Number(p.startPdfPage);
    const endPdfPage = Number(p.endPdfPage);
    const conceptName = (p.conceptName ?? "").trim();
    if (
      !conceptName ||
      !Number.isFinite(startPdfPage) ||
      !Number.isFinite(endPdfPage) ||
      startPdfPage < 1
    ) {
      continue;
    }
    seq += 1;
    segments.push({
      id: `seg-${seq}`,
      conceptName,
      startPdfPage: Math.max(1, Math.floor(startPdfPage)),
      endPdfPage: Math.max(Math.floor(startPdfPage), Math.floor(endPdfPage)),
      source: "digital-text",
      printPageHint: p.printPageHint?.trim() || undefined,
    });
  }
  return segments;
}
