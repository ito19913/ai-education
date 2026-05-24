/**
 * 担任の先生「ゆい」さん（mock）の人格と、scripted conversation。
 *
 * Phase 3 拡張で **コーチング エージェント** として再定義した版:
 *   - GROW モデル意識（Goal / Reality / Options / Will）
 *   - 質問中心、未来志向、観察ベースの承認
 *   - 朝の振り返り 5 セクション（昨日 / 学校 / 気分 / 疑問 / 計画）を主動線に
 *   - 「掘り起こし」: 疑問が出たら 1 ターン深掘り → 課題化 + 葵への申し送り（mock 演出）
 *   - 「教えない」: 教科の中身には絶対踏み込まない（葵先生に振る）
 *
 * Phase 6 で Claude API に置き換え。本ファイルは設計のリファレンス + デモ用。
 */
import type {
  Issue,
  ReflectionLog,
  TutorHandoff,
  TutorMessage,
  TutorRightPaneAction,
  TutorThread,
  TutorTopic,
} from "./types";
import {
  MOCK_HANDOFFS,
  MOCK_ISSUES,
  MOCK_REFLECTION_LOGS,
  MOCK_SCHEDULE_TODAY,
} from "./mock-data";
import { searchTutorThreads } from "./tutor-thread-storage";

/**
 * 担任の persona（Claude API 接続時の system prompt の元になる）。
 *
 * 設計原則は ARCHITECTURE.md の「ゆい先生 = コーチング エージェント」セクション参照。
 * 教えない（教科の中身は絶対 NG、葵先生に振る）、引き出す。
 * 発話の大半は質問。未来志向。承認は観察ベース。GROW を意識的に回す。
 * 武田塾「説明させる」+ ファインマン式を技法として使う（教えるんじゃなく、引き出す）。
 */
export const TUTOR_PERSONA = {
  name: "ゆい",
  description:
    "20代前半の女性チューター。東進ハイスクールのチューター + 武田塾のコーチング講師を融合したスタイル。教えるのは科目の先生（葵先生）に完全に任せ、自分は『教えない、引き出す』を徹底する純粋コーチ。GROW モデル（Goal/Reality/Options/Will）を意識して質問中心に対話し、過去原因の追及より「次どうする?」の未来志向。承認は評価でなく観察ベース。生徒の生活・気分・スケジュール・モチベ・振り返り・掘り起こし・科目の先生への申し送り を横断的に扱う。「〜だよ」「〜してみる?」「了解!」「そっか」みたいな砕けた口調。距離が近め、感情の話もしやすい。Phase 3 拡張で振り返り（日次/週次/月次）と掘り起こし（『何が分からないか分からない』を質問で言語化させる技法）を中核業務に追加。",
  avatarLetter: "ゆ",
  /** ヘッダー等で使うサブタイトル */
  subtitle: "担任の先生（コーチ）",
} as const;

/**
 * 初回ログイン時の挨拶メッセージ。
 *
 * Phase 3 拡張: コーチング型に変更。ぐだぐだ雑談ではなく、
 * 振り返り 5 セクションの最初の質問（昨日のレビュー = GROW の R）から入る。
 *
 * mode:
 *  - "morning"（既定）: 朝の振り返り 5 セクション (昨日 → 学校 → 気分 → 疑問 → 計画)
 *  - "ending": 学習終了の振り返り (思いつき発話 → AI 要約 → 課題抽出 → 繰り越し確認 → 終了)
 */
export function buildInitialTutorThread(
  now: Date = new Date(),
  mode: "morning" | "ending" = "morning",
): TutorThread {
  if (mode === "ending") {
    // ito19 さん監修の canonical script（TUTOR-ROLE.md §終了振り返りの開始発話 参照）。
    // 「ふわっと → 具体化」というゆい先生の核を本人に明示的に伝えてから、
    // 思い切って喋ってもらう。語り口は ito19 さんの実発話に準拠（フランク敬語）。
    const messages: TutorMessage[] = [
      {
        id: "t-end-1",
        role: "tutor",
        topic: "ending",
        text: "お疲れさま！\n\n**今から、頭の中のふわっとしたものを、私がまとめて具体化していくね。**\n\n今日勉強してみて、頭の中で思い浮かんだこと、そのまま話してみて。\n\n- 「ここが分かった」「ここが分かんない」\n- 分かったけど、まだしっくりこないところ\n- どうして分からないのか、自分で思ったこと\n\nなんでも OK。**頭の中で思い浮かんだものを、そのまま喋って**。\n\n私がそれを要約して、**今ふわっとしてる** のを **具体的にまとめていく** から。頭の中でまだ抽象的なのを、毎回具体化していくね。\n\n思い切って話してみて。",
        quickReplies: [
          "ここがしっくりこない",
          "分かった気がするけど…",
          "なんとなくモヤる",
          "けっこう疲れた",
        ],
        createdAt: now.toISOString(),
      },
    ];
    return {
      id: "tutor-thread-ending",
      learnerId: "girl",
      messages,
    };
  }

  // morning mode (既定)
  const hour = now.getHours();
  const greeting =
    hour < 11
      ? "おはよう！"
      : hour < 17
        ? "おかえり！お疲れさま。"
        : hour < 22
          ? "おかえり〜、お疲れさま。"
          : "もうこんな時間か。来てくれてありがとう。";

  const messages: TutorMessage[] = [
    {
      id: "t-1",
      role: "tutor",
      topic: "morning-reflection",
      text: `${greeting}\n\nまず軽く振り返りからいこっか。**昨日はどこまで進んだ?**\n\n覚えてなかったら「えっと…」でも OK、一緒に思い出そう。すぐ取り掛かりたい時は、上のメニューからも始められるよ。`,
      quickReplies: ["覚えてない", "不定詞のとこまでやった", "昨日はやらなかった"],
      createdAt: now.toISOString(),
    },
  ];

  return {
    id: "tutor-thread-default",
    learnerId: "girl",
    messages,
  };
}

