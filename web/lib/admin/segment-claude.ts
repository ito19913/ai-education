"use server";

/**
 * まとまり (一単元 = 1 概念) 区切り AI 抽出 (M1-M10、2026-06-06、grill 確定)
 *
 * 現状ノートは「今表示中ページ要約」になり「一単元 (まとまり) 要約」になっていない。
 * → 教材を登録時にバックグラウンドで全書を読み、「話が切り替わる所」で概念単位に区切る (M1/M4)。
 *
 * ★M3 のキモ★: 本文テキストの各ページに `【pdf:N】` (N = PDF 紙番号 = PDF page index、
 * 1-indexed) を付けて渡し、Claude に「区切りの開始/終了をその N で答えて」と指示する。
 * → 出力 startPdfPage/endPdfPage は **最初から PDF 紙番号**。本に印刷されたページ番号 (= 目次
 * 由来の AiExtractedNode.pageRange) とは別物なので、印刷⇄PDF のオフセット問題が原理的に消える。
 *
 * 本ファイル = デジタル PDF (文字レイヤーあり) 経路 = vision 不要・激安・速い (M4 デジタル段)。
 * スキャン PDF (文字レイヤー無し) の低解像度 vision 区切りは後段 (C-8、別 Server Action 予定)。
 *
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY / モデル: claude-opus-4-8 (プロジェクト統一)。
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConceptSegment } from "@/lib/learn/types";

let cachedPhilosophy: string | null = null;
function getPhilosophy(): string {
  if (cachedPhilosophy) return cachedPhilosophy;
  const projectRoot = join(process.cwd(), "..");
  cachedPhilosophy = readFileSync(join(projectRoot, "PHILOSOPHY.md"), "utf-8");
  return cachedPhilosophy;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (segment-claude).");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type SegmentFromTextInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /**
   * 本文全ページのテキスト。各ページの先頭に `【pdf:N】` タグ (N = PDF 紙番号) が付いている。
   * extractFullPageTexts (pdf-extract-text.ts) が生成する改行連結文字列。
   */
  packedText: string;
};

// Claude に渡すテキスト上限 (Opus は大容量だがコスト/速度のため上限を設ける)。
const SEGMENT_TEXT_MAX_CHARS = 160000;

/**
 * デジタル PDF の本文テキストから「まとまり (概念単位)」を区切って ConceptSegment[] を返す。
 * 区切れなければ空配列 (呼び出し側は従来の今ページ要約にフォールバック)。
 */
export async function segmentConceptsFromText(
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
- まとまりは**本文の順に連続**し、**重ならず・隙間なく**全体を覆うのが理想 (前付け・索引など本文でない
  部分は無理に概念にしなくてよい)。

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
${getPhilosophy()}`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

以下はこの教材の本文テキストです (各ページ先頭の 【pdf:N】 が PDF 紙番号)。
話が切り替わる所で概念単位に区切り、各まとまりの startPdfPage / endPdfPage を 【pdf:N】 の N で
答えてください。JSON 配列のみ。

----- 本文ここから -----
${body}
----- 本文ここまで -----

まとまり JSON:`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (segment-claude).");
  }

  // JSON 配列の salvage パース (extract-claude.ts と同じ規律: 出力途中切れを救う)。
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
