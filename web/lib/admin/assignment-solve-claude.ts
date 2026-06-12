"use server";

/**
 * 宿題・テスト「AI と解く」— 問題ブロック検出 + つまずき検出 (2026-06-11、grill 確定)
 *
 * 体験 (grill 確定): 宿題は紙で解く。アプリは宿題全体を AI と一緒に進める「伴走」。
 * 解答はワークに付いている前提なので、AI が答えを隠す/判定するのではなく、
 * **解き終わった問題を葵が 1 問ずつ全問しっかり解説**し (「合ってた?」は子の自己申告)、
 * 不明点は音声質疑応答。わからない所はこの場で全部把握してセッション末に Issue 化する。
 *
 * 本ファイルは 2 つの Server Action を提供する:
 * 1. buildAssignmentProblemPlan — 宿題 PDF のページ画像から「問題ブロック列」を検出
 *    (ガイド読書 buildGuidedReadingPlan の宿題版。GuidedBlock を流用し、青枠ハイライト・
 *    手動調整・guided_plans 永続化の既存機構にそのまま乗せる)
 * 2. detectAssignmentIssues — 解説セッションの対話履歴から「わかってなさそうな概念」を
 *    抽出 (セッション末にまとめて自動 Issue 登録、1 問ごとに中断しない)
 *
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY。モデル: claude-opus-4-8 (問題の構造理解と
 * つまずき判定は Opus、ガイド読書プランと同じ判断)。
 * 画像は base64 を改行連結 1 文字列で渡す (C85 の規律、配列直渡しの 500 回避)。
 */

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/supabase/require-user";
import type { GuidedBlock } from "@/lib/learn/types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set (assignment-solve-claude).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

// ---------------------------------------------------------------------------
// 1. 問題ブロック検出
// ---------------------------------------------------------------------------

export type AssignmentPlanInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /** 宿題 PDF のページ画像 (改行連結 base64 JPEG)。pageNumbers と同順・同数。 */
  imagesPacked: string;
  /** 各画像に対応する PDF 紙番号 (1-indexed)。 */
  pageNumbers: number[];
};

/**
 * 宿題のページ画像から「解く順の問題ブロック列」を作る。
 * 1 ブロック = 子が 1 回の解説で受け取る単位 (大問 1 つ、または小問のかたまり)。
 * 失敗/空なら [] (呼び出し側は宿題全体 1 ブロックにフォールバック)。
 */
export async function buildAssignmentProblemPlan(
  input: AssignmentPlanInput,
): Promise<GuidedBlock[]> {
  await requireUser();
  const images = input.imagesPacked.split("\n").filter((s) => s.length > 0);
  if (images.length === 0) return [];
  const pageMap = images
    .map((_, i) => `画像${i + 1} = PDF ${input.pageNumbers[i] ?? "?"}ページ`)
    .join(" / ");

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中学生が紙で解いた宿題・テストを、1 問ずつ一緒に答え合わせ・解説していきます。
今回の仕事は、渡された宿題のページ画像を見て、**解説する順の「問題ブロック列」**に
分けることです。

## ブロック分けのルール
- 1 ブロック = 1 回の解説で扱う単位。基本は **大問 1 つ** (例: "大問2")。
  小問が多く独立性が高ければ小問単位 ("大問2 (3)") に割ってよい。
- 問題でない部分 (表紙・名前欄・説明書き・コラム) はブロックにしない。
- 順序は紙面の自然な流れ (上→下、左ページ→右ページ) = 子が解いた順。
- label は子に見せる短い名前。紙面の問題番号をそのまま使う (例: "大問1" "問3" "Q2 (1)〜(4)")。
- 確信が持てない時も最善の区切りを出す (後で子がタップ/枠ドラッグで直せる)。

## 各ブロックの項目
- label: 問題の短い名前 (紙面の番号をそのまま)
- pdfPage: その問題がある PDF 紙番号 (下の対応表の数字)
- positionHint: 紙面での概略位置 (例: "上" "下右")
- bbox: 紙面でのおおよその矩形 {x,y,w,h} (0〜1 の正規化、ページ左上が原点)。分からなければ省略可

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"label":"大問1","pdfPage":1,"positionHint":"上","bbox":{"x":0.05,"y":0.1,"w":0.9,"h":0.3}},
  ...
]`;

  const userPrompt = `宿題・テスト: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

画像とページの対応: ${pageMap}

