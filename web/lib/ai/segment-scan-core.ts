/**
 * segment-scan-core — スキャン本まとまり区切りの純粋ロジック (C-8、2026-06-13)
 *
 * segment-scan-claude.ts ("use server") の 3 関数から requireUser を抜いた純関数。
 * Server Action (segment-scan-claude.ts) と Cron ワーカー (app/api/cron/segment) の
 * 双方から呼ぶ。★この core は絶対に "use server" を付けないこと★。
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL_OPUS, MODEL_HAIKU } from "@/lib/ai/client";

/** JSON 配列を salvage パース (出力途中切れを救う)。失敗で []。 */
export function salvageJsonArray<T>(text: string): T[] {
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
  }
  try {
    return JSON.parse(jsonOnly) as T[];
  } catch {
    return [];
  }
}

function textOf(res: Anthropic.Message): string {
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

// ============================================================================
// (A) ハイブリッド経路: 目次の体系図ノードを「1 概念」まとまりへ再グルーピング
// ============================================================================

export type TocNodeForGrouping = {
  tempId: string;
  name: string;
  /** "p.3-5" など印刷ページ範囲 (vision 目次抽出 由来) */
  pageRange: string;
};

export type RegroupedSegment = {
  conceptName: string;
  nodeTempIds: string[];
};

export type RegroupTocInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  tocNodes: TocNodeForGrouping[];
};

export async function regroupTocIntoSegmentsCore(
  input: RegroupTocInput,
): Promise<RegroupedSegment[]> {
  if (input.tocNodes.length === 0) return [];

  const nodeList = input.tocNodes
    .map((n) => `- [${n.tempId}] ${n.name}（${n.pageRange}）`)
    .join("\n");

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
あなたの仕事は、教材の目次 (章・節の一覧) を見て、「どこからどこまでが 1 つの話の
まとまり (= 1 概念) か」を見抜いて、目次の項目をまとまりへグルーピングすることです。

## なぜこれが大事か (このアプリの核心価値)
「ここで話が切り替わる」「ここまでが一区切り」を見抜く力は、できる子は持っていて、
つまずく子は持っていません。その区切りを葵先生が肩代わりするのが、まとめノートの土台です。

## グルーピングのルール (grill M1/M9) ★粒度が最重要★
- **1 まとまり = 1 概念**。目次の各項目 (テーマ・節) は、それ自体が 1 つの完結した話題なら
  **そのまま 1 まとまり**にする。むやみに束ねない。
- 複数項目を 1 まとまりに束ねてよいのは、それらが**1 つの説明の細かい断片**で、単独では概念
  として成り立たない場合**だけ**。例:「○○とは」「○○の定義」「○○の具体例」のように、同じ
  1 つの話を分割しただけの連続項目。**別々の話題を「分野が近いから」という理由で束ねるのは禁止**。
- 「第1章」などの大見出し (章) は、それ自体をまとまりにしない。中身のテーマをまとまりにする。
- ★**迷ったら束ねず分ける** (粗いより細かい方を優先)。教科書のテーマ 1 個 ≒ まとまり 1 個が目安★。
- 目次の**全項目**を、いずれかのまとまりに必ず含める (取りこぼし禁止)。
- まとまりは目次の並び順に従い、連続した項目の束にする (順番を飛ばして束ねない)。

## 概念名 (conceptName)
- 1 項目だけのまとまりは、その項目名 (テーマ名) を**ほぼそのまま** conceptName にする。
  総称的な名前 (例:「特定項目の経費取扱い」) に置き換えず、本に載っている言葉を尊重する。

## ページ番号について
- 各項目には印刷ページ番号が付いていますが、**あなたはページ番号を出力しません**。
  まとまりに含める項目の tempId だけを答えてください (ページはシステムが計算します)。

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"conceptName": "概念名 (本の言葉を尊重、短く)", "nodeTempIds": ["ai-2"]},
  ...
]`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

以下はこの教材の目次 (体系図ノード) 一覧です。各行は [tempId] 名前（印刷ページ範囲）。
話の変わり目で「1 概念」のまとまりへグルーピングし、各まとまりに含める tempId を答えてください。
全項目をいずれかのまとまりに必ず入れること。JSON 配列のみ。

----- 目次ここから -----
${nodeList}
----- 目次ここまで -----

まとまり JSON:`;

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    max_tokens: 8000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsed = salvageJsonArray<{
    conceptName?: string;
    nodeTempIds?: unknown;
  }>(textOf(res));

  const out: RegroupedSegment[] = [];
  for (const p of parsed) {
    const conceptName = (p.conceptName ?? "").trim();
    const ids = Array.isArray(p.nodeTempIds)
      ? p.nodeTempIds.filter((x): x is string => typeof x === "string")
      : [];
    if (!conceptName || ids.length === 0) continue;
    out.push({ conceptName, nodeTempIds: ids });
  }
  return out;
}

// ============================================================================
// (A) オフセット較正: ページ画像に印刷されたページ番号 (ノンブル) を読む
// ============================================================================

