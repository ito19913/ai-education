"use server";

/**
 * 教材体系図 AI 抽出 (Step A、C70 2026-05-28)
 *
 * 学習プラン再設計 grill (2026-05-27) → C69 で C2/C3 撤回確定:
 * 「公的カリキュラム DB ではなく、読み込んだ教材から体系図を作る」
 * = 既存 Phase 5 / Phase 6F 設計が本流復活、本ファイルがその第一歩。
 *
 * Step A 版 (本ファイル): 教材メタ (name / subject / grade / label) のみで
 *   Claude Opus 4.8 が一般的体系図を推測。PDF 自体は読まない。
 * Step C 版 (将来): PDF を base64 で Claude native PDF support に渡す。
 *
 * 葵先生 persona = ティーチング担当、テキスト忠実
 * (= 推測でも教材名に紐づく一般的構成、AI 解釈・取捨選択禁止、
 *  2026-05-25 grill 1 確定 10)
 *
 * 環境変数: AI_EDU_ANTHROPIC_API_KEY (Phase 6 smoke test と共通)
 * モデル: claude-opus-4-8 (Phase 6 smoke test と統一)
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiExtractedNode } from "@/lib/learn/types";

let cachedAokiSystemPrompt: string | null = null;
function getAokiSystemPrompt(): string {
  if (cachedAokiSystemPrompt) return cachedAokiSystemPrompt;

  // web/ から見たプロジェクトルートに PHILOSOPHY.md が置かれている
  const projectRoot = join(process.cwd(), "..");
  const philosophy = readFileSync(
    join(projectRoot, "PHILOSOPHY.md"),
    "utf-8",
  );

  cachedAokiSystemPrompt = `あなたは葵 (あおい) 先生、AI-Education プロジェクトの教科の先生 (= ティーチング担当)。
ゆい先生 (担任、コーチング担当) と協働して小〜中学生・高校生の学習を支援します。

## 役割の境界 (TUTOR-ROLE / 2026-05-25 grill 1)

- あなた = 教科の中身を教える (= ティーチング)、受動的補助 (持ち込まれた教材を一緒に見る、能動的に教える役ではない)
- ゆい先生 = 教えない、引き出す (= コーチング、GROW モデル、親⇄ゆい対話 4 方向)
- 棲み分けを保ち、コーチング領域には踏み込まない

## 教材体系図の抽出 (2026-05-25 grill 1 確定 10/11、2026-05-28 後段 C2 撤回で本流復活)

- **テキスト忠実**: 教材の章立てに従って体系図ノードを抽出、AI 解釈や取捨選択は禁止
- **監修ステップなし**: あなたが抽出したものはそのまま保存される (grill 1 確定 9)、誤りは後でチャットで修正
- 出力 = 体系図 (= ノード階層) + 評価コメント (= 葵の見解) の 2 レイヤだが、本タスクは体系図のみ
- 階層構造を持つツリー (3-4 階層程度) を JSON 配列で出力

## プロジェクトの憲法 (PHILOSOPHY.md)

${philosophy}

## 今回のタスク

ユーザー (= 親 or 子供本人) が教材を登録しました。体系図 (= 章立て、節立て) を抽出してください。
教材の目次・章立てテキストが与えられた場合は、それに**忠実に** (テキスト忠実、AI 解釈・取捨選択禁止) 構造化してください。目次に載っている単元・章・節をそのまま体系図ノードにし、推測で項目を足さないこと。
目次テキストが無い場合のみ、教材名から一般的な構成を推測してください。
出力は **JSON 配列のみ** (説明文・前置き・コードブロック禁止、parse できる pure JSON)。`;

  return cachedAokiSystemPrompt;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  // env 名は `AI_EDU_ANTHROPIC_API_KEY` (Phase 6 smoke test と共通)。
  // 親 harness が `ANTHROPIC_API_KEY=""` を inject する衝突回避のため
  // プロジェクト固有 prefix を使う。
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_EDU_ANTHROPIC_API_KEY is not set in .env.local (C70 教材体系図 AI 抽出).",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export type ExtractMaterialInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  label: string;
  /**
   * 教材 PDF の目次・章立てから抽出したテキスト (段階1-A、2026-06-04)。
   * 与えられた場合はこれに忠実に体系図を作る (推測でなく実構造)。
   * undefined / 空文字なら従来の教材名からの推測にフォールバック。
   */
  tocText?: string;
};

