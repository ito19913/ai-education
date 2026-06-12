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
 * aoki-chat-shared.ts と同じく Opus 4.8 + PHILOSOPHY を prompt cache。失敗時は
 * 動線を止めない fallback を呼び出し側で用意する (C56 規律)。
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL_HAIKU, MODEL_OPUS } from "@/lib/ai/client";
import { PHILOSOPHY_MD } from "@/lib/ai/docs.generated";
import { requireUser } from "@/lib/supabase/require-user";

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
  /**
   * 難易度レベル (G-6、周回数で上がる)。0 = 初回 (やさしい言葉)、
   * 1 以上 = 2 周目以降 (より正式な用語を交え、一歩踏み込んで深める)。
   */
  formalLevel?: number;
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
  await requireUser();
  const images = input.pageImagesPacked
    ? input.pageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
中学生・高校生が読んでいる教材の**まとまり (一単元 = 1 概念)** を vision で読み取り、
その**1 つの概念**について「まとめノートに刻む正しい要約」を作ります。

## 厳守ルール
- 添付されたページ画像の**本文に忠実**に。推測で内容を盛らない。
- 出力は「子が覚えるべき正しい内容」。平易だが正確に。子の言葉ではなく、整った要約。
- **複数ページが添付される場合、それは 1 つのまとまり (一単元)。範囲全体を踏まえて
  その単元の中心概念を 1 つにまとめる** (今表示ページ 1 枚だけの要約にしない、M8)。
- 範囲に複数論点があっても、**最も中心的な 1 つ**に絞る。
- **本人との対話がある場合は、本人が引っかかった点・質問・そこで腑に落ちた説明を要約に
  反映する**（＝本人の理解の足跡が入った、その子だけの要約にする）。対話が無ければページ本文のみ。
- 要約は 120〜300 字程度。markdown 可 (強調・箇条書き)。
- **難易度レベル (G-6)**: レベル 0 (初回) はやさしい言葉で要点だけ。レベル 1 以上 (2 周目
  以降) は、同じ概念を**より正式な用語を交えて、一歩踏み込んで深めた**要約にする (前回より
  正確・体系的に。ただし中学生が読める範囲は保つ)。

## 出力フォーマット (JSON のみ、前置き無し)
{"conceptName": "論点名 (短く)", "summary": "正しい要約"}

## プロジェクトの憲法 (PHILOSOPHY.md)
${PHILOSOPHY_MD}`;

  const dialogueText =
    input.dialogue && input.dialogue.length > 0
      ? `\n\n## ここまでの本人と葵の対話 (要約に反映する)\n${input.dialogue
          .map((m) => `${m.role === "user" ? "本人" : "葵"}: ${m.text}`)
          .join("\n")}`
      : "";

  const levelText =
    (input.formalLevel ?? 0) >= 1
      ? "\n難易度: 2 周目以降。前回より正式な用語を交え、一歩踏み込んで深めた要約にすること。"
      : "\n難易度: 初回。やさしい言葉で要点を。";

  const contextText = `教材: ${input.materialName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}${
    input.pageNumber ? ` / ページ: ${input.pageNumber}` : ""
  }${input.currentConceptName ? `\n論点名のヒント (体系図から): ${input.currentConceptName}` : ""}${levelText}${dialogueText}

今添付されているページの中心的な論点を 1 つ選び${input.dialogue && input.dialogue.length > 0 ? "（上の対話で本人が触れた点を踏まえて）" : ""}、まとめノート用の正しい要約を JSON で返してください。`;

  const content: Anthropic.ContentBlockParam[] = [
    // ★cache_control (breakpoint) は 1 リクエスト最大 4 個。画像全部に付けると
    // 4 ページ超のまとまりで 400 invalid_request_error になり添削/要約/ヒントが
    // 全滅する (2026-06-12 レビュー指摘)。プレフィックスマッチで先行画像も
    // まとめてキャッシュされるため、最後の 1 枚だけに付ける。
    ...images.map(
      (b64, i): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
        ...(i === images.length - 1
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      }),
    ),
    { type: "text", text: contextText },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
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
  await requireUser();
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
${PHILOSOPHY_MD}`;

  const user = `論点: ${input.conceptName}
正しい要約 (葵が用意したもの):
${input.aiSummary}

子の説明:
${input.explanation}

この説明で「自分の言葉で要点を理解している」と言えるか判定して JSON で返してください。`;

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
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

