"use server";

/**
 * まとめノート 能動ゲートの Server Actions (N9① MVP、2026-06-05)
 *
 * grill N3 確定: ノートの中身は AI が作る「正しい要約」。ただし刻む前に能動ゲート
 * (子に自分の言葉で説明させる)。受け身の「はい」では刻まない。
 *
 * - summarizeConceptForNote: 今読んでいるページ (画像) を vision で読み、論点名 +
 *   正しい要約を返す (N5 論点認定の最小実装 = AI がページから概念を判定)。
 * - judgeExplanation: 子の説明が「自分の言葉で要点を言えているか」を判定 (能動ゲート)。
 *
 * aoki-chat-claude.ts と同じく Opus 4.8 + PHILOSOPHY を prompt cache。失敗時は
 * 動線を止めない fallback を呼び出し側で用意する (C56 規律)。
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    throw new Error("AI_EDU_ANTHROPIC_API_KEY is not set (note-gate).");
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

// ============================================================================
// summarizeConceptForNote
// ============================================================================

export type SummarizeInput = {
  materialName: string;
  subjectName: string;
  gradeLevel: string;
  /** findConceptForPage の結果 (あれば概念名のヒントに使う、無ければ AI が命名) */
  currentConceptName?: string | null;
  /** 今表示中ページ画像 (base64 JPEG、prefix 無し、改行連結。aoki-chat と同形式) */
  pageImagesPacked?: string;
  /** 物理ページ番号 (文脈提示用) */
  pageNumber?: number;
  /**
   * ここまでの本人と葵の対話 (古い順)。あれば、本人が引っかかった点・質問・
   * そこで明確になったことを要約に反映する (= オリジナルノート、grill Q2)。
   */
  dialogue?: { role: "user" | "assistant"; text: string }[];
};

export type SummarizeOutput = {
  /** AI が認定した論点名 (N5) */
  conceptName: string;
  /** ノートに刻む正しい要約 (N3、子が覚えるべき内容) */
  summary: string;
};

export async function summarizeConceptForNote(
  input: SummarizeInput,
): Promise<SummarizeOutput> {
  const images = input.pageImagesPacked
    ? input.pageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中学生・高校生が読んでいる教材ページを vision で読み取り、その**1 つの論点**について
「まとめノートに刻む正しい要約」を作ります。

## 厳守ルール
- 添付されたページ画像の**本文に忠実**に。推測で内容を盛らない。
- 出力は「子が覚えるべき正しい内容」。平易だが正確に。子の言葉ではなく、整った要約。
- 1 ページに複数論点があれば、**最も中心的な 1 つ**に絞る。
- **本人との対話がある場合は、本人が引っかかった点・質問・そこで腑に落ちた説明を要約に
  反映する**（＝本人の理解の足跡が入った、その子だけの要約にする）。対話が無ければページ本文のみ。
- 要約は 120〜300 字程度。markdown 可 (強調・箇条書き)。

## 出力フォーマット (JSON のみ、前置き無し)
{"conceptName": "論点名 (短く)", "summary": "正しい要約"}

## プロジェクトの憲法 (PHILOSOPHY.md)
${getPhilosophy()}`;

  const dialogueText =
    input.dialogue && input.dialogue.length > 0
      ? `\n\n## ここまでの本人と葵の対話 (要約に反映する)\n${input.dialogue
          .map((m) => `${m.role === "user" ? "本人" : "葵"}: ${m.text}`)
          .join("\n")}`
      : "";

  const contextText = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}${
    input.pageNumber ? ` / ページ: ${input.pageNumber}` : ""
  }${input.currentConceptName ? `\n論点名のヒント (体系図から): ${input.currentConceptName}` : ""}${dialogueText}

今添付されているページの中心的な論点を 1 つ選び${input.dialogue && input.dialogue.length > 0 ? "（上の対話で本人が触れた点を踏まえて）" : ""}、まとめノート用の正しい要約を JSON で返してください。`;

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
        cache_control: { type: "ephemeral" },
      }),
    ),
    { type: "text", text: contextText },
  ];

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 800,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text (summarizeConceptForNote).");
  }
  const parsed = extractJson(textBlock.text) as Partial<SummarizeOutput>;
  const conceptName =
    (parsed.conceptName && String(parsed.conceptName).trim()) ||
    input.currentConceptName ||
    "この論点";
  const summary = (parsed.summary && String(parsed.summary).trim()) || "";
  if (!summary) throw new Error("empty summary (summarizeConceptForNote).");
  return { conceptName, summary };
}

// ============================================================================
// judgeExplanation (能動ゲート)
// ============================================================================

export type JudgeInput = {
  conceptName: string;
  aiSummary: string;
  /** 子が自分の言葉で説明したテキスト */
  explanation: string;
};

export type JudgeOutput = {
  /** 自分の言葉で要点を言えていれば true (= ノートに刻んでよい) */
  passed: boolean;
  /** 子への 1〜2 文の温かいフィードバック (通過/未通過どちらも) */
  feedback: string;
};

export async function judgeExplanation(
  input: JudgeInput,
): Promise<JudgeOutput> {
  const system = `あなたは葵 (あおい) 先生。子が「ある論点を自分の言葉で説明」したものを読み、
「本当に理解しているか (= まとめノートに刻んでよいか)」を判定します。

## 判定の軸 (grill N3: 分かった気を排除する関所)
- **要点を自分の言葉で**言えていれば通過 (passed=true)。丸暗記の復唱や、用語を並べただけ、
  「分かった」だけの空回答は通過させない。
- 厳しすぎても子が嫌になる。**要点の芯を捉えていれば、表現が拙くても通過**させてよい。
- 明らかに的外れ・空・「わからない」なら未通過 (passed=false)。

## フィードバック
- 通過: 良かった点を一言 + 温かく。
- 未通過: どこを補えばよいか 1 つだけ、責めずに。

## 出力フォーマット (JSON のみ、前置き無し)
{"passed": true/false, "feedback": "1〜2文"}

## プロジェクトの憲法 (PHILOSOPHY.md)
${getPhilosophy()}`;

  const user = `論点: ${input.conceptName}
正しい要約 (葵が用意したもの):
${input.aiSummary}

子の説明:
${input.explanation}

この説明で「自分の言葉で要点を理解している」と言えるか判定して JSON で返してください。`;

  const res = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 400,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: user }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text (judgeExplanation).");
  }
  const parsed = extractJson(textBlock.text) as Partial<JudgeOutput>;
  return {
    passed: parsed.passed === true,
    feedback:
      (parsed.feedback && String(parsed.feedback).trim()) ||
      (parsed.passed ? "いい説明だね！" : "もう少し自分の言葉で言ってみよう。"),
  };
}