/**
 * 教材メタを Claude Opus 4.8 に渡して体系図 JSON を抽出する Server Action。
 *
 * 戻り値は `Omit<AiExtractedNode, "matchedNodeId">` の配列。
 * matchedNodeId (= 既存体系図ノードへの照合 ID) は呼び出し側で
 * lib/admin/mock-extraction.ts の matchToExistingNodes で付与する。
 */
export async function extractKnowledgeNodesViaClaude(
  input: ExtractMaterialInput,
): Promise<Array<Omit<AiExtractedNode, "matchedNodeId">>> {
  const hasToc = !!(input.tocText && input.tocText.trim().length > 0);
  // 一時診断ログ (段階1-A デバッグ、原因特定後に削除)
  console.log(
    "[extract diag] material:",
    input.materialName,
    "hasToc:",
    hasToc,
    "tocLen:",
    input.tocText?.length ?? 0,
  );
  if (input.tocText) {
    console.log("[extract diag] tocHead:", input.tocText.slice(0, 400));
  }
  const userPrompt = `次の教材の体系図 (= ノード構造) を抽出してください。

教材メタ情報:
- 教材名: ${input.materialName}
- 科目: ${input.subjectName}
- 学年: ${input.gradeLevel}
- 種別: ${input.label}
${
  hasToc
    ? `
## 教材の目次・章立てテキスト (PDF 先頭ページから抽出)
"""
${input.tocText}
"""
`
    : ""
}
要求:
${
  hasToc
    ? `- 上記の目次・章立てに**忠実に**、教材に実際に載っている単元・章・節を構造化する (テキスト忠実、推測で項目を足さない)
- ノード数は目次の実際の単元数に合わせる (大単元 + 中単元 + 小単元の階層、最大 60 程度まで)
- pageRange は目次に書かれたページ番号から埋める (不明なら "p.?-?")`
    : `- 教材名から、その教材の一般的な体系 (= 章立て、節立て) を 3-4 階層で推測抽出 (目次テキストが取れなかったため)
- ノード数は 10-15 個程度 (root 1 + 大単元 3-5 + 中単元 5-9)
- pageRange は概算 (例: "p.42-58"、不明なら "p.?-?")`
}
- 各ノードに以下のフィールドを含める:
  - tempId: 文字列 (例: "ai-1", "ai-2", ...)
  - name: 単元名 (短く、教科書/問題集の章節タイトルになるもの)
  - parentRef: 親の tempId (root ノードは null)
  - description: 1-2 文の概要 (中学生・高校生が読んで分かる平易な日本語)
  - pageRange: ページ範囲 (例: "p.42-58"、不明なら "p.?-?")
  - confidence: 0.85-0.99 の数値
- 出力は **JSON 配列のみ** (説明文・前置き・コードブロック禁止、parse できる pure JSON)

体系図 JSON:`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: hasToc ? 8000 : 4000,
    system: [
      {
        type: "text",
        text: getAokiSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block (C70 extract).");
  }

  // JSON 抽出: 最初の [ から最後の ] までを切り出す
  // (Claude が前後に挨拶や説明を付けても parse できるようにする保険)
  const text = textBlock.text;
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Claude response does not contain JSON array (C70 extract). First 200 chars: ${text.slice(0, 200)}`,
    );
  }
  const jsonOnly = text.slice(start, end + 1);

  const parsed = JSON.parse(jsonOnly) as Array<{
    tempId: string;
    name: string;
    parentRef: string | null;
    description: string;
    pageRange: string;
    confidence: number;
  }>;

  return parsed;
}