// ============================================================================
// reviewResume (レジュメ構想 R2/R3/R7: 子が書いたレジュメを 3 色添削)
// ============================================================================
//
// レジュメ構想では「正しい要約」を AI が見せず (R3)、子が自分の言葉で書いたレジュメを
// 葵が添削する (R2)。葵は**答えを書かず方向だけ示す** (R7): ◎合ってる / △抜け (何を、だが
// 答えは書かない) / ✕違う (指摘のみ)。教材ページ画像を vision で直接読み、子の本文と
// 突き合わせて採点する (別途 summarize は呼ばない = 1 呼び出しで安く)。
// resolved = ✕ (明確な誤り) ゼロ かつ 重大な △ ゼロ で理解済み可 (R8、最終判断は本人)。

export type ResumeReviewPoint = {
  /** ok=◎合ってる / missing=△抜け / wrong=✕違う */
  kind: "ok" | "missing" | "wrong";
  /** 子に見せる短い指摘 (missing/wrong は答えを書かず方向だけ) */
  text: string;
};

export type ResumeReviewResult = {
  points: ResumeReviewPoint[];
  /** ✕ ゼロ & 重大な △ ゼロ = 理解済みにしてよい (R8、最終決定は本人) */
  resolved: boolean;
  /** 1〜2 文の温かい総評 */
  encouragement: string;
};

export type ResumeReviewInput = {
  conceptName: string;
  subjectName: string;
  gradeLevel: string;
  /** まとまり範囲のページ画像 (base64 JPEG、改行連結)。葵が正しさの基準にする */
  pageImagesPacked?: string;
  /** 子が自分の言葉で書いたレジュメ本文 */
  childBody: string;
  /** 周回数レベル (G-6/R 連動)。1 以上 = 2 周目以降はより正確さを求める */
  formalLevel?: number;
};

export async function reviewResume(
  input: ResumeReviewInput,
): Promise<ResumeReviewResult> {
  await requireUser();
  const images = input.pageImagesPacked
    ? input.pageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];

  const strictText =
    (input.formalLevel ?? 0) >= 1
      ? "これは 2 周目以降。前回より正確さ・用語の使い方も少し見てあげて。"
      : "これは初回。芯を捉えていれば表現が拙くても褒めて、致命的な誤り・大きな抜けだけ指摘して。";

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
子どもが、今読んだ教材の**1 つの概念 (まとまり)** を、教科書を閉じて**自分の言葉で要約 (レジュメ)** しました。
あなたの仕事は、そのレジュメを**添削**することです。

## 最重要ルール (レジュメ構想 R3/R7)
- ★**答えを書いてはいけない**★。これは写経を防ぐための関所です。正しい文章を提示したり、
  抜けている内容そのものを書いたりしない。**「何について触れると良いか」という"方向"だけ**示す。
- 添付のページ画像 (教材本文) を正しさの基準にする。推測で盛らない。
- 子の自尊心を守る。できている所をまず認める。

## 3 色フィードバック (points 配列)
- kind "ok" (◎合ってる): 正しく押さえられている点。必ず 1 つ以上、具体的に褒める。
- kind "missing" (△抜け): 重要なのに触れられていない点。「○○についても触れると完璧」のように
  **何を**かは言うが、**答えは書かない**。
- kind "wrong" (✕違う): 事実として誤っている点。「ここは逆かも / もう一度確かめてみて」と
  **指摘だけ**。正解は書かない。
- 細かすぎる粗探しはしない。本質的な点に絞る (合計 2〜5 個程度)。

## 構造も見る (R11-5、レジュメの「見出しと宣言」の型)
このアプリのレジュメは「宣言 (【定義】【要件】等、中身に名前を付けてから書く)」と
「番号の型 ((1)→①→・)」を使う。子が宣言・番号を使っている場合だけ、構造のズレも
△ (missing) で**方向だけ**指摘してよい:
- 宣言と中身のズレ (例: 【要件】の下に効果が書いてある →「【要件】の下の後半、効果の話に
  なってない?」)
- 階層の迷子 (例: ① の続きのはずが別の話 →「②は①の仲間かな? 確かめてみて」)
- 構造の指摘は多くて 1〜2 個。宣言・番号を使っていない本文に「宣言を使え」とは言わない
  (型の強制はしない、書き方は子の自由)。

## resolved (理解済みにしてよいか、R8)
- ✕ (wrong) が 1 つも無く、かつ **重大な** △ (missing) も無い → resolved=true。
- 些細な抜けだけなら resolved=true にしてよい (完璧主義で子を止めない)。
- ★**構造の指摘 (宣言・階層のズレ) は「重大な △」に数えない** = 構造だけが理由で
  resolved=false にしない (関所は中身基準。整形ノルマにしない、R11-5)★