/**
 * scripted な「次の発話」を返す関数。
 *
 * Phase 3 拡張: コーチング型 朝の振り返り → 掘り起こし → 計画 → 学習開始 のフロー。
 */
type TutorState =
  // === 朝の振り返り 5 セクション（コーチング契約 / GROW の R+W）===
  | "reflection-yesterday" // 昨日のレビュー（初期状態）
  | "reflection-school" // 今日学校で習ったこと
  | "reflection-mood" // 気分・出来事の受け止め
  | "reflection-questions" // 疑問・不安（掘り起こし入口）
  | "excavation" // 掘り起こし継続中
  | "reflection-plan" // 今日の計画（GROW の W）
  // === 学習開始フロー（教科 → 教材 → 範囲 → 開始）===
  | "subject-picked"
  | "material-picked"
  | "ready-to-start"
  | "started"
  // === 学習終了フロー（毎ターン要約を見せて気づきを誘発 → 終わり宣言で確認 → 終了）===
  | "ending-vent" // 自由発話ループ。毎ターン現状サマリーを返す
  | "ending-confirm" // 最終サマリー + 「これで終わりますか?」
  | "ending-done"; // セッション終了完了

export type TutorStep = {
  state: TutorState;
  /** 学習開始時に渡す情報。AI 提案ベース。 */
  proposedSubjectId?: string;
  proposedMaterialId?: string;
  proposedEntryNodeId?: string;
  /** 掘り起こしで本人が言語化した不明事項（mock では 1 件まで保持） */
  excavationTopic?: string;
  /**
   * 朝の振り返り 5 セクションの draft（C3 で追加）。
   * 各 reflection-* 遷移時に該当フィールドを userInput で更新し、
   * reflection-plan 到達時に `MOCK_REFLECTION_LOGS.push(...)` で確定する。
   */
  reflectionDraft?: ReflectionDraft;
  /**
   * 終了振り返りで本人が言ったことの蓄積。1 発話 = 1 要素。
   * 毎ターン AI がこのリストを見せて「他にある?」と聞くことで、
   * 本人の「あ、まだあった」気づきを誘発する（メタ認知促進）。
   */
  endingVentItems?: string[];
};

/**
 * 朝の振り返り 5 セクションの蓄積。reflection-plan 到達で
 * ReflectionLog として MOCK_REFLECTION_LOGS に push される。
 */
export type ReflectionDraft = {
  yesterdayReview?: string;
  schoolToday?: string;
  emotionsAndEvents?: string;
  questionsAndDoubts?: string;
  /** excavation 経由で派生した Issue の id 群 */
  derivedIssueIds: string[];
  /** excavation 経由で派生した TutorHandoff の id 群 */
  derivedHandoffIds: string[];
};

// ============================================================================
// 派生実装 (C3): excavation 終了 / 朝の振り返り完了 で mock データに push
//
// REVIEW-2026-05-24.md コーチング #2「『申し送りしておくよ』と発話するが
// 派生先が存在しない（仕様詐欺）」の解消。
// ============================================================================

/**
 * 掘り起こしで本人が言語化したテキストから、推定ノード ID を返す。
 * Issue.nodeId は必須なので、推定失敗時は root の "grammar" にフォールバック。
 * 単純なキーワードマッチ。Phase 6 で LLM ベースの分類に置換する。
 */
function inferNodeIdFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("不定詞") && t.includes("名詞")) return "inf-noun";
  if (t.includes("不定詞") && t.includes("形容")) return "inf-adj";
  if (t.includes("不定詞") && t.includes("副詞")) return "inf-adv";
  if (t.includes("不定詞")) return "inf";
  if (t.includes("動名詞") || t.includes("ing")) return "inf-noun";
  if (t.includes("受動") || t.includes("受け身") || t.includes("passive"))
    return "passive-basic";
  if (t.includes("比較")) return "comparative";
  if (
    t.includes("助動詞") ||
    t.includes("must") ||
    t.includes("may") ||
    t.includes("should")
  )
    return "modal";
  if (t.includes("過去進行")) return "past-progressive";
  if (t.includes("過去") || t.includes("不規則")) return "verb-past";
  if (t.includes("未来") || t.includes("will") || t.includes("going to"))
    return "future";
  return "grammar";
}

let derivedCounter = 0;
function makeDerivedId(prefix: string): string {
  derivedCounter += 1;
  return `${prefix}-runtime-${Date.now().toString(36)}-${derivedCounter}`;
}

/**
 * 掘り起こしから Issue と TutorHandoff を派生して MOCK に push する。
 * 戻り値で派生した id を返し、呼び出し元が ReflectionLog の derivedXxxIds に
 * 積み上げられるようにする。
 */
function deriveFromExcavation(topic: string): {
  issueId: string;
  handoffId: string;
} {
  const nodeId = inferNodeIdFromText(topic);
  const truncatedTitle =
    topic.length > 50 ? `${topic.slice(0, 50)}…` : topic;
  const now = new Date().toISOString();
  const issueId = makeDerivedId("issue");
  const handoffId = makeDerivedId("handoff");

  const issue: Issue = {
    id: issueId,
    nodeId,
    source: "self",
    title: truncatedTitle,
    detail: topic.length > 50 ? topic : undefined,
    status: "open",
    createdAt: now,
    occurrences: [
      {
        id: makeDerivedId("occ"),
        detectedAt: now,
        description: "朝の振り返り 掘り起こしで本人が言語化（C3 mock 派生）。",
        source: "self",
      },
    ],
  };

  const handoff: TutorHandoff = {
    id: handoffId,
    fromTutor: true,
    toSubjectId: "subj-english",
    relatedNodeId: nodeId === "grammar" ? undefined : nodeId,
    relatedIssueId: issueId,
    title: truncatedTitle,
    body: [
      "**ゆいから葵先生へ**",
      "",
      "朝の振り返り 掘り起こしで本人が言語化:",
      `> ${topic}`,
      "",
      "**所感**: 本人が自分から「分からない」と言語化できた件。次回の chat で深掘りお願いします。",
    ].join("\n"),
    status: "unread",
    createdAt: now,
  };

  MOCK_ISSUES.push(issue);
  MOCK_HANDOFFS.push(handoff);
  return { issueId, handoffId };
}

/**
 * ローカル日付を YYYY-MM-DD で返す（タイムゾーンずれ防止）。
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 朝の振り返り完了で ReflectionLog を派生して MOCK_REFLECTION_LOGS に push する。
 * reflection-plan 到達時に呼ばれる。
 */
function deriveMorningReflectionLog(
  draft: ReflectionDraft,
  todayPlan?: string,
): ReflectionLog {
  const now = new Date();
  const log: ReflectionLog = {
    id: makeDerivedId("ref"),
    learnerId: "girl",
    date: formatLocalDate(now),
    cadence: "daily",
    yesterdayReview: draft.yesterdayReview,
    schoolToday: draft.schoolToday,
    emotionsAndEvents: draft.emotionsAndEvents,
    questionsAndDoubts: draft.questionsAndDoubts,
    todayPlan,
    derivedIssueIds: draft.derivedIssueIds.length
      ? [...draft.derivedIssueIds]
      : undefined,
    derivedHandoffIds: draft.derivedHandoffIds.length
      ? [...draft.derivedHandoffIds]
      : undefined,
    createdAt: now.toISOString(),
  };
  MOCK_REFLECTION_LOGS.push(log);
  return log;
}

/** draft の初期化（reflection-yesterday から開始する初回ターン用）*/
function emptyDraft(): ReflectionDraft {
  return { derivedIssueIds: [], derivedHandoffIds: [] };
}

/**
 * 状態 + 右ペインアクション から話題タグを派生（Phase 3 拡張）。
 * 既に reply.topic が明示設定されてればそちらを尊重するため、
 * buildNextTutorReply の末尾でフォールバックとして使う。
 */
export function deriveTutorTopic(
  state: TutorState,
  action?: TutorRightPaneAction,
): TutorTopic {
  if (action) {
    switch (action.kind) {
      case "open-issues":
      case "open-issue":
        return "issue-check";
      case "open-schedule":
        return "schedule-check";
      case "open-history":
        return "history-check";
      case "open-reflections":
        return "reflection-check";
      case "open-material-new":
        return "material-add";
      case "open-subject-history":
        return "subject-history";
      case "open-tutor-archive":
        return "subject-history"; // 担任対話履歴も history 系扱い (専用 topic なし)
      case "close":
        return "free-chat";
    }
  }
  switch (state) {
    case "reflection-yesterday":
    case "reflection-school":
    case "reflection-mood":
    case "reflection-questions":
    case "reflection-plan":
      return "morning-reflection";
    case "excavation":
      return "excavation";
    case "subject-picked":
    case "material-picked":
    case "ready-to-start":
    case "started":
      return "start-study";
    case "ending-vent":
    case "ending-confirm":
    case "ending-done":
      return "ending";
  }
  return "free-chat";
}

