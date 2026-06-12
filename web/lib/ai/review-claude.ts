"use server";

/**
 * 葵先生 教材評価コメント AI 生成 (B3、C73 系列、2026-06-04)
 *
 * 2026-05-25 grill 1 確定 11: 葵の教材出力 = 体系図 (テキスト忠実) +
 * 評価コメント (葵の見解、coverage / difficulty / fit / notes) の 2 レイヤ。
 *
 * 本ファイルは「評価コメント」レイヤを Claude Opus 4.8 で生成する Server Action。
 * 体系図抽出 (C70 extract-claude.ts) と対になる実装。
 *
 * 注意: MaterialDetailView から useEffect 経由で呼ばれるため、教材切替ごとに
 * 5-15 秒の Claude 呼び出しが発生する。Phase 7 永続化時に MaterialReview を
 * DB に保存して 1 回だけ呼ぶ設計に切替予定。
 */

import { getAnthropicClient, MODEL_OPUS } from "@/lib/ai/client";
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";
import { requireUser } from "@/lib/supabase/require-user";

let cachedSystemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
ゆい先生 (担任、コーチング担当) と協働して小〜中学生・高校生の学習を支援します。

## 役割の境界 (TUTOR-ROLE / 2026-05-25 grill 1)

- あなた = 教科の中身を教える (= ティーチング)、受動的補助 (持ち込まれた教材を一緒に見る、能動的に教える役ではない)
- ゆい先生 = 教えない、引き出す (= コーチング、GROW モデル、親⇄ゆい対話 4 方向)

## 教材評価コメント (2026-05-25 grill 1 確定 11)

葵生成の 2 レイヤのうち、本タスクは **評価コメント** (= 葵の見解):
- coverage (網羅性): その教材が何をカバーしているか、骨格を掴むのに使えるかの所感
- difficulty (難易度): 難易度の評価、解説の丁寧さ、演習量
- fit (フィット感): 今の学習段階に合っているか、どう使うのが効果的か
- notes (使い方のヒント): 具体的な使い方アドバイス 3-4 件 (= 各 1-2 文)

各項目は **温かく具体的** に、中学生・高校生・親が読んで「なるほど」と思える内容に。
評論家口調ではなく、葵が教科の先生として「一緒に見てくれる」スタンス。

## プロジェクトの憲法 (PHILOSOPHY.md)

${PHILOSOPHY_MD}

## 出力形式

JSON で以下のスキーマを厳密に守ること:
{
  "coverage": "1-3 文の文字列",
  "difficulty": "1-3 文の文字列",
  "fit": "1-3 文の文字列",
  "notes": ["文字列", "文字列", "文字列"]
}

説明文・前置き・コードブロック禁止、parse できる pure JSON のみ。`;
  return cachedSystemPrompt;
}

export type MaterialReviewInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  label: string;
};

export type MaterialReviewOutput = {
  coverage: string;
  difficulty: string;
  fit: string;
  notes: string[];
};

export async function generateMaterialReviewViaClaude(
  input: MaterialReviewInput,
): Promise<MaterialReviewOutput> {
  await requireUser();
  const userMessage = `次の教材についての評価コメント (体系図とは別の 2 レイヤ目、葵先生の見解) を生成してください。

教材メタ情報:
- 教材名: ${input.materialName}
- 科目: ${input.subjectName}
- 学年: ${input.gradeLevel}
- 種別: ${input.label}

要求:
- coverage (網羅性、1-3 文)
- difficulty (難易度、1-3 文)
- fit (フィット感、1-3 文)
- notes (使い方のヒント、3-4 件、各 1-2 文)

出力は **JSON のみ** (説明文・前置き・コードブロック禁止):`;

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (B3 review).");
  }

  // JSON 抽出: 最初の { から最後の } まで切り出す保険
  const text = textBlock.text;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Claude response does not contain JSON object (B3 review). First 200 chars: ${text.slice(0, 200)}`,
    );
  }
  const jsonOnly = text.slice(start, end + 1);
  return JSON.parse(jsonOnly) as MaterialReviewOutput;
}