この宿題を 1 問ずつ解説する順の問題ブロックに分け、JSON 配列で出力してください。JSON 配列のみ。`;

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
    max_tokens: 4000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  // JSON 配列の salvage パース (extract-claude.ts と同じ規律: 出力途中切れを救う)。
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
  let parsed: Array<{
    label?: string;
    pdfPage?: number;
    positionHint?: string;
    bbox?: { x?: number; y?: number; w?: number; h?: number };
  }>;
  try {
    parsed = JSON.parse(jsonOnly);
  } catch {
    return [];
  }

  const validPages = new Set(input.pageNumbers);
  const blocks: GuidedBlock[] = [];
  let seq = 0;
  for (const p of parsed) {
    const label = (p.label ?? "").trim();
    const pdfPage = Number(p.pdfPage);
    if (!label || !Number.isFinite(pdfPage)) continue;
    let bbox: GuidedBlock["bbox"] | undefined;
    if (
      p.bbox &&
      [p.bbox.x, p.bbox.y, p.bbox.w, p.bbox.h].every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    ) {
      bbox = {
        x: p.bbox.x as number,
        y: p.bbox.y as number,
        w: p.bbox.w as number,
        h: p.bbox.h as number,
      };
    }
    seq += 1;
    blocks.push({
      id: `blk-${seq}`,
      label,
      pdfPage: validPages.has(pdfPage) ? pdfPage : input.pageNumbers[0] ?? pdfPage,
      // 問題は全部「本文」扱い (POINT/MEMO の後回し概念は宿題には無い)。
      kind: "example",
      positionHint: p.positionHint?.trim() || undefined,
      supplementary: false,
      bbox,
    });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// 2. つまずき検出 (セッション末にまとめて Issue 化)
// ---------------------------------------------------------------------------

export type DetectedAssignmentIssue = {
  /** 課題の 1 行タイトル (子に見える。例: "受動態の疑問文の語順があやしい") */
  title: string;
  /** つまずいている概念名 (短い名詞。例: "受動態の疑問文") */
  concept: string;
  /** 根拠・詳細 (任意) */
  detail?: string;
};

export type DetectAssignmentIssuesInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /**
   * 解説セッションの対話履歴 (古い順)。「子: …」「葵: …」を改行で連結した 1 文字列
   * (Server Action の配列ガード回避、C85 の規律)。
   */
  historyPacked: string;
};

/**
 * 解説セッションの対話から「わかってなさそうな概念」を抽出する (最大 3 件)。
 * 確信が持てるものだけ。無ければ []。失敗時も [] (動線を止めない)。
 */
export async function detectAssignmentIssues(
  input: DetectAssignmentIssuesInput,
): Promise<DetectedAssignmentIssue[]> {
  await requireUser();
  if (input.historyPacked.trim().length === 0) return [];

  const system = `あなたは葵 (あおい) 先生。中学生と宿題「${input.materialName}」(${input.subjectName}、${input.gradeLevel}) を 1 問ずつ答え合わせ・解説してきました。
これからゆい先生 (担任・コーチング担当) に「この子がわかってなさそうな所」を引き継ぎます。

## 判定のルール
- 対話の中で、子が**間違えた / 何度も聞き返した / 説明してもピンと来ていなかった**概念だけを挙げる。
- 「合ってた」と答えてスムーズに進んだ問題は挙げない。
- 確信が持てるものだけ、**最大 3 件**。無ければ空配列。
- concept は単元・文法事項・論点の短い名詞 (例: "受動態の疑問文" "比例の式" "貸倒引当金")。
- title は子に見える 1 行 (責めない言い方。例: "受動態の疑問文の語順をもう一回見たい")。

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止。無ければ [])
[
  {"title":"...","concept":"...","detail":"..."},
  ...
]`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `今日の解説セッションの対話です:\n\n${input.historyPacked}\n\nわかってなさそうな概念を JSON 配列で出力してください。JSON 配列のみ。`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  const start = text.indexOf("[");
  if (start === -1) return [];
  const end = text.lastIndexOf("]");
  if (end <= start) return [];
  let parsed: Array<{ title?: string; concept?: string; detail?: string }>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  return parsed
    .map((p) => ({
      title: (p.title ?? "").trim(),
      concept: (p.concept ?? "").trim(),
      detail: p.detail?.trim() || undefined,
    }))
    .filter((p) => p.title.length > 0 && p.concept.length > 0)
    .slice(0, 3);
}
