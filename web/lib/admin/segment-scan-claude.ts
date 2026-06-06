"use server";

/**
 * C-8: スキャン本 (文字レイヤー無しの自炊 PDF) の まとまり (一単元=1概念) 区切り
 * Server Actions 群 (2026-06-06、grill 確定)。
 *
 * デジタル本は segment-claude.ts が本文テキストを読んで PDF 紙番号で直接区切れる (M3)。
 * しかしスキャン本は getTextContent が空 (hasTextLayer:false) のため、その経路が使えない。
 * C-8 は 2 経路でスキャン本を救う:
 *
 *  (A) ハイブリッド経路 (目次あり): C85 の目次 vision で既に抽出済みの体系図ノード
 *      (extractedNodes、印刷ページ番号付き) を土台に、AI が「1 概念」へ再グルーピング
 *      し、印刷ページ→PDF 紙番号のオフセットを 2 点較正で解決して ConceptSegment を作る。
 *      → 本ファイルの regroupTocIntoSegments + readPrintedPageNumbers が担当。
 *  (B) 全ページ vision 経路 (目次なし): ページ画像を順に vision で読み、PDF 紙番号で
 *      直接区切る (オフセット問題なし、M3 と同思想)。→ segmentScanByVision が担当。
 *
 * クライアント側のオーケストレーション (pdf.js でページ描画 → 本 Server Action 呼び出し
 * → ConceptSegment[] 構築) は lib/admin/scan-segment-builder.ts。
 *
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY (他の AI 呼び出しと共通)。
 * 画像配列は Server Action 引数に直接渡すと "Maximum array nesting exceeded" になるため、
 * base64 を改行連結 1 文字列で渡す (C85 の規律)。base64 に改行は出ないので分割は安全。
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (segment-scan-claude).");
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** JSON 配列を salvage パース (出力途中切れを救う、segment-claude と同規律)。失敗で []。 */
function salvageJsonArray<T>(text: string): T[] {
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
  /** 体系図ノードの tempId (グルーピング結果はこれで本文ページを引く) */
  tempId: string;
  name: string;
  /** "p.3-5" など印刷ページ範囲 (vision 目次抽出 由来) */
  pageRange: string;
};

export type RegroupedSegment = {
  conceptName: string;
  /** このまとまりに含める体系図ノードの tempId 群 (ページ範囲はこれから決定的に算出) */
  nodeTempIds: string[];
};

export type RegroupTocInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  tocNodes: TocNodeForGrouping[];
};

/**
 * 目次の体系図ノード一覧 (印刷ページ付き) を、AI が「1 概念 = 話の変わり目」の
 * まとまりへ再グルーピングする。粒度判断は segment-claude (デジタル本文経路) と統一。
 *
 * ★ページ番号は AI に出させない★ (誤写=ズレの原因)。AI には「どのノードが同じ
 * まとまりか」だけ決めさせ、ページ範囲は呼び出し側がノードの pageRange から決定的に
 * 計算する。
 *
 * グルーピングできなければ [] (呼び出し側は vision 経路 or 等倍フォールバック)。
 */
export async function regroupTocIntoSegments(
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

  const res = await getClient().messages.create({
    // 粒度・概念名の質が体験を左右する核心ステップのため Opus を使う (ito19 さん指示、
    // Haiku では別テーマを過剰マージして「荒すぎ」になった)。目次テキストだけの軽い入力。
    model: "claude-opus-4-8",
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

/**
 * ページ画像群 (改行連結 base64 JPEG) を vision に渡し、各ページに**印刷された**
 * ページ番号 (ノンブル) を読み取る。読めなければ null。画像の順に配列で返す。
 *
 * 用途: 印刷ページ→PDF 紙番号オフセットの較正。PDF の先頭から数ページを渡すと、
 * 前付け (番号なし) は null、本文ページは数値を返すので、(PDF 紙番号 − 印刷番号) で
 * オフセットが求まる。少数ページの精密読みなので Opus を使う (オフセット誤り = 全
 * まとまりがズレるクリティカル処理のため精度優先)。
 */
export async function readPrintedPageNumbers(
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

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1000,
    messages: [{ role: "user", content }],
  });

  // 配列要素は number か null。salvage は数値/null 混在でも JSON.parse できる。
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

/**
 * 連続ページ画像のチャンクを vision で読み、まとまり (1 概念) を **PDF 紙番号で直接**
 * 区切って返す。目次が無いスキャン本用 (オフセット問題なし)。
 * チャンク分割・チャンク跨ぎマージは呼び出し側 (scan-segment-builder) が担う。
 */
export async function segmentScanByVision(
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

## ページ番号の扱い (★最重要★)
- 渡された画像は PDF の **${input.startPdfPage} ページ目から ${endPdfPage} ページ目** の
  連続スキャンです (1 枚目 = ${input.startPdfPage} ページ目)。
- 各まとまりの開始/終了は、この **PDF 紙番号** (= 画像の通し番号、${input.startPdfPage}〜${endPdfPage})
  で答えてください。紙面に印刷された番号ではなく、PDF の通し番号です。

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"conceptName": "概念名 (短く)", "startPdfPage": ${input.startPdfPage}, "endPdfPage": ${input.startPdfPage + 1}, "printPageHint": "紙面の番号があれば(任意)"},
  ...
]`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

添付画像は PDF の ${input.startPdfPage}〜${endPdfPage} ページ目の連続スキャンです。
話の変わり目で概念単位に区切り、各まとまりの startPdfPage / endPdfPage を PDF 紙番号
(${input.startPdfPage}〜${endPdfPage}) で答えてください。JSON 配列のみ。`;

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      }),
    ),
    { type: "text", text: userPrompt },
  ];

  const res = await getClient().messages.create({
    model: "claude-haiku-4-5",
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
    // チャンク範囲にクランプ (vision が範囲外を返すことがある)。
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
