"use server";

/**
 * 「この型で書く」テンプレ提案 Server Action (R11-② 書く型、2026-06-11 grill 確定)
 *
 * grill R11-4/R11-6: AI はそのまとまりの中身 (教材ページ vision) を見て、
 * **使う宣言の並びと番号枠だけ**を空テンプレとして提案する。中身は一切書かない
 * (R3「AI お手本は見せない」と整合 — 宣言は構造の型であり中身ではない)。
 * 子はワンタップで挿入して空欄を自分の言葉で埋める。
 *
 * 記法はピース本文内の固定型 (R11-3): (1) → ①②③ → ・。
 * 失敗時は呼び出し側が buildFallbackTemplate (declarations.ts) にフォールバック。
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (template).");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type TemplateInput = {
  conceptName: string;
  subjectName: string;
  gradeLevel: string;
  /** まとまり範囲のページ画像 (base64 JPEG、改行連結。ResumePane と同形式) */
  pageImagesPacked?: string;
  /** この科目で使える宣言パレット (既定 + 自作)。原則ここから選ばせる */
  declarations: string[];
};

export async function suggestResumeTemplate(
  input: TemplateInput,
): Promise<string> {
  const anthropic = getClient();
  const images = input.pageImagesPacked
    ? input.pageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中高生がこれから「レジュメ」(自分の言葉のまとめ) を書きます。教材ページを見て、
この概念に合う**書く型 (空テンプレ)** だけを提案してください。

## 厳守ルール (最重要)
- **中身は一切書かない**。宣言と番号枠だけの空テンプレ。本人が自分の言葉で埋める。
  (お手本・答え・要約・ヒントになる単語を入れたら違反)
- 宣言は【宣言名】の形。原則、提示された宣言パレットから選ぶ
  (どうしても合う物が無い時だけ短い宣言を新造してよい)
- 番号の型は固定: (1) (2) (3) → その中の列挙は ①②③ → さらに細かい列挙は ・
- 行数は概念の中身に合わせて最小限 (宣言 2〜4 個程度)。列挙の ① の個数も
  教材の実際の項目数に合わせる (分からなければ ①② の 2 つだけ置く)
- 出力は**テンプレ本文のみ**。前置き・説明・コードフェンス無し。

## 出力例 (法律系の例。実際は教材に合わせる)
(1)【定義】

(2)【要件】
①
②
(3)【効果】
`;

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `## 対象
科目: ${input.subjectName} (${input.gradeLevel})
概念 (まとまり): ${input.conceptName}

## 宣言パレット (原則ここから選ぶ)
${input.declarations.map((d) => `【${d}】`).join(" ")}

${images.length > 0 ? "## 教材ページ (この中身に合う型を)" : "(ページ画像なし。概念名と科目から型を推定)"}`,
    },
    ...images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: img },
      }),
    ),
  ];

  const res = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 400,
    system,
    messages: [{ role: "user", content }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  // 念のためコードフェンスを剥がす
  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim() + "\n";
}