export function buildNextTutorReply(args: {
  state: TutorStep;
  userInput: string;
}): { reply: TutorMessage; nextState: TutorStep } {
  const result = buildNextTutorReplyInner(args);
  // 明示設定がなければ話題を派生（次の state + 右ペインアクションから）
  if (!result.reply.topic) {
    result.reply.topic = deriveTutorTopic(
      result.nextState.state,
      result.reply.rightPaneAction,
    );
  }
  return result;
}

function buildNextTutorReplyInner(args: {
  state: TutorStep;
  userInput: string;
}): { reply: TutorMessage; nextState: TutorStep } {
  const { state, userInput } = args;
  const lower = userInput.toLowerCase().trim();
  const now = new Date().toISOString();

  // =====================================================================
  // 過去 chat 検索（「あの話したよね?」系の発話を拾う）
  //
  // ito19 さん要望: ゆい先生の対話履歴を本人が探せるように。
  // 「前に話した」「覚えてる?」等のトリガーがあれば、トリガー語を除いた
  // 残りをクエリとして全 thread を grep。ヒット候補をカードで返す。
  // =====================================================================
  const searchQuery = detectSearchIntent(userInput);
  if (searchQuery) {
    const results = searchTutorThreads(searchQuery, 5);
    if (results.length > 0) {
      return {
        nextState: state,
        reply: {
          id: makeId(),
          role: "tutor",
          text: `「${searchQuery}」、過去の会話から見つけたよ。${results.length} 件あった、クリックで該当日のアーカイブが開くよ。`,
          card: {
            kind: "chat-search-result",
            query: searchQuery,
            results,
          },
          createdAt: now,
        },
      };
    }
    // ヒットなし
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: `「${searchQuery}」、見当たらないなあ。\n別の言い方で言ってみる? それか「対話履歴」って言うと過去 chat 全部を右ペインで見れるよ。`,
        rightPaneAction: { kind: "open-tutor-archive" },
        createdAt: now,
      },
    };
  }

  // =====================================================================
  // ハブ動作（state に関係なく、メニュー的なキーワードに反応して右ペインへ）
  // =====================================================================

  // 「課題見せて」「やる事は?」「未クリア」
  if (
    lower.includes("課題") ||
    lower.includes("やる事") ||
    lower.includes("やること") ||
    lower.includes("未クリア")
  ) {
    const openIssues = MOCK_ISSUES.filter((i) => i.status === "open");
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text:
          openIssues.length > 0
            ? `未クリアの課題、いま ${openIssues.length} 件あるね。\nどれから掘る? 全部見るならカードの下のボタンから。`
            : "未クリアの課題はないよ。気持ちいい!\n次どうする?",
        card: {
          kind: "issue-list",
          issueIds: openIssues.slice(0, 5).map((i) => i.id),
          seeAllLabel: "課題一覧を全部見る",
        },
        rightPaneAction: { kind: "open-issues" },
        createdAt: now,
      },
    };
  }

  // 「スケジュール」「予定」「今日のタスク」
  if (
    lower.includes("スケジュール") ||
    lower.includes("予定") ||
    (lower.includes("今日") && lower.includes("タスク"))
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text:
          MOCK_SCHEDULE_TODAY.length > 0
            ? `今日のタスクはこんな感じ。どれから手をつけたい?`
            : "今日のタスクはまだ立ててないね。一緒に組み立ててみる?",
        card: {
          kind: "today-schedule",
          scheduleItemIds: MOCK_SCHEDULE_TODAY.slice(0, 5).map((i) => i.id),
          seeAllLabel: "スケジュールを全部見る",
        },
        rightPaneAction: { kind: "open-schedule" },
        createdAt: now,
      },
    };
  }

  // 「教材を追加」「教材追加」「教材登録」「PDF」「テキスト追加」
  if (
    lower.includes("教材") ||
    lower.includes("pdf") ||
    lower.includes("テキスト追加") ||
    lower.includes("テキスト登録")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、新規教材登録するね。右でやろう。\nPDF を選んだら AI が体系図ノードを抽出してくれるから、それを一緒に監修していこう。",
        rightPaneAction: { kind: "open-material-new" },
        createdAt: now,
      },
    };
  }

  // 「学習を開始」「学習を始める」「勉強する」「始める」
  // → 振り返りをスキップして直接 計画フェーズへ
  if (
    lower.includes("学習を開始") ||
    lower.includes("学習を始める") ||
    lower.includes("勉強する") ||
    lower === "始める" ||
    lower === "始めたい"
  ) {
    return {
      nextState: { ...state, state: "reflection-plan" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、サクッと始めよっか。**何の教科から?**",
        card: {
          kind: "subject-picker",
          options: [{ subjectId: "subj-english", label: "英語" }],
        },
        createdAt: now,
      },
    };
  }

  // 「あおい先生」「英語の先生」「英語 履歴」「英語の対話」「英語 何話した」
  // ※「履歴」分岐より先に判定する（先勝ちで一般「履歴」に持っていかれないように）
  if (
    lower.includes("あおい先生") ||
    lower.includes("あおい") ||
    lower.includes("英語の先生") ||
    lower.includes("英語 履歴") ||
    lower.includes("英語履歴") ||
    lower.includes("英語の対話") ||
    lower.includes("英語の履歴") ||
    (lower.includes("英語") && lower.includes("何話した"))
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "あおい先生（英語）との対話履歴、右に出すね。\n見ながら「ここ課題にして」「ここノートにまとめて」って言ってくれたら拾うよ。",
        rightPaneAction: {
          kind: "open-subject-history",
          subjectId: "subj-english",
        },
        createdAt: now,
      },
    };
  }

  // 「ゆい対話履歴」「ゆい先生との対話」「私との対話」「ゆいログ」 等
  //   → ゆい先生 対話アーカイブ (tutor-archive view) を右ペインに展開
  // ※「履歴」分岐より先に判定する（先勝ち回避）
  if (
    (lower.includes("ゆい") &&
      (lower.includes("対話") || lower.includes("履歴") || lower.includes("ログ"))) ||
    lower.includes("私との対話") ||
    lower.includes("チャット履歴")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "私との対話履歴、右に出すね。\n過去の日付を選んだり、話題（朝の振り返り / 課題確認 / 終了 等）で絞り込んで見返せるよ。",
        rightPaneAction: { kind: "open-tutor-archive" },
        createdAt: now,
      },
    };
  }

  // 「履歴」「これまで」（「振り返り」は朝の儀式と混同するので外す）
  // → 学習履歴 (HistoryView) を右ペインに展開
  if (lower.includes("履歴") || lower.includes("これまで")) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "これまでの学習履歴、右に出すね。\nセッションごとの時間と振り返りが見られるよ。",
        rightPaneAction: { kind: "open-history" },
        createdAt: now,
      },
    };
  }

  // C4: 「振り返りログ」「ふりかえり」「日記」「reflection」
  // → ReflectionLog 一覧 (ReflectionListView) を右ペインに展開
  // 「振り返り」単独は朝の儀式と混同するので **「ログ」「日記」「一覧」を伴う場合のみ** 反応。
  // 朝の振り返りを直接呼び出したい場合は別途 keyword を用意する想定。
  if (
    lower.includes("振り返りログ") ||
    lower.includes("ふりかえりログ") ||
    lower.includes("振り返り一覧") ||
    lower.includes("ふりかえり一覧") ||
    lower.includes("振り返り見") ||
    lower.includes("ふりかえり見") ||
    lower.includes("日記") ||
    lower.includes("reflection")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、これまでの振り返りログ、右に出すね。\n日付ごとに、その日に話したことをまとめてあるよ。",
        rightPaneAction: { kind: "open-reflections" },
        createdAt: now,
      },
    };
  }

  // =====================================================================
  // 朝の振り返り 5 セクション（コーチング型）
  // 観察ベースの承認 + 次の質問、を毎ターン繰り返す
  // =====================================================================

  // --- reflection-yesterday → reflection-school ---
  if (state.state === "reflection-yesterday") {
    const ack =
      lower.includes("覚えてない") ||
      lower.includes("やらなかった") ||
      lower === ""
        ? "OK、そういう日もあるよ。"
        : "なるほど、そこまでやったんだね。";
    // C3: draft に yesterdayReview を蓄積
    const draft = state.reflectionDraft ?? emptyDraft();
    return {
      nextState: {
        ...state,
        state: "reflection-school",
        reflectionDraft: { ...draft, yesterdayReview: userInput },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `${ack}\n\nじゃあ次。**学校では今日どんなことやった?** 英語でも他の教科でも、なんでも。`,
        quickReplies: [
          "特になかった",
          "英語で新しいの習った",
          "数学が大変だった",
        ],
        createdAt: now,
      },
    };
  }

  // --- reflection-school → reflection-mood ---
  if (state.state === "reflection-school") {
    // C3: draft に schoolToday を蓄積
    const draft = state.reflectionDraft ?? emptyDraft();
    return {
      nextState: {
        ...state,
        state: "reflection-mood",
        reflectionDraft: { ...draft, schoolToday: userInput },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "覚えといたよ、それ。あとで復習タスクに入れとくね。\n\nそれで、**今日どんな気分?** 嬉しかったこと、しんどかったこと、なんでも。",
        quickReplies: [
          "ふつう",
          "ちょっと疲れた",
          "いい感じ",
          "ヤなことあった",
        ],
        createdAt: now,
      },
    };
  }

  // --- reflection-mood → reflection-questions ---
  if (state.state === "reflection-mood") {
    const tired =
      lower.includes("疲れ") ||
      lower.includes("やだ") ||
      lower.includes("ヤ") ||
      lower.includes("だるい") ||
      lower.includes("つら") ||
      lower.includes("喧嘩") ||
      lower.includes("もめ");
    const ack = tired
      ? "そっか、それはキツいね。\n無理しすぎないでね、今日できる分だけで OK。"
      : "うん、いい感じ。";
    // C3: draft に emotionsAndEvents を蓄積
    const draft = state.reflectionDraft ?? emptyDraft();
    return {
      nextState: {
        ...state,
        state: "reflection-questions",
        reflectionDraft: { ...draft, emotionsAndEvents: userInput },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `${ack}\n\n**何かモヤモヤしてること、ある?** 「よく分からないけど何か引っかかる」みたいなのも OK だよ。\n\nなければ次に行こう。`,
        quickReplies: [
          "特にない",
          "ちょっと分からないとこある",
          "葵先生に聞きたいことある",
        ],
        createdAt: now,
      },
    };
  }

  // --- reflection-questions → excavation or reflection-plan ---
  if (state.state === "reflection-questions") {
    const hasQuestion =
      (lower.includes("分からない") ||
        lower.includes("わからない") ||
        lower.includes("聞きたい") ||
        lower.includes("質問") ||
        lower.includes("引っかか") ||
        lower.includes("ある")) &&
      !lower.includes("特にない") &&
      !lower.includes("ないかな");

    // C3: questionsAndDoubts を draft に積む（excavation 経由でも非経由でも保持）
    const draft = state.reflectionDraft ?? emptyDraft();
    const updatedDraft: ReflectionDraft = {
      ...draft,
      questionsAndDoubts: userInput,
    };

    if (hasQuestion) {
      // 掘り起こしへ
      return {
        nextState: {
          ...state,
          state: "excavation",
          reflectionDraft: updatedDraft,
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、一緒に掘ってみよう。\n\n**それって、どの科目? あと、もう少し具体的に言うと、どんなとこが分からない?**\n\n（うまく言葉にならなくても OK。「うーん…」とか「なんか…」とかでも、書いてみることが大事だから）",
          createdAt: now,
        },
      };
    }
    // C3: 疑問なし → 計画へ + ReflectionLog 確定 push
    deriveMorningReflectionLog(updatedDraft);
    return {
      nextState: {
        ...state,
        state: "reflection-plan",
        reflectionDraft: updatedDraft,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、じゃあ今日いこうか。\n\n**今日はどうする?** 課題消化? 新しい単元?",
        quickReplies: ["課題見せて", "学習を始める", "スケジュール見せて"],
        createdAt: now,
      },
    };
  }

  // --- excavation → reflection-plan ---
  // 本人が言語化したものを 1 件キープ + Issue / TutorHandoff を派生 push (C3)
  if (state.state === "excavation") {
    const topic = userInput.slice(0, 40);
    // C3: Issue + Handoff を派生して MOCK_ISSUES / MOCK_HANDOFFS に push
    const { issueId, handoffId } = deriveFromExcavation(userInput);
    const draft = state.reflectionDraft ?? emptyDraft();
    const updatedDraft: ReflectionDraft = {
      ...draft,
      derivedIssueIds: [...draft.derivedIssueIds, issueId],
      derivedHandoffIds: [...draft.derivedHandoffIds, handoffId],
    };
    // C3: ReflectionLog を確定 push（派生 id 群も含む）
    deriveMorningReflectionLog(updatedDraft);
    return {
      nextState: {
        ...state,
        state: "reflection-plan",
        excavationTopic: userInput,
        reflectionDraft: updatedDraft,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `言ってくれてありがとう、それ大事。\n\n**「${topic}${userInput.length > 40 ? "…" : ""}」を課題に追加しといたね。** 葵先生にも「ここ深掘り提案」って申し送りしておいたよ。\n\nじゃあ今日はどうする? 今追加した課題からやる? 別のことから?`,
        quickReplies: [
          "今追加した課題からやる",
          "課題見せて",
          "学習を始める",
        ],
        createdAt: now,
      },
    };
  }

  // --- reflection-plan → subject picker ---
  if (state.state === "reflection-plan") {
    return {
      nextState: { ...state, state: "reflection-plan" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "了解。**何の教科から始める?**",
        card: {
          kind: "subject-picker",
          options: [{ subjectId: "subj-english", label: "英語" }],
        },
        createdAt: now,
      },
    };
  }

  // =====================================================================
  // 学習開始フロー（教科 → 教材 → 範囲 → 開始）
  // =====================================================================

  // --- subject-picked: 教材ピッカー ---
  if (state.state === "subject-picked") {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "英語ね。**テキストはどれにする?**",
        card: {
          kind: "material-picker",
          subjectId: state.proposedSubjectId ?? "subj-english",
          options: [
            {
              materialId: "mat-english-textbook-g8",
              label: "中2 英語 教科書",
              tag: "テキスト",
            },
            {
              materialId: "mat-english-workbook-g8",
              label: "中2 英語 問題集（不定詞特化）",
              tag: "問題集",
            },
            {
              materialId: "mat-english-sub-g8",
              label: "中2 英語 副教材",
              tag: "副教材",
            },
          ],
        },
        createdAt: now,
      },
    };
  }

  // --- material-picked: 範囲プレビュー ---
  if (state.state === "material-picked") {
    const matId = state.proposedMaterialId ?? "mat-english-textbook-g8";
    let entry = "inf-noun";
    let scope = ["inf", "inf-noun", "inf-adj", "inf-adv"];
    let label = "不定詞の 3 用法（名詞的・形容詞的・副詞的）あたり";
    if (matId === "mat-english-workbook-g8") {
      entry = "inf-noun";
      scope = [
        "inf",
        "inf-noun",
        "inf-adj",
        "inf-adv",
        "inf-adv-purpose",
        "inf-adv-result",
        "inf-adv-emotion",
      ];
      label = "問題集の不定詞セクション（p.32-35）";
    } else if (matId === "mat-english-sub-g8") {
      entry = "comparison";
      scope = ["comparison", "comparative", "superlative", "as-as"];
      label = "比較のセクション";
    }
    return {
      nextState: {
        ...state,
        state: "ready-to-start",
        proposedEntryNodeId: entry,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、${matId.includes("textbook") ? "教科書" : matId.includes("workbook") ? "問題集" : "副教材"}ね。\n\n今日のところはこのへんを考えてる。**どう?**`,
        card: {
          kind: "range-preview",
          entryNodeId: entry,
          highlightNodeIds: scope,
          scopeNodeIds: scope,
          humanLabel: label,
        },
        createdAt: now,
      },
    };
  }

  // --- ready-to-start: 開始ボタン ---
  if (state.state === "ready-to-start") {
    const entry = state.proposedEntryNodeId ?? "inf-noun";
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "じゃあ始めようか！\nまず体系図の「思い出す訓練」を軽くやってから、葵先生にバトンタッチするね。",
        card: {
          kind: "start-study",
          entryNodeId: entry,
          withReconstruction: true,
          label: "今日の学習を始める",
        },
        createdAt: now,
      },
    };
  }

  // =====================================================================
  // 学習終了フロー（思いつき発話 → AI 要約 → 課題抽出 → 繰り越し確認 → 終了）
  //
  // 設計意図（ito1919 さん）:
  //   ゆいの核は「気づきを与えること」。AI 相手だから本人は「うまく言えない」
  //   「思いつき」をそのまま投げられる。AI が得意な要約・抽出で課題化して
  //   返す → 本人が確認 → 繰り越し決めて終了。
  // =====================================================================

  // --- ending-vent: 毎ターン現状サマリーを見せて「他にある?」を繰り返すループ ---
  //
  // ito19 さん設計意図:
  //   チャット 1 本送るたびに、これまでの蓄積を要約して見せる。
  //   本人がまとまったものを見ると「あ、まだあった」って気づきがある。
  //   それを繰り返して「これで終わり?」が出るまで続ける。
  //   = ゆいの「具体化」能力をリアルタイムに体験させる設計。
  if (state.state === "ending-vent") {
    // 「終わり」宣言の検出
    const wantsEnd =
      lower === "もうない" ||
      lower === "もう無い" ||
      lower === "もうないかな" ||
      lower === "終わり" ||
      lower === "終わりです" ||
      lower === "もう終わり" ||
      lower === "以上" ||
      lower === "以上です" ||
      lower.includes("これで終わ") ||
      lower.includes("もう終わり");

    if (wantsEnd) {
      // 終わり宣言。これまでの items を最終サマリー + 課題候補として確認に進む。
      // 「終わり」発話自体は items に含めない（実質的な振り返りじゃないので）。
      const finalItems = state.endingVentItems ?? [];
      const itemsList =
        finalItems.length > 0
          ? finalItems.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "（まだ何も話してないみたい）";

      return {
        nextState: { ...state, state: "ending-confirm" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、これでまとめるね。\n\n**今日の振り返り（全 ${finalItems.length} 件）:**\n${itemsList}\n\n**繰り越したい課題候補:**\n・「動名詞 -ing との使い分け、もう少し詰めたい」\n・「副詞的用法、目的と結果の見分け方」\n\n**これで終わりますか?**\n（違うところあれば直すし、まだ思い出したら戻ろう）`,
          quickReplies: [
            "はい、終わりです",
            "あ、まだあった",
            "課題、修正したい",
          ],
          createdAt: now,
        },
      };
    }

    // 通常ターン: 本人発話を items に追加して、現状サマリー + 「他にある?」
    const items = [...(state.endingVentItems ?? []), userInput.trim()].filter(
      (s) => s.length > 0,
    );
    const itemsList = items.map((s, i) => `${i + 1}. ${s}`).join("\n");

    return {
      nextState: { ...state, endingVentItems: items },
      reply: {
        id: makeId(),
        role: "tutor",
        // quickReplies は撤去（ito19 さん指示 2026-05-24）。
        // 続けるなら次の発話をそのまま入力、終わるなら「もうない」と書くだけ。
        // 選択肢を並べるより、本文に動作を明示するほうがチャットの流れが自然。
        text: `なるほど、メモしたよ。\n\n**ここまでのまとめ:**\n${itemsList}\n\nこうやって並べてみると、**他にも思い出すこと、ある?**\n\n👉 まだあれば、そのまま続けて話してね。\n👉 もうなければ「**もうない**」って書いてくれたら、まとめに進むよ。`,
        createdAt: now,
      },
    };
  }

  // --- ending-confirm: 「これで終わりますか?」 → 終了 or vent に戻る ---
  if (state.state === "ending-confirm") {
    if (
      lower.includes("まだあった") ||
      lower.includes("まだある") ||
      lower.includes("修正")
    ) {
      // vent に戻る（追加発話を受ける）
      return {
        nextState: { ...state, state: "ending-vent" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、まだあるんだね！話してみて。何でも OK、思い出したそのまま投げて。",
          createdAt: now,
        },
      };
    }
    // 「はい、終わりです」 / その他 OK 系 → 終了
    return {
      nextState: { ...state, state: "ending-done" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、お疲れさま！今日もよくやったね。🌸\n\n**繰り越し課題は明日のスケジュールに入れといたよ。** ゆっくり休んでね。\n\n（学習セッションを記録しました。また明日 👋）",
        createdAt: now,
      },
    };
  }

  // --- ending-done: 終了後の追加発話 ---
  if (state.state === "ending-done") {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "また話したくなったらいつでも来てね。今日はゆっくり休んで。",
        createdAt: now,
      },
    };
  }

  // --- started or fallback ---
  return {
    nextState: state,
    reply: {
      id: makeId(),
      role: "tutor",
      text: "うん、続けて。",
      createdAt: now,
    },
  };
}

