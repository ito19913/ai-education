"use server";

/**
 * AI 主導ガイド読書 — ブロックプラン生成 (G-1〜G-7、2026-06-06、grill 確定)
 *
 * まとまり (ConceptSegment) を開いた時、葵 (Opus vision) がその全ページを 1 回解析し、
 * 「教える順序のブロック列」(GuidedBlock[]) に分ける。葵が一区切りずつ解説し、子は
 * 受け身に「次へ/もっと簡単に/質問」で進む。
 *
 * 設計の肝 (grill G-3): この区切り・順序は **"正解"でなく"下書きの提案"**。子がいつでも
 * 言葉/タップで直せるし、最終ノートは概念 (まとまり) 単位なので道中の順序ミスは結果を
 * 汚さない。だから「AI を完璧にする」でなく「AI は外さない前提で作らない」。
 *
 * - G-4: POINT/MEMO/補足 (supplementary) は本文を流した後に回す。
 * - G-5: ページまたぎは内容で繋ぐ。
 * - bbox (0-1) は視覚ハイライト用 (G-B)。vision 推定なので不正確な場合あり、任意。
 *
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY。モデル: claude-opus-4-8 (ブロック種類・位置・
 * POINT/MEMO 判定の構造理解は Opus が信頼でき、実測で良好だったため)。
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
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (guided-reading-claude).");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type GuidedPlanInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /** このまとまりの概念名 (例: "留保金課税") */
  conceptName: string;
  /** まとまりのページ画像 (改行連結 base64 JPEG)。pageNumbers と同じ順序・同じ枚数。 */
  imagesPacked: string;
  /** 各画像に対応する PDF 紙番号 (1-indexed)。images と同順。 */
  pageNumbers: number[];
};

const VALID_KINDS: GuidedBlock["kind"][] = [
  "heading",
  "body",
  "table",
  "figure",
  "point",
  "memo",
  "supplement",
  "example",
];

/**
 * まとまりのページ画像から「教える順序のブロック列」を作る。
 * 失敗/空なら [] (呼び出し側は従来のまとまり全体オリエンにフォールバック)。
 */
export async function buildGuidedReadingPlan(
  input: GuidedPlanInput,
): Promise<GuidedBlock[]> {
  await requireUser();
  const images = input.imagesPacked.split("\n").filter((s) => s.length > 0);
  if (images.length === 0) return [];
  // 画像 ↔ PDF 紙番号の対応を本文に明示 (画像1=p.X …)。
  const pageMap = images
    .map((_, i) => `画像${i + 1} = PDF ${input.pageNumbers[i] ?? "?"}ページ`)
    .join(" / ");

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中学生に、受け身でも分かるように、教材を**一区切りずつ**教えます。
今回の仕事は、渡された「1 まとまり (1 概念)」のページ画像を見て、
**教える順序のブロック列**に分けることです。

## ブロック分けのルール (grill G-3/G-4/G-5)
- 画面に見える「意味のかたまり」をブロックにする (見出し / 本文の段落 / 表 / 図 / 例題 /
  POINT / MEMO / 補足)。細かすぎず、1 つの説明単位で。
- **教える順序**で並べる。基本は紙面の自然な流れ (上→下、左ページ→右ページ)。
- ★**POINT・MEMO・補足は本文とは別もの**。本文を一通り教えた**後**に回す (supplementary=true)。
  これらは「要点のまとめ」「背景の補足」で、先に出すと本筋が止まるため。
- 表・図は、それを参照している本文のすぐ後に置くと分かりやすい。
- ページをまたいでも、内容のつながりで順序を決めてよい。
- 確信が持てない時も、最善の順序を出す (後で子が直せるので完璧でなくてよい)。

## 各ブロックの項目
- label: 短いブロック名 (例: "■租税回避の防止" / "判定の表" / "POINT")
- pdfPage: そのブロックがある PDF 紙番号 (下の対応表の数字)
- kind: heading | body | table | figure | point | memo | supplement | example のどれか
- positionHint: 紙面での概略位置 (例: "上中" "下右")
- supplementary: POINT/MEMO/補足なら true、本文なら false
- bbox: 紙面でのおおよその矩形 {x,y,w,h} (0〜1 の正規化、ページ左上が原点)。分からなければ省略可

## 出力フォーマット (JSON 配列のみ、前置き・コードブロック禁止)
[
  {"label":"...","pdfPage":131,"kind":"heading","positionHint":"上","supplementary":false,"bbox":{"x":0.1,"y":0.05,"w":0.8,"h":0.1}},
  ...
]`;

  const userPrompt = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}
まとまり (今回教える 1 概念): 「${input.conceptName}」

画像とページの対応: ${pageMap}

このまとまりを中学生に教える順序でブロックに分け、JSON 配列で出力してください。
POINT・MEMO・補足は本文の後に回す (supplementary=true)。JSON 配列のみ。`;

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
    kind?: string;
    positionHint?: string;
    supplementary?: boolean;
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
    const kind = (VALID_KINDS as string[]).includes(p.kind ?? "")
      ? (p.kind as GuidedBlock["kind"])
      : "body";
    const supplementary =
      p.supplementary === true || kind === "point" || kind === "memo" || kind === "supplement";
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
      // vision が範囲外ページを返したら、まとまりの最初のページに寄せる (安全側)。
      pdfPage: validPages.has(pdfPage) ? pdfPage : input.pageNumbers[0] ?? pdfPage,
      kind,
      positionHint: p.positionHint?.trim() || undefined,
      supplementary,
      bbox,
    });
  }

  // G-4 安全網: AI が順序を間違えても、補足 (POINT/MEMO 等) は必ず本文の後ろへ。
  // 各グループ内の相対順序は AI の提案を保つ (stable partition)。
  const body = blocks.filter((b) => !b.supplementary);
  const supp = blocks.filter((b) => b.supplementary);
  return [...body, ...supp];
}