- ${strictText}

## 出力フォーマット (JSON のみ、前置き無し)
{"points":[{"kind":"ok","text":"…"},{"kind":"missing","text":"…"}],"resolved":true,"encouragement":"1〜2文"}

## プロジェクトの憲法 (PHILOSOPHY.md)
${PHILOSOPHY_MD}`;

  const contextText = `概念 (まとまり): ${input.conceptName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

子が書いたレジュメ:
${input.childBody}

添付の教材ページを基準に、上のレジュメを 3 色で添削して JSON で返してください。答えは書かず、方向だけ示すこと。`;

  const content: Anthropic.ContentBlockParam[] = [
    // ★cache_control (breakpoint) は 1 リクエスト最大 4 個。画像全部に付けると
    // 4 ページ超のまとまりで 400 invalid_request_error になり添削/要約/ヒントが
    // 全滅する (2026-06-12 レビュー指摘)。プレフィックスマッチで先行画像も
    // まとめてキャッシュされるため、最後の 1 枚だけに付ける。
    ...images.map(
      (b64, i): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
        ...(i === images.length - 1
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      }),
    ),
    { type: "text", text: contextText },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    max_tokens: 800,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text (reviewResume).");
  }
  const parsed = extractJson(textBlock.text) as Partial<ResumeReviewResult>;
  const validKinds = new Set(["ok", "missing", "wrong"]);
  const points: ResumeReviewPoint[] = Array.isArray(parsed.points)
    ? parsed.points
        .filter(
          (p): p is ResumeReviewPoint =>
            !!p &&
            validKinds.has((p as ResumeReviewPoint).kind) &&
            typeof (p as ResumeReviewPoint).text === "string" &&
            (p as ResumeReviewPoint).text.trim().length > 0,
        )
        .map((p) => ({ kind: p.kind, text: p.text.trim() }))
    : [];
  // 安全側: wrong が無く missing も無ければ resolved。AI の resolved も尊重するが、
  // wrong が 1 つでもあれば必ず false にする (誤りを残して理解済みにしない)。
  const hasWrong = points.some((p) => p.kind === "wrong");
  const resolved = !hasWrong && parsed.resolved !== false;
  return {
    points,
    resolved,
    encouragement:
      (parsed.encouragement && String(parsed.encouragement).trim()) ||
      (resolved
        ? "いいレジュメだね！自分の言葉でよく書けてる。"
        : "あと少し！直すともっと良くなるよ。"),
  };
}

// ============================================================================
// tidyResumeBody (R11-③「整える」、2026-06-11)
//
// 音声入力 (R4) の文字起こしや勢いで書いた本文を、**子の言葉・内容を変えずに**
// 宣言・番号の記法 ((1)→①→・、【宣言】) へ軽く整える。R2 (本文を書くのは子) を
// 壊さないよう、言い換え・要約・加筆は禁止。削ってよいのはフィラーだけ。
// ============================================================================

export type TidyResumeInput = {
  conceptName: string;
  subjectName: string;
  /** 整える対象の本文 (子が書いた / 話した) */
  childBody: string;
  /** この科目の宣言パレット (付けてよい宣言の候補) */
  declarations: string[];
};

export async function tidyResumeBody(input: TidyResumeInput): Promise<string> {
  await requireUser();
  const system = `あなたは葵 (あおい) 先生。子どもが書いた (または話した) レジュメ本文の
**見た目だけ**を整えます。

## 厳守ルール (R2: 本文は子のもの)
- ★**内容・言い回し・語彙を変えない**★。言い換え・要約・加筆・新情報・お手本は禁止。
- 削ってよいのは話し言葉のフィラーだけ (「えーと」「あのー」「なんか」「まあ」等)。
- やること:
  - 句読点と改行を整えて読みやすくする
  - 明らかな列挙は ①②③ の型に (それ以上細かい列挙は ・)
  - 大きな区切りが複数あれば (1)(2)(3) の型に
  - 中身の種類が明らかな塊には【宣言】を行頭に付けてよい (下のパレットから選ぶ。
    迷ったら付けない)
  - 既にある番号・宣言の記法は (1)→①→・、【宣言】の型に正規化する
- 文の順序は変えない (並べ替えは子の判断)。
- 出力は**整えた本文のみ**。前置き・説明・コードフェンス無し。`;

  const res = await getAnthropicClient().messages.create({
    // 整えるは「言い換え禁止・記法の正規化だけ」の機械的タスクなので Haiku で十分
    // (レビュー Phase 2-④、2026-06-12)。失敗しても子が見て直せる。
    model: MODEL_HAIKU,
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: `概念: ${input.conceptName} / 科目: ${input.subjectName}
宣言パレット: ${input.declarations.map((d) => `【${d}】`).join(" ")}

整える本文:
${input.childBody}`,
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text (tidyResumeBody).");
  }
  const text = textBlock.text.trim();
  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

// ============================================================================
// getResumeHint (R4「詰まったらヒントちょうだい」、2026-06-08)
// ============================================================================

export type ResumeHintInput = {
  conceptName: string;
  subjectName: string;
  gradeLevel: string;
  /** まとまり範囲のページ画像 (base64 JPEG、改行連結)。葵がヒントの根拠にする */
  pageImagesPacked?: string;
  /** 子が今書いている途中のレジュメ本文 (空のこともある) */
  childBody: string;
  /**
   * ヒントの段階 (1 から)。押すごとに +1。回を重ねるほど少し具体的にするが、
   * ★答えそのものは最後まで言わない★。
   */
  hintLevel: number;
  /** これまでに出したヒント (同じことを繰り返さないため) */
  previousHints?: string[];
};

/**
 * 詰まった子に「答えは言わず糸口だけ」を 1 つ返す (R4、小出し)。
 * hintLevel が上がるほど少しずつ具体的にするが、答え (正しい要約そのもの) は言わない。
 */
export async function getResumeHint(input: ResumeHintInput): Promise<string> {
  await requireUser();
  const images = input.pageImagesPacked
    ? input.pageImagesPacked.split("\n").filter((s) => s.length > 0)
    : [];

  const level = Math.max(1, input.hintLevel);
  const depthText =
    level <= 1
      ? "まずは**考える方向**か、**問いかけ**を 1 つだけ。例『この概念、何と何を比べてる?』"
      : level === 2
        ? "前より**少し具体的に**。どの部分・どの言葉に注目すると良いかを 1 つ。"
        : "かなり具体的に近づけてよい (どこを見れば答えが分かるか) が、★答えの文そのものは絶対に書かない★。";

  const prevText =
    input.previousHints && input.previousHints.length > 0
      ? `\n\nこれまでに出したヒント (繰り返さない):\n${input.previousHints
          .map((h, i) => `${i + 1}. ${h}`)
          .join("\n")}`
      : "";

  const system = `あなたは葵 (あおい) 先生、AI-Education の教科の先生 (ティーチング担当)。
子どもが、今読んだ教材の**1 つの概念 (まとまり)** を自分の言葉でレジュメにまとめようとして、
**詰まっています**。あなたの仕事は「ヒント」を出すこと。

## 最重要ルール (レジュメ構想 R3/R4)
- ★**答えを言ってはいけない**★。正しい要約そのものや、穴埋めの答えを書かない。
  あくまで**子が自分で気づくための糸口**を出す。これは写経を防ぐ関所。
- 添付のページ画像 (教材本文) を根拠にする。推測で盛らない。
- **短く、1 つだけ**。問いかけ・着眼点・たとえ、のどれかで。長く説明しない。
- 中学生に話すように、やさしく温かく。1〜2 文。

## 今回のヒントの濃さ
${depthText}

## 出力
ヒントの文だけを返す (JSON 不要、前置き・「ヒント:」等のラベルも不要)。`;

  const contextText = `概念 (まとまり): ${input.conceptName} / 科目: ${input.subjectName} / 学年: ${input.gradeLevel}

子が今書いている途中のレジュメ (空かもしれない):
${input.childBody || "(まだ何も書けていない)"}${prevText}

添付の教材ページを根拠に、答えは言わず、糸口を 1 つだけ短く返してください。`;

  const content: Anthropic.ContentBlockParam[] = [
    // ★cache_control (breakpoint) は 1 リクエスト最大 4 個。画像全部に付けると
    // 4 ページ超のまとまりで 400 invalid_request_error になり添削/要約/ヒントが
    // 全滅する (2026-06-12 レビュー指摘)。プレフィックスマッチで先行画像も
    // まとめてキャッシュされるため、最後の 1 枚だけに付ける。
    ...images.map(
      (b64, i): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
        ...(i === images.length - 1
          ? { cache_control: { type: "ephemeral" as const } }
          : {}),
      }),
    ),
    { type: "text", text: contextText },
  ];

  const res = await getAnthropicClient().messages.create({
    model: MODEL_OPUS,
    max_tokens: 300,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text (getResumeHint).");
  }
  return textBlock.text.trim();
}