export async function readPrintedPageNumbersCore(
  imagesPacked: string,
): Promise<Array<number | null>> {
  const images = imagesPacked.split("\n").filter((s) => s.length > 0);
  if (images.length === 0) return [];

  const userPrompt = `各画像は本のページのスキャンです。各ページに**印刷されているページ番号 (ノンブル)** を読み取ってください。
- ページ番号は通常、ページの下部中央・下隅・上隅などにある数字です。
- 表紙・扉・目次など番号が振られていないページは null にしてください。
- ページ番号らしき数字が読み取れない場合も null にしてください。
- 画像の順番どおりに、数値または null の JSON 配列だけを返してください。

例: [null, null, 1, 2, 3]

JSON 配列:`;

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      }),
    ),
    { type: "text", text: userPrompt },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    max_tokens: 1000,
    messages: [{ role: "user", content }],
  });

  const text = textOf(res);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return images.map(() => null);
  let raw: unknown[];
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as unknown[];
  } catch {
    return images.map(() => null);
  }
  return raw.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  });
}

// ============================================================================
// (B) 全ページ vision 経路: ページ画像を順に読み、PDF 紙番号で直接区切る
// ============================================================================

export type ScanVisionInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /** 連続するページ画像 (改行連結 base64 JPEG)。1 枚目が startPdfPage に対応。 */
  imagesPacked: string;
  /** このチャンクの先頭ページの PDF 紙番号 (1-indexed)。 */
  startPdfPage: number;
};

export type ScanVisionSegment = {
  conceptName: string;
  startPdfPage: number;
  endPdfPage: number;
  printPageHint?: string;
};

export async function segmentScanByVisionCore(
  input: ScanVisionInput,
): Promise<ScanVisionSegment[]> {
  const images = input.imagesPacked.split("\n").filter((s) => s.length > 0);
  if (images.length === 0) return [];
  const endPdfPage = input.startPdfPage + images.length - 1;

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
教材の本文ページ画像を読み、「どこからどこまでが 1 つの話のまとまり (= 1 概念) か」を
見抜いて区切るのがあなたの仕事です。

## 区切りのルール (grill M1/M9)
- **1 まとまり = 1 概念** (= 話のまとまり)。章見出しより細かく、「話が切り替わる所」で切る。
- ただし**細かすぎない**: 1 つの説明として完結する単位。例題 1 個ごとには割らない。
- まとまりはページ順に連続し、重ならず並べる。
- ★**学習内容でないページはまとまりに含めない**★: 表紙・扉・はじめに・目次・使い方・
  奥付・索引・著者紹介・広告 など。

## ページ番号の扱い (★最重要・絶対に間違えない★)
- 各ページ画像の**左上に赤いバッジで「PDF-<数字>」**が焼き込まれています (例: PDF-${input.startPdfPage})。
  この赤バッジの数字が、そのページの **PDF 紙番号** です。今回の画像は
  PDF-${input.startPdfPage} 〜 PDF-${endPdfPage} の連続ページです。
- 各まとまりの startPdfPage / endPdfPage は、必ず**この左上の赤バッジの数字**で答えてください。
- ❌ 紙面の隅 (たいてい下部) に印刷された「本のページ番号 (ノンブル)」は使わないこと。
  赤バッジの番号とノンブルは一致しないことが多いです (PDF には表紙や白紙が含まれるため)。
- 本のページ番号 (ノンブル) が読み取れたら printPageHint に入れてください (表示用、任意)。

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"conceptName": "概念名 (短く)", "startPdfPage": ${input.startPdfPage}, "endPdfPage": ${input.startPdfPage + 1}, "printPageHint": "ノンブルがあれば(任意)"},
  ...
]`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

添付画像は連続ページで、各ページ左上の赤バッジ「PDF-数字」が PDF 紙番号です
(PDF-${input.startPdfPage} 〜 PDF-${endPdfPage})。
話の変わり目で概念単位に区切り、各まとまりの startPdfPage / endPdfPage を
**左上の赤バッジの数字**で答えてください。JSON 配列のみ。`;

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      }),
    ),
    { type: "text", text: userPrompt },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 8000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  const parsed = salvageJsonArray<{
    conceptName?: string;
    startPdfPage?: number;
    endPdfPage?: number;
    printPageHint?: string;
  }>(textOf(res));

  const out: ScanVisionSegment[] = [];
  for (const p of parsed) {
    const conceptName = (p.conceptName ?? "").trim();
    const s = Number(p.startPdfPage);
    const e = Number(p.endPdfPage);
    if (!conceptName || !Number.isFinite(s) || !Number.isFinite(e)) continue;
    const start = Math.min(Math.max(Math.floor(s), input.startPdfPage), endPdfPage);
    const end = Math.min(Math.max(Math.floor(e), start), endPdfPage);
    out.push({
      conceptName,
      startPdfPage: start,
      endPdfPage: end,
      printPageHint: p.printPageHint?.trim() || undefined,
    });
  }
  return out;
}
