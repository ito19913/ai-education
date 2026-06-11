"use server";

/**
 * レジュメ冊アウトラインの AI 下書き Server Action (R11-①、2026-06-11 grill 確定)
 *
 * grill R11-2: アウトライン (Ⅰ・1 の章立て) は AI が教材の構造から下書きを提案し、
 * 子は言葉で直す。ピース (NoteEntry) の一括配置もここで行う (R11-7: 既存ピースは
 * AI が一括配置提案、再入力なし)。
 *
 * - 新規下書き: 教材構造 (まとまり名の列) + 既存ピース一覧 → 章立て + 全ピース配置
 * - 言葉で修正: currentOutline + 子の指示 (「Ⅰ と Ⅱ を入れ替えて」等) → 最小限の変更
 *
 * note-gate-claude.ts と同じ Opus 4.8 + 失敗時は呼び出し側フォールバック (C56 規律)。
 * 出力の検証・章 id 採番は client 側 (lib/notes/resume-outline.ts sanitizeOutline)。
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.AI_EDU_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (outline).");
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** JSON ブロックを本文から抽出 (```json フェンスや前置きを許容)。 */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json object found");
  return JSON.parse(raw.slice(start, end + 1));
}

export type OutlineDraftInput = {
  subjectName: string;
  bookName: string;
  /** この冊のピース全量 (配置対象) */
  entries: Array<{
    id: string;
    conceptName: string;
    /** "p.42-45" 等 (順序のヒント) */
    pageRange?: string;
    materialName?: string;
  }>;
  /** 科目の教材構造 (章立ての土台ヒント)。教材名 + まとまり名の列 */
  materialStructures: Array<{
    materialName: string;
    segmentNames: string[];
  }>;
  /** 言葉で修正する時の現アウトライン (新規下書きでは undefined) */
  currentOutline?: Array<{ title: string; entryIds: string[] }>;
  /** 子の修正指示 (例: 「Ⅰ と Ⅱ を入れ替えて」「時制の章を 2 つに分けて」) */
  instruction?: string;
};

export type OutlineDraftOutput = {
  sections: Array<{ title: string; entryIds: string[] }>;
};

export async function buildResumeOutlineViaClaude(
  input: OutlineDraftInput,
): Promise<OutlineDraftOutput> {
  const anthropic = getClient();

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中高生の「レジュメ」(自分でまとめる 1 冊のノート) の**アウトライン (章立て)** を作ります。

## レジュメの見出しルール (このアプリの固定の型)
- 章 = ローマ数字 Ⅰ レベル。章の配下に概念ピース (= アラビア数字 1 レベル) が並ぶ。
- あなたが決めるのは「章のタイトル」と「各ピースがどの章に・どの順で入るか」だけ。
- 章は科目の体系に沿って 2〜8 個程度。タイトルは短く (例: 「文型と文の要素」「時制」)。
- **全ピースを必ずどこか 1 つの章に 1 回だけ配置する** (落とさない・重複させない)。
- 章内の並びは学習の体系順 (教材構造・ページ順をヒントに)。
- 教材構造はヒント。ピースが少ない段階では大きめの章でまとめ、細かく割りすぎない。
- まだピースの無い領域のために空の章を先回りで作るのは最小限に (多くて 1〜2 個)。

## 修正指示がある場合
- 現在のアウトラインを土台に、**指示に沿った最小限の変更**だけを行う
  (指示と無関係な章・並びは変えない)。

## 出力フォーマット (JSON のみ、前置き・説明文なし)
{"sections": [{"title": "章タイトル", "entryIds": ["ピースid", ...]}, ...]}`;

  const entriesText = input.entries
    .map(
      (e) =>
        `- id: ${e.id} / 概念: ${e.conceptName}` +
        (e.materialName ? ` / 教材: ${e.materialName}` : "") +
        (e.pageRange ? ` / ${e.pageRange}` : ""),
    )
    .join("\n");

  const structuresText =
    input.materialStructures.length > 0
      ? input.materialStructures
          .map(
            (m) =>
              `### ${m.materialName}\n${m.segmentNames.map((s) => `- ${s}`).join("\n")}`,
          )
          .join("\n\n")
      : "(教材構造の情報なし)";

  const currentText = input.currentOutline
    ? `\n\n## 現在のアウトライン (これを土台に最小限の変更)\n${JSON.stringify(
        { sections: input.currentOutline },
        null,
        2,
      )}`
    : "";

  const instructionText = input.instruction
    ? `\n\n## 本人の修正指示\n${input.instruction}`
    : "";

  const userMessage = `## 冊
科目: ${input.subjectName} / 冊名: ${input.bookName}

## この冊のピース (全部をどこかの章に 1 回ずつ配置する)
${entriesText || "(まだピースなし)"}

## 教材の構造 (章立てのヒント)
${structuresText}${currentText}${instructionText}`;

  const res = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return extractJson(text) as OutlineDraftOutput;
}

// ============================================================================
// suggestOutlinePlacement — 刻む時の配置提案 (R11-②、grill R11-2)
//
// 新しいピースを刻んだ瞬間に「どの章 (Ⅰ) に入るか」だけを判定する軽い分類。
// 高頻度 (ピースごと) なので Haiku 4.5 (segment-claude と同じコスト判断)。
// どの章にも合わなければ -1 (→ 未整理に残し、「作り直す」で再配置)。
// ============================================================================

export type PlacementInput = {
  subjectName: string;
  conceptName: string;
  /** 子の本文の先頭 (文脈ヒント、~200 字) */
  bodyHead?: string;
  /** 章タイトル一覧 (表示順) */
  sectionTitles: string[];
};

export type PlacementOutput = {
  /** 入れる章の index (0 始まり)。合う章が無ければ -1 */
  sectionIndex: number;
};

export async function suggestOutlinePlacement(
  input: PlacementInput,
): Promise<PlacementOutput> {
  const anthropic = getClient();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 100,
    system: `学習ノートの新しい概念を、既存の章のどれに入れるか判定します。
出力は JSON のみ: {"sectionIndex": 数値}。0 始まりの index。どの章にも明らかに合わなければ -1。`,
    messages: [
      {
        role: "user",
        content: `科目: ${input.subjectName}
新しい概念: ${input.conceptName}
${input.bodyHead ? `本文の冒頭: ${input.bodyHead}` : ""}

章一覧:
${input.sectionTitles.map((t, i) => `${i}: ${t}`).join("\n")}`,
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = extractJson(text) as { sectionIndex?: unknown };
  const idx =
    typeof parsed.sectionIndex === "number" ? parsed.sectionIndex : -1;
  return {
    sectionIndex:
      Number.isInteger(idx) && idx >= 0 && idx < input.sectionTitles.length
        ? idx
        : -1,
  };
}