let idCounter = 100;
function makeId(): string {
  idCounter += 1;
  return `t-${idCounter}`;
}

/**
 * ユーザー発話から「過去 chat 検索」意図を検出し、クエリ部分を抽出する。
 * mock 用の素朴な実装。検出した場合は string、しなければ null。
 *
 * 例:
 *   「不定詞の話、前にしたよね?」 → "不定詞"
 *   「動名詞のこと、ゆい先生に話したっけ」 → "動名詞"
 *   「あの英語の話、覚えてる?」 → "英語"
 *   「探して: 比較級」 → "比較級"
 */
function detectSearchIntent(input: string): string | null {
  const raw = input.trim();
  if (raw.length === 0) return null;

  // 明示プレフィックス: 「探して:」「検索:」
  const explicitMatch = raw.match(/^(?:探して|検索|find|search)\s*[:：]?\s*(.+)/);
  if (explicitMatch) {
    return explicitMatch[1].trim() || null;
  }

  // トリガーフレーズが含まれているか
  const TRIGGERS = [
    "話したよね",
    "話したっけ",
    "話したやつ",
    "話してたよね",
    "言ったよね",
    "言ったっけ",
    "言ってたよね",
    "覚えてる",
    "覚えてた",
    "前に話した",
    "前に言った",
    "前に話してた",
    "あの話",
    "あれ、どこ",
    "どこだっけ",
    "ゆい先生に話した",
    "ゆいに話した",
    "ゆい先生に言った",
    "ゆいに言った",
  ];
  const hasTrigger = TRIGGERS.some((t) => raw.includes(t));
  if (!hasTrigger) return null;

  // クエリ抽出: トリガー語と一般的な助詞・語尾を全部削って残りをクエリに
  let query = raw;
  for (const t of TRIGGERS) {
    query = query.replaceAll(t, " ");
  }
  // 一般的な助詞・語尾の除去（mock 用簡易、完璧でなくて OK）
  query = query
    .replace(/[、。?？!！]/g, " ")
    .replace(/\b(の|を|に|は|が|で|と|から|よね|っけ|の事|のこと|の話|やつ|ちょっと)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 空 or 短すぎ → 検索意図はあるが対象が曖昧。null を返さず "" を返す
  // とアーカイブ全体を開く動線になる
  if (query.length === 0) return null;
  return query;
}
