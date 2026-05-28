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
  LearningPlan,
  PeriodEntry,
  PlanSegment,
  PlanType,
  ReflectionLog,
  ScheduleItem,
  SchoolDailyReport,
  TutorHandoff,
  TutorMessage,
  TutorRightPaneAction,
  TutorThread,
  TutorTopic,
} from "./types";
import {
  MOCK_GENERATED_TASKS,
  MOCK_HANDOFFS,
  MOCK_INTERRUPT_EVENTS,
  MOCK_ISSUES,
  MOCK_LEARNING_PLANS,
  MOCK_MATERIALS,
  MOCK_NODE_COMPREHENSIONS,
  MOCK_NODE_REVIEW_SUGGESTIONS,
  MOCK_REFLECTION_LOGS,
  MOCK_SCHEDULE_TODAY,
  MOCK_SCHOOL_DAILY_REPORTS,
  MOCK_SUBJECTS,
  MOCK_TREE,
} from "./mock-data";
import { searchTutorThreads } from "./tutor-thread-storage";
import { tutorClaudeRespondToPlanRequest } from "./tutor-claude";
import {
  detectTeachingRequest,
  labelForTeachingCategory,
  type TeachingDetection,
} from "./tutor-teaching-guard";

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
 *  - "evening" (C10 Phase 4): 帰宅儀式 第 1 部 (時限数 → 時限別ヒアリング)
 */
export function buildInitialTutorThread(
  now: Date = new Date(),
  mode: "morning" | "ending" | "evening" = "morning",
): TutorThread {
  if (mode === "evening") {
    // C10: 帰宅儀式 第 1 部開始 (時限数 quickReplies)
    const messages: TutorMessage[] = [
      {
        id: "t-evening-1",
        role: "tutor",
        topic: "morning-reflection",
        text: "おかえり! まず学校の話聞かせて。\n\n**今日は何時限まで授業あった?**",
        quickReplies: ["1", "2", "3", "4", "5", "6"],
        createdAt: now.toISOString(),
      },
    ];
    return {
      id: "tutor-thread-evening",
      learnerId: "girl",
      messages,
    };
  }

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

  // C19 Phase 5 P5-Q3: 未処理 Interrupt があれば冒頭で Replan 提案
  // (Suggestion より優先度高、急ぎだから先に処理)
  const untriggeredInterrupt = getUntriggeredInterrupt();
  if (untriggeredInterrupt) {
    const activePlan = MOCK_LEARNING_PLANS.find((p) => p.status === "active");
    if (activePlan) {
      const draft = buildReplanDraft({
        plan: activePlan,
        replanKind: "carry-over",
        triggeredBy: "interrupt",
        interruptTitle: untriggeredInterrupt.title,
      });
      // フラグ立てて再提示防止
      untriggeredInterrupt.replanTriggered = true;
      messages.push({
        id: "t-1-interrupt",
        role: "tutor",
        topic: "morning-reflection",
        text: `**${untriggeredInterrupt.title}** が発生したから、計画ちょっと組み直そうか?`,
        card: {
          kind: "replan-draft",
          planId: activePlan.id,
          planTitle: activePlan.title,
          replanKind: "carry-over",
          triggeredBy: "interrupt",
          proposedChange: draft.proposedChange,
          rationale: draft.rationale,
        },
        quickReplies: ["OK 反映して", "あとで", "いらない"],
        createdAt: new Date(now.getTime() + 500).toISOString(),
      });
    }
  }

  // C18 Phase 5 P5-Q4: pending な NodeReviewSuggestion があれば冒頭で提示
  // (本日 1 件まで、複数 pending は最新 1 件のみ提示。多重提示は鬱陶しい)
  const pendingSuggestion = getOldestPendingSuggestion();
  if (pendingSuggestion) {
    const failedNode = MOCK_TREE.find(
      (n) => n.id === pendingSuggestion.failedNodeId,
    );
    const parentNode = MOCK_TREE.find(
      (n) => n.id === pendingSuggestion.suggestedParentNodeId,
    );
    if (failedNode && parentNode) {
      messages.push({
        id: "t-1-suggestion",
        role: "tutor",
        topic: "morning-reflection",
        text: `あ、ちょっと提案あるんだけど。\n\n**葵先生から**: **${failedNode.name}** が浅めだったから、**${parentNode.name}** に戻って整理し直すと定着しやすいかも、って。\n\nどうする?`,
        card: {
          kind: "node-review-suggestion",
          suggestionId: pendingSuggestion.id,
          failedNodeName: failedNode.name,
          parentNodeName: parentNode.name,
          reason: pendingSuggestion.reason,
        },
        quickReplies: ["復習する", "あとで考える", "いらない"],
        createdAt: new Date(now.getTime() + 1000).toISOString(),
      });
    }
  }

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
  | "ending-done" // セッション終了完了
  // === C8 Phase 4 計画立案フロー (chat + カードハイブリッド) ===
  // C17 Phase 5 で weak-node-picker を duration と roadmap-preview の間に挿入
  | "plan-await-subject" // 計画立案: subject-picker 表示中
  | "plan-await-material" // 計画立案: material-picker 表示中
  | "plan-await-duration" // 計画立案: duration-picker 表示中
  | "plan-await-weak-nodes" // 計画立案: weak-node-picker 表示中 (P5-Q2)
  | "plan-await-confirm" // 計画立案: roadmap-preview 表示中 (OK/速く/ゆっくり 待ち)
  | "plan-done" // 計画立案: LearningPlan push 済み
  // === C9 Phase 4 帰宅儀式 第 1 部: 学校レポート (時限別シーケンシャル) ===
  | "evening-await-period-count" // 時限数 (1-6) 選択待ち
  | "evening-await-period-subject" // 「N 時限目は何の科目?」科目入力待ち
  | "evening-await-period-content" // 「何習った?」内容入力待ち
  | "evening-await-extra-events" // 「他に学校で起こったことある?」入力待ち
  | "evening-school-done" // 第 1 部完了 (SchoolDailyReport push 済み)
  // === C10 Phase 4 帰宅儀式 第 2 部: スケジュール確定 ===
  | "evening-show-schedule" // 今日のスケジュール表示 + 「他に課題ある?」
  | "evening-await-task-text" // ad-hoc タスク本文入力待ち
  | "evening-await-more-tasks" // 「もう 1 件? OK 開始?」
  | "evening-finalize"; // 帰宅儀式 完了 (今日のタスク確定)

export type TutorStep = {
  state: TutorState;
  /** 学習開始時に渡す情報。AI 提案ベース。 */
  proposedSubjectId?: string;
  proposedMaterialId?: string;
  proposedEntryNodeId?: string;
  /** C8: 計画立案フローで本人が選んだ期間 (1 回転あたり何ヶ月) */
  proposedMonthsPerRotation?: number;
  /** C8: 計画立案フローで本人が選んだ回転数 */
  proposedRotations?: number;
  /** C17 Phase 5 P5-Q5: 計画の目的 (試験対策/苦手克服/復習/長期記憶/通常)。明示発話で起動、デフォルト regular-study */
  proposedPlanType?: PlanType;
  /** C17 Phase 5 P5-Q2: 計画立案で本人がチェックした弱いノード id 群 */
  proposedWeakNodeIds?: string[];
  /** C8: 計画立案で確定した LearningPlan id */
  confirmedLearningPlanId?: string;
  /**
   * C19 Phase 5 P5-Q3: 提示中の Replan draft。
   * 「OK 反映して」発話で commitReplan に渡す。
   */
  proposedReplanDraft?: {
    planId: string;
    replanKind: "carry-over" | "pace-change" | "material-change";
    triggeredBy: "weekly-review" | "interrupt" | "manual";
    reason: string;
  };
  /** C9: 帰宅儀式 第 1 部 (学校レポート) の draft */
  schoolReportDraft?: SchoolReportDraft;
  /** C9: 帰宅儀式で確定した SchoolDailyReport id */
  confirmedSchoolReportId?: string;
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

// ============================================================================
// C8 Phase 4 計画立案フロー — LearningPlan の動的生成と月次バッチ展開
//
// chat + カードハイブリッド (Q11 確定):
//   subject-picker → material-picker → duration-picker → roadmap-preview → 確定
//
// ヘルパー:
//   - buildRoadmapFromInputs: 期間 + 回転数 + 教材ページから monthlyRoadmap を生成
//   - derivePlanFromInputs: LearningPlan を組み立てて MOCK に push
//   - expandPlanMonth: 当月分の ScheduleItem を生成して MOCK_SCHEDULE_TODAY に追加
// ============================================================================

/** 教材の総ページ数を mock から取得 (mock では coveredNodeIds.length × 10 で擬似計算) */
function getMaterialTotalPages(materialId: string): number {
  const material = MOCK_MATERIALS.find((m) => m.id === materialId);
  if (!material) return 200; // フォールバック
  // mock: ノード数ベースで擬似的にページ計算 (1 ノード ≈ 10p)
  // Phase 6 で AI が教材 PDF から目次自動読み込みに置換
  return Math.max(50, material.coveredNodeIds.length * 10);
}

/** 教材の表示名を mock から取得 */
function getMaterialName(materialId: string): string {
  return MOCK_MATERIALS.find((m) => m.id === materialId)?.name ?? "教材";
}

/** "YYYY-MM" 形式の月を N ヶ月分生成 (startDate 起点) */
function generateMonthList(startDate: Date, count: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

/** 月数 + 回転数 + 総ページから monthlyRoadmap を生成 */
function buildRoadmapFromInputs(args: {
  startDate: Date;
  totalPages: number;
  monthsPerRotation: number;
  rotations: number;
}): PlanSegment[] {
  const { startDate, totalPages, monthsPerRotation, rotations } = args;
  const totalMonths = monthsPerRotation * rotations;
  const months = generateMonthList(startDate, totalMonths);
  const pagesPerMonth = Math.ceil(totalPages / monthsPerRotation);

  return months.map((month, idx) => {
    const rotationIdx = Math.floor(idx / monthsPerRotation); // 0-based 回転番号
    const monthIdxInRotation = idx % monthsPerRotation;
    const startPage = monthIdxInRotation * pagesPerMonth + 1;
    const endPage = Math.min((monthIdxInRotation + 1) * pagesPerMonth, totalPages);
    return {
      month,
      targetPages: endPage - startPage + 1,
      startPage,
      endPage,
      // 各回転の先頭月は前回転からの引継ぎなし、それ以外も初期は 0
      ...(rotationIdx > 0 && monthIdxInRotation === 0
        ? {} // 回転境界、繰り越しなし
        : {}),
    };
  });
}

/** LearningPlan を組み立てて MOCK_LEARNING_PLANS に push、id を返す */
function derivePlanFromInputs(args: {
  subjectId: string;
  materialId: string;
  monthsPerRotation: number;
  rotations: number;
  startDate: Date;
  /** C17 Phase 5: 計画の目的 (デフォルト regular-study) */
  planType?: PlanType;
  /** C17 Phase 5: 本人がチェックした弱いノード id 群 (P5-Q2) */
  weakNodeIds?: string[];
}): LearningPlan {
  const {
    subjectId,
    materialId,
    monthsPerRotation,
    rotations,
    startDate,
    planType = "regular-study",
    weakNodeIds = [],
  } = args;
  const totalPages = getMaterialTotalPages(materialId);
  const totalMonths = monthsPerRotation * rotations;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + totalMonths - 1);

  const planId = makeDerivedId("plan");
  const nowIso = new Date().toISOString();

  const monthlyRoadmap = buildRoadmapFromInputs({
    startDate,
    totalPages,
    monthsPerRotation,
    rotations,
  });

  const plan: LearningPlan = {
    id: planId,
    learnerId: "girl",
    subjectId,
    title: `${getMaterialName(materialId)} ${rotations} 回転計画`,
    scope: totalMonths >= 12 ? "year" : totalMonths >= 6 ? "semester" : "term",
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
    materialIds: [materialId],
    targetRotations: rotations,
    currentRotation: 1,
    totalPages,
    monthlyRoadmap,
    expandedMonths: [],
    status: "active",
    revisions: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    // C17 Phase 5 拡張
    planType,
    weakNodeIds: weakNodeIds.length > 0 ? weakNodeIds : undefined,
    // Phase 5 デフォルトルール (本人がチューニングするまで)
    reviewRules: { reviewIntervalDays: 7, reviewMode: "review" },
    testRules: {
      testIntervalDays: 7,
      passingThreshold: 0.7,
      failureAction: "review-parent",
    },
    replanRules: { delayThresholdDays: 3, replanMode: "ai-suggest" },
    dailyCapacityMinutes: 30,
  };

  MOCK_LEARNING_PLANS.push(plan);
  return plan;
}

/**
 * C17 Phase 5 P5-Q2: 弱いノード候補抽出。
 *
 * 候補ソース (mock の半自動候補):
 *   - MOCK_ISSUES: status === "open" な Issue の nodeId
 *   - MOCK_NODE_COMPREHENSIONS: score < 0.55 の nodeId
 *
 * 両方ヒット = source: "both"、preChecked: true (強い候補)
 * 単一ヒット = preChecked: false (本人判断に委ねる)
 *
 * Phase 6 で AI 判定強化、現状は固定閾値 + Issue 一覧の素直な抽出。
 */
export function computeWeakNodeCandidates(): Array<{
  nodeId: string;
  nodeName: string;
  reason: string;
  source: "issue" | "comprehension" | "both";
  preChecked: boolean;
}> {
  const issueByNode = new Map<string, Issue>();
  for (const issue of MOCK_ISSUES) {
    if (issue.status !== "open") continue;
    // 既に同 nodeId の Issue があれば優先度高い方 (ai-detected > self) を残す
    const existing = issueByNode.get(issue.nodeId);
    if (!existing || issue.source === "ai-detected") {
      issueByNode.set(issue.nodeId, issue);
    }
  }

  const compByNode = new Map<string, { score: number; reason: string }>();
  for (const comp of MOCK_NODE_COMPREHENSIONS) {
    if (comp.score >= 0.55) continue;
    compByNode.set(comp.nodeId, { score: comp.score, reason: comp.reason });
  }

  const allNodeIds = new Set<string>([
    ...issueByNode.keys(),
    ...compByNode.keys(),
  ]);

  const candidates: Array<{
    nodeId: string;
    nodeName: string;
    reason: string;
    source: "issue" | "comprehension" | "both";
    preChecked: boolean;
  }> = [];

  for (const nodeId of allNodeIds) {
    const node = MOCK_TREE.find((n) => n.id === nodeId);
    if (!node) continue; // 体系図にないノードはスキップ
    const issue = issueByNode.get(nodeId);
    const comp = compByNode.get(nodeId);

    let reason: string;
    let source: "issue" | "comprehension" | "both";
    let preChecked: boolean;

    if (issue && comp) {
      source = "both";
      reason = `${issue.title} / 理解度 ${Math.round(comp.score * 100)}%`;
      preChecked = true;
    } else if (issue) {
      source = "issue";
      reason = issue.title;
      preChecked = false;
    } else if (comp) {
      source = "comprehension";
      reason = `理解度 ${Math.round(comp.score * 100)}%: ${comp.reason.length > 40 ? `${comp.reason.slice(0, 40)}…` : comp.reason}`;
      preChecked = comp.score < 0.5; // 0.5 未満は強い候補
    } else {
      continue;
    }

    candidates.push({
      nodeId,
      nodeName: node.name,
      reason,
      source,
      preChecked,
    });
  }

  // preChecked 優先で並べる (UI で目立つ順)
  candidates.sort((a, b) => {
    if (a.preChecked && !b.preChecked) return -1;
    if (!a.preChecked && b.preChecked) return 1;
    return 0;
  });

  // 上位 5 件まで (Phase 4 Q10 「上位 3 件 + 浅いノード 2 件」と整合)
  return candidates.slice(0, 5);
}

/**
 * C18 Phase 5 P5-Q4: pending な NodeReviewSuggestion を 1 件取得。
 * 最新の pending を返す (mock では 1 件しかない想定だが将来複数対応)。
 */
function getOldestPendingSuggestion() {
  return MOCK_NODE_REVIEW_SUGGESTIONS.find((s) => s.status === "pending");
}

/**
 * C18 Phase 5 P5-Q4: NodeReviewSuggestion を accept する副作用。
 *
 * 1. Suggestion.status を "accepted" に更新
 * 2. 復習 GT を生成して MOCK_GENERATED_TASKS に push
 * 3. 復習 SI を生成して MOCK_SCHEDULE_TODAY に push (今日 = 即時挿入)
 *
 * 戻り値: 復習 GT/SI の情報 (chat メッセージで言及するため)
 */
function acceptNodeReviewSuggestion(suggestionId: string): {
  parentNodeName: string;
  gtId: string;
  siId: string;
} | null {
  const s = MOCK_NODE_REVIEW_SUGGESTIONS.find((x) => x.id === suggestionId);
  if (!s || s.status !== "pending") return null;
  const parentNode = MOCK_TREE.find((n) => n.id === s.suggestedParentNodeId);
  if (!parentNode) return null;

  const nowIso = new Date().toISOString();
  s.status = "accepted";
  s.acceptedAt = nowIso;

  const today = formatLocalDate(new Date());
  const gtId = makeDerivedId("gtask-review");
  // 復習 GT (mode: review、親ノードに対して、resource: note か textbook)
  MOCK_GENERATED_TASKS.push({
    id: gtId,
    learnerId: "girl",
    planId: MOCK_LEARNING_PLANS[0]?.id ?? "plan-english-2026-05",
    nodeId: s.suggestedParentNodeId,
    mode: "review",
    resource: { type: "note" }, // 自分のノートで復習
    estimatedMinutes: 20,
    priority: 5,
    dueDate: today,
    status: "todo",
    scheduledDate: today,
    rationale: `Suggestion accept: ${parentNode.name} に戻って復習。理由: ${s.reason}`,
    generatedAt: nowIso,
  });

  // 復習 SI (P5-Q1 1 GT : 1 SI 紐付け、generatedTaskId 埋め込み)
  const siId = makeDerivedId("sched-review");
  MOCK_SCHEDULE_TODAY.push({
    id: siId,
    type: "lesson-review",
    sourceId: gtId,
    nodeId: s.suggestedParentNodeId,
    title: `復習: ${parentNode.name} (上ノード復習提案)`,
    detail: `${s.failedNodeId} の浅さから親ノード ${parentNode.name} に戻って整理する復習。`,
    date: today,
    estimateMinutes: 20,
    status: "todo",
    aiRationale: `NodeReviewSuggestion accept で自動追加 (P5-Q4 即時挿入)`,
    source: "ad-hoc", // 元 plan SI じゃないので ad-hoc 扱い (今週空きに割り込み)
    generatedTaskId: gtId,
    tags: ["復習", "上ノード復習"],
  });

  return { parentNodeName: parentNode.name, gtId, siId };
}

/**
 * C18 Phase 5 P5-Q4: NodeReviewSuggestion を dismiss する副作用。
 */
function dismissNodeReviewSuggestion(suggestionId: string): boolean {
  const s = MOCK_NODE_REVIEW_SUGGESTIONS.find((x) => x.id === suggestionId);
  if (!s || s.status !== "pending") return false;
  s.status = "dismissed";
  s.dismissedAt = new Date().toISOString();
  return true;
}

// ============================================================================
// C19 Phase 5 P5-Q3: Replan Engine (3 トリガー + 種類別影響範囲)
// ============================================================================

/**
 * 当月遅延を検出: アクティブな plan の今月の SI のうち、
 * dueDate 過ぎてて status: "todo" な件数。
 * (実装簡略: replanRules.delayThresholdDays を超えてたら Replan 候補)
 *
 * C20 で WeeklyMonthlyReportView から呼び出すため export 化。
 */
export function detectPlanDelay(): {
  plan: LearningPlan;
  delayedItemCount: number;
} | null {
  const activePlan = MOCK_LEARNING_PLANS.find((p) => p.status === "active");
  if (!activePlan) return null;

  const today = formatLocalDate(new Date());
  const planSiIds = activePlan.expandedMonths.flatMap((m) => m.scheduleItemIds);
  const delayedItems = MOCK_SCHEDULE_TODAY.filter(
    (s) =>
      planSiIds.includes(s.id) &&
      s.status === "todo" &&
      s.date < today, // 過去日付で todo
  );

  if (delayedItems.length === 0) return null;
  return { plan: activePlan, delayedItemCount: delayedItems.length };
}

/**
 * Replan の自動 draft を生成。triggeredBy + replanKind で文面を切り分ける。
 * 実際の GT[] 書き換えは commitReplan で実行。本関数は提案テキストのみ。
 *
 * C20 で WeeklyMonthlyReportView から呼び出すため export 化。
 */
export function buildReplanDraft(args: {
  plan: LearningPlan;
  replanKind: "carry-over" | "pace-change" | "material-change";
  triggeredBy: "weekly-review" | "interrupt" | "manual";
  delayedItemCount?: number;
  interruptTitle?: string;
}): {
  proposedChange: string;
  rationale: string;
} {
  const { plan, replanKind, triggeredBy, delayedItemCount, interruptTitle } =
    args;

  if (replanKind === "carry-over") {
    return {
      proposedChange: `${delayedItemCount ?? 0} 件の遅れタスクを来週に carry-over、当月残りで調整`,
      rationale:
        triggeredBy === "interrupt"
          ? `${interruptTitle ?? "突発イベント"} で進めなかった分を、当月内で再配置するよ。来月以降には影響しない範囲で。`
          : `今週の進捗から ${delayedItemCount ?? 0} 件遅れてる。来週で取り戻せる範囲なので carry-over で対応するのが軽い。`,
    };
  }
  if (replanKind === "pace-change") {
    const currentMonths = plan.monthlyRoadmap.length / plan.targetRotations;
    const newMonths = currentMonths + 1;
    return {
      proposedChange: `1 回転 = ${currentMonths} ヶ月 → ${newMonths} ヶ月に延長、未来 GT[] 全再生成`,
      rationale: `ペースを 1 段ゆっくりに。${plan.title} の monthlyRoadmap を再計算して、来月以降の GT を全部組み直すよ。`,
    };
  }
  // material-change
  return {
    proposedChange: `現 plan を paused に、新 LearningPlan を新規作成`,
    rationale: `教材変更は計画立案やり直し相当。既存 plan は履歴として paused で残し、新 plan を立てる流れになるよ。`,
  };
}

/**
 * Replan を実際に MOCK_LEARNING_PLANS にコミット。本人 OK 発話で呼ぶ。
 * PlanRevision を必ず履歴に push。GT[] 書き換えは mock では簡略化。
 */
function commitReplan(args: {
  planId: string;
  replanKind: "carry-over" | "pace-change" | "material-change";
  triggeredBy: "weekly-review" | "interrupt" | "manual";
  reason: string;
}): boolean {
  const plan = MOCK_LEARNING_PLANS.find((p) => p.id === args.planId);
  if (!plan) return false;

  plan.revisions.push({
    id: makeDerivedId("revision"),
    revisedAt: new Date().toISOString(),
    reason: args.reason,
    changedFields:
      args.replanKind === "carry-over"
        ? ["expandedMonths", "scheduleItemDates"]
        : args.replanKind === "pace-change"
          ? ["monthlyRoadmap", "endDate", "generatedTasks(future)"]
          : ["status", "newPlanCreated"],
    triggeredBy:
      args.triggeredBy === "weekly-review"
        ? "monthly-review"
        : args.triggeredBy === "interrupt"
          ? "ai-suggestion"
          : "manual",
  });
  plan.updatedAt = new Date().toISOString();

  // material-change は plan を paused に (新 plan 作成は別フロー)
  if (args.replanKind === "material-change") {
    plan.status = "paused";
  }
  // 注: pace-change の monthlyRoadmap 再計算 + 未来 GT[] 書き換えは
  // Phase 6 (Claude API) で本格実装、現状は PlanRevision のみで意図記録。
  return true;
}

/**
 * Interrupt で replanTriggered: false な未処理イベントを 1 件取得。
 * 取得した時に flag を true に立ててもう一度提示しないようにする。
 */
function getUntriggeredInterrupt() {
  return MOCK_INTERRUPT_EVENTS.find((e) => !e.replanTriggered);
}

/**
 * C17 Phase 5 P5-Q5: 発話から PlanType を判定。
 *
 * 明示発話で PlanType を起動するための簡易キーワードマッチ:
 *   - exam-prep:        試験対策 / 期末 / 中間 / テスト前 / exam
 *   - weakness-grind:   苦手克服 / 弱いところ集中 / 弱点
 *   - review:           復習 だけ / 復習計画 / 復習中心
 *   - long-term-memory: 長期記憶 / 定着 / 忘れない
 *   - regular-study:    一致なし (デフォルト、明示発話分岐の対象外)
 *
 * Phase 6 で LLM ベース分類に置換。
 */
function detectPlanTypeFromUtterance(lower: string): PlanType | null {
  if (
    lower.includes("試験対策") ||
    lower.includes("期末") ||
    lower.includes("中間") ||
    lower.includes("テスト前") ||
    lower.includes("exam")
  ) {
    return "exam-prep";
  }
  if (
    lower.includes("苦手克服") ||
    lower.includes("苦手をなくす") ||
    lower.includes("弱いところ集中") ||
    lower.includes("弱点克服")
  ) {
    return "weakness-grind";
  }
  // 「復習だけ」「復習中心」「復習計画」 (「復習する」だけだと広すぎるので限定)
  if (
    lower.includes("復習だけ") ||
    lower.includes("復習中心") ||
    lower.includes("復習計画")
  ) {
    return "review";
  }
  if (
    lower.includes("長期記憶") ||
    lower.includes("忘れない") ||
    lower.includes("定着させ")
  ) {
    return "long-term-memory";
  }
  return null;
}

/**
 * LearningPlan の指定月を ScheduleItem に展開して MOCK_SCHEDULE_TODAY に push、
 * expandedMonths にも記録。Phase 4 月次バッチの最小実装 (C8 では確定直後の 1 ヶ月分のみ)。
 */
function expandPlanMonth(plan: LearningPlan, monthYYYYMM: string): ScheduleItem[] {
  const segment = plan.monthlyRoadmap.find((s) => s.month === monthYYYYMM);
  if (!segment) return [];

  // mock では月全体を「1 件の ScheduleItem」として作る (簡略化)。
  // Phase 4 本格実装で日割り (1 日 N ページ) に分解する想定。
  const expanded: ScheduleItem[] = [];
  const today = formatLocalDate(new Date());
  const item: ScheduleItem = {
    id: makeDerivedId("sched-plan"),
    type: "exam-prep", // mock では既存 type を再利用 (Phase 4 で plan 専用 type 検討)
    sourceId: plan.id,
    title: `${getMaterialName(plan.materialIds[0])} ${monthYYYYMM} 分 (p.${segment.startPage}-${segment.endPage})`,
    detail: `${plan.title} の今月分`,
    date: today,
    estimateMinutes: 30,
    status: "todo",
    aiRationale: `LearningPlan ${plan.title} から月次展開`,
    tags: ["計画"],
    source: "plan",
  };
  MOCK_SCHEDULE_TODAY.push(item);
  expanded.push(item);

  plan.expandedMonths.push({
    month: monthYYYYMM,
    scheduleItemIds: [item.id],
    expandedAt: new Date().toISOString(),
  });

  return expanded;
}

/** "YYYY-MM" を返す (現在の月) */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * C10: 帰宅儀式の自動起動判定 (Q13 確定: 平日 16:00 以降の初回アクセスで自動)。
 * - 土日 (0, 6) は skip
 * - 16:00 未満は skip
 * - 今日既に帰宅儀式やってたら skip (lastRitualDate と比較)
 */
export function shouldStartEveningRitual(
  now: Date = new Date(),
  lastRitualDate: string | null = null,
): boolean {
  const dayOfWeek = now.getDay(); // 0=日, 6=土
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // 土日 skip
  if (now.getHours() < 16) return false; // 16:00 未満 skip
  const today = formatLocalDate(now);
  if (lastRitualDate === today) return false; // 既に今日やった
  return true;
}

export const EVENING_RITUAL_LAST_DATE_KEY =
  "ai-education:evening-ritual-last-date";

// ============================================================================
// C9 Phase 4 帰宅儀式 第 1 部 — 学校レポート (時限別シーケンシャル)
//
// flow (Q8 確定):
//   ゆい「おかえり! 今日は何時限まで授業あった?」(1-6 quickReplies)
//   → 時限数選択 → ゆい「1 時限目は何の科目?」「何習った?」を時限数だけ繰り返し
//   → ゆい「他に学校で起こったこと、相談したいことある?」
//   → SchoolDailyReport を MOCK_SCHOOL_DAILY_REPORTS に push (第 1 部完了)
//   → 第 2 部 (スケジュール確定) は C10 で実装
// ============================================================================

/** 帰宅儀式 第 1 部 (学校レポート) の draft */
export type SchoolReportDraft = {
  periodCount?: number;
  periods: Array<{ subject?: string; content?: string }>;
  currentPeriodIndex: number;
  extraEvents?: string;
};

const SCHOOL_SUBJECT_QUICK_REPLIES = [
  "英語",
  "数学",
  "国語",
  "理科",
  "社会",
  "体育",
  "音楽",
  "美術",
  "技術家庭",
  "保健",
];

export function emptySchoolReportDraft(): SchoolReportDraft {
  return { periods: [], currentPeriodIndex: 0 };
}

/**
 * SchoolReportDraft から SchoolDailyReport を組み立てて MOCK に push。
 * draft.periods の subject/content が両方埋まっているもののみ採用。
 */
function deriveSchoolDailyReport(
  draft: SchoolReportDraft,
): SchoolDailyReport {
  const validPeriods: PeriodEntry[] = draft.periods
    .map((p, idx) => ({
      periodNumber: idx + 1,
      subject: p.subject ?? "未入力",
      content: p.content ?? "未入力",
    }))
    .filter((p) => p.subject !== "未入力" && p.content !== "未入力");

  const now = new Date();
  const report: SchoolDailyReport = {
    id: makeDerivedId("school"),
    learnerId: "girl",
    date: formatLocalDate(now),
    periodCount: draft.periodCount ?? validPeriods.length,
    periods: validPeriods,
    extraEvents: draft.extraEvents,
    createdAt: now.toISOString(),
  };
  MOCK_SCHOOL_DAILY_REPORTS.push(report);
  return report;
}

/**
 * C10: ad-hoc タスクのヒントテキストからタグを推定。
 * 「宿題」「テスト」「提出」等のキーワードでマッチ。
 * マッチしない場合は「課題」を返す (汎用)。
 */
function inferTaskTagFromHint(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("宿題") || t.includes("ワーク") || t.includes("プリント"))
    return "宿題";
  if (t.includes("提出") || t.includes("レポート") || t.includes("作文"))
    return "提出物";
  if (
    t.includes("テスト") ||
    t.includes("試験") ||
    t.includes("小テスト") ||
    t.includes("中間") ||
    t.includes("期末")
  )
    return "テスト範囲";
  if (t.includes("親") || t.includes("お使い") || t.includes("塾"))
    return "親・他";
  return "課題";
}

/**
 * C10: 帰宅儀式で本人が言った ad-hoc タスクを ScheduleItem として
 * MOCK_SCHEDULE_TODAY に追加 (source: "ad-hoc", タグ付き)。
 */
function addAdHocScheduleItem(text: string, tag: string): ScheduleItem {
  const today = formatLocalDate(new Date());
  const truncated = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  const item: ScheduleItem = {
    id: makeDerivedId("sched-adhoc"),
    type: "homework", // mock では既存 type を最も近い "homework" にマップ
    sourceId: makeDerivedId("homework-adhoc"),
    title: truncated,
    detail: text,
    date: today,
    estimateMinutes: 30,
    status: "todo",
    aiRationale: "帰宅儀式で本人がヒアリング時に追加",
    tags: [tag],
    source: "ad-hoc",
  };
  MOCK_SCHEDULE_TODAY.push(item);
  return item;
}

/** "1" "2" "３" "六" 等から 1-6 の数値を抽出 (失敗時 null) */
function extractPeriodCount(text: string): number | null {
  // 半角数字
  const matchHalf = text.match(/[1-6]/);
  if (matchHalf) return parseInt(matchHalf[0], 10);
  // 全角数字
  const fullHalfMap: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
  };
  for (const [full, n] of Object.entries(fullHalfMap)) {
    if (text.includes(full)) return n;
  }
  // 漢数字
  const kanjiMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
  };
  for (const [k, n] of Object.entries(kanjiMap)) {
    if (text.includes(k)) return n;
  }
  return null;
}

/**
 * C6: ハードガード hit から TutorHandoff draft を派生して push する。
 * Issue は作らない（本人が「葵先生に聞く」を選んだ場合に IssueChat で
 * 別途立ち上げる想定）。Handoff の relatedIssueId は undefined のまま。
 *
 * 戻り値: 派生した handoff の id（呼び出し元の発話で言及可能）
 */
function deriveFromHardGuard(
  userInput: string,
  detection: TeachingDetection,
): string {
  const nodeId = inferNodeIdFromText(userInput);
  const truncatedTitle =
    userInput.length > 50 ? `${userInput.slice(0, 50)}…` : userInput;
  const now = new Date().toISOString();
  const handoffId = makeDerivedId("handoff-guard");

  const handoff: TutorHandoff = {
    id: handoffId,
    fromTutor: true,
    toSubjectId: "subj-english",
    relatedNodeId: nodeId === "grammar" ? undefined : nodeId,
    relatedIssueId: undefined,
    title: truncatedTitle,
    body: [
      "**ゆいから葵先生へ（ハードガード経由 / C6）**",
      "",
      `本人がゆいに「教えて」系の発話をしたので、ゆいは教えずに葵先生に振りました。`,
      `（カテゴリ: ${detection.category} / マッチ語: \`${detection.matched}\`）`,
      "",
      "発話:",
      `> ${userInput}`,
      "",
      "**所感**: 教科の中身の質問なので私からは答えていません。本人が「今すぐ聞く」「メモして後で」「もう少し自分で考える」のどれを選んだかはこの handoff には記録しません（Phase 7 で永続化と合わせて追跡）。次回 chat で取り上げてもらえると嬉しいです。",
    ].join("\n"),
    status: "unread",
    createdAt: now,
  };
  MOCK_HANDOFFS.push(handoff);
  return handoffId;
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
      case "open-today-tasks":
        return "schedule-check";
      case "open-history":
        return "history-check";
      case "open-reflections":
        return "reflection-check";
      case "open-weekly-report":
      case "open-monthly-report":
        return "reflection-check"; // 週次/月次レポートも振り返り系
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
    // C8: 計画立案フローは start-study 系 (学習を始める準備)
    case "plan-await-subject":
    case "plan-await-material":
    case "plan-await-duration":
    case "plan-await-weak-nodes":
    case "plan-await-confirm":
    case "plan-done":
      return "start-study";
    // C9: 帰宅儀式は morning-reflection と同系 (振り返り系) を流用
    // 専用 topic を追加するなら ARCHITECTURE.md の 11 topic を改訂する
    case "evening-await-period-count":
    case "evening-await-period-subject":
    case "evening-await-period-content":
    case "evening-await-extra-events":
    case "evening-school-done":
      return "morning-reflection";
    // C10: 第 2 部 (スケジュール確定) は schedule-check 系
    case "evening-show-schedule":
    case "evening-await-task-text":
    case "evening-await-more-tasks":
    case "evening-finalize":
      return "schedule-check";
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
  // C6: ハードガード hit 後の 3 肢処理（既存 keyword 分岐より前に置く）
  //
  // 「メモしてあとで」「もう少し自分で考える」は ack のみ返す。
  // 「今すぐ葵先生に聞く」「葵先生に聞く」は既存「課題見せて」分岐
  // (lower.includes("葵先生に聞") を含めて拡張) に流して課題リストを開く。
  // =====================================================================

  if (
    lower.includes("メモしてあとで") ||
    lower.includes("メモして後で") ||
    lower.includes("メモしておいて")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、メモしておいたよ。葵先生にも申し送り済み。\nいつでも課題一覧の右ペインから開けるよ。",
        quickReplies: ["課題見せて", "別の話", "学習を始める"],
        createdAt: now,
      },
    };
  }

  if (
    lower.includes("もう少し自分") ||
    lower.includes("自分で考える") ||
    lower.includes("自分で考えてみる")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "いいね。考えたものを言葉にして、また話そう。\n「考えたよ」って戻ってきてくれたら、聞くね。",
        quickReplies: ["考えたよ", "別の話", "学習を始める"],
        createdAt: now,
      },
    };
  }

  // =====================================================================
  // C6: ハードガード hit 判定
  //
  // 「教えて」「答えは」「訳して」等のキーワード検知（detectTeachingRequest）。
  // ending 系 state ではループの本人発話を誤検知しないようスキップ。
  // hit したら TutorHandoff draft を push + 3 肢 quickReplies を出す。
  // =====================================================================

  const skipGuard =
    state.state === "ending-vent" ||
    state.state === "ending-confirm" ||
    state.state === "ending-done";
  if (!skipGuard) {
    const teachingHit = detectTeachingRequest(userInput);
    if (teachingHit) {
      // 副作用: MOCK_HANDOFFS に draft handoff を push
      deriveFromHardGuard(userInput, teachingHit);
      const preview =
        userInput.length > 30 ? `${userInput.slice(0, 30)}…` : userInput;
      return {
        nextState: state, // state は変えない（本人が選んだ後に流れる）
        reply: {
          id: makeId(),
          role: "tutor",
          text: `ごめん、それは ${labelForTeachingCategory(teachingHit.category)} の話だから、**私じゃなくて葵先生の領域** だね。\n\n**「${preview}」を葵先生に申し送りしておいたよ。** どうする?`,
          quickReplies: [
            "今すぐ葵先生に聞く",
            "メモしてあとで",
            "もう少し自分で考える",
          ],
          createdAt: now,
        },
      };
    }
  }

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
  // C6: ハードガード後の「今すぐ葵先生に聞く」もここに流す（課題一覧で本人が選ぶ）
  if (
    lower.includes("課題") ||
    lower.includes("やる事") ||
    lower.includes("やること") ||
    lower.includes("未クリア") ||
    lower.includes("葵先生に聞") ||
    lower.includes("今すぐ葵")
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
        rightPaneAction: { kind: "open-today-tasks" },
        createdAt: now,
      },
    };
  }

  // C44 2026-05-26 (ito19 さん意見、残課題⑤ 解消):
  // 「教材一覧」「教材を見る」「教材」 → 教材一覧ペイン (一覧 → 詳細 → 葵 chat 動線)
  // 注意: この分岐は下の「教材追加」分岐より前に置く (先勝ち、「教材」単独 word は一覧扱い)
  if (
    lower.includes("教材一覧") ||
    lower === "教材を見る" ||
    lower === "教材" ||
    lower === "教材見せて" ||
    lower === "教材どこ"
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、登録済の教材を右で見せるね。\nクリックで体系図・評価コメント・先生 chat に飛べるよ。下から新規追加もできるよ。",
        rightPaneAction: { kind: "open-materials" },
        createdAt: now,
      },
    };
  }

  // 「教材を追加」「教材追加」「教材登録」「教材アップロード」「PDF」「テキスト追加」
  // C44 で条件を厳密化 (旧: lower.includes("教材") 全 catch → 上の一覧分岐と衝突)
  if (
    lower.includes("教材追加") ||
    lower.includes("教材を追加") ||
    lower.includes("教材登録") ||
    lower.includes("教材を登録") ||
    lower.includes("教材アップ") ||
    lower.includes("pdf") ||
    lower.includes("テキスト追加") ||
    lower.includes("テキスト登録")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、新規教材登録するね。右でやろう。\nPDF を選んだら、その教科の先生が読んで、体系図と評価コメントを出してくれるよ。",
        rightPaneAction: { kind: "open-material-new" },
        createdAt: now,
      },
    };
  }

  // C30 2026-05-25 grill 2 S6: 「科目を追加」「教科を追加」「科目設定」「英語以外」
  // → 右ペインに SubjectSettingsPanel (view=subjects) 展開
  if (
    lower.includes("科目を追加") ||
    lower.includes("科目追加") ||
    lower.includes("教科を追加") ||
    lower.includes("教科追加") ||
    lower.includes("科目設定") ||
    lower.includes("英語以外") ||
    lower === "新しい科目" ||
    lower.includes("新規科目")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、科目設定を開くね。右で 5 教科の一覧と、新しい科目の追加フォームが見れるよ。\n標準 5 教科 (英・数・国・理・社) はあらかじめ用意してあって、それ以外を追加したい時は下のフォームから登録してね。",
        rightPaneAction: { kind: "open-subjects" },
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
          options: MOCK_SUBJECTS.map((s) => ({ subjectId: s.id, label: s.name })),
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

  // C11: 「週次レポート」「今週のレポート」「weekly」
  // → 週次レポート (WeeklyMonthlyReportView mode=weekly)
  if (
    lower.includes("週次レポート") ||
    lower.includes("今週のレポート") ||
    lower.includes("今週のまとめ") ||
    lower.includes("weekly")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、今週のレポート出すね。\n一緒に読もう、**達成 → 学校 → 弱いところ → 来週の計画** の順だよ。",
        rightPaneAction: { kind: "open-weekly-report" },
        createdAt: now,
      },
    };
  }

  // C11: 「月次レポート」「今月のレポート」「monthly」
  // → 月次レポート (WeeklyMonthlyReportView mode=monthly)
  if (
    lower.includes("月次レポート") ||
    lower.includes("今月のレポート") ||
    lower.includes("今月のまとめ") ||
    lower.includes("monthly")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、今月のレポート出すね。\n月末週なら来月の計画も込みで一緒に見ようね。",
        rightPaneAction: { kind: "open-monthly-report" },
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

  // C19 Phase 5 P5-Q3: Replan 関連の発話分岐
  // (a) Replan draft 提示後の「OK 反映して」「あとで」「いらない」3 択処理
  // (b) 明示発話: 「ペース変えて」「教材変える」「再計画して」
  // (a) を先に置く: draft が提示済みなら本人の応答を優先処理
  if (state.proposedReplanDraft) {
    const draft = state.proposedReplanDraft;
    const wantsCommit =
      lower.includes("ok") ||
      lower.includes("反映") ||
      lower.includes("やって") ||
      lower.includes("お願い");
    const wantsAbort =
      lower.includes("いらない") ||
      lower.includes("やめる") ||
      lower.includes("やっぱ");
    const wantsDefer = lower.includes("あとで");

    if (wantsCommit) {
      commitReplan({
        planId: draft.planId,
        replanKind: draft.replanKind,
        triggeredBy: draft.triggeredBy,
        reason: draft.reason,
      });
      const newState = { ...state, proposedReplanDraft: undefined };
      const kindLabel =
        draft.replanKind === "carry-over"
          ? "今週の繰越調整"
          : draft.replanKind === "pace-change"
            ? "ペース変更"
            : "教材変更 (新 plan 立案)";
      return {
        nextState: newState,
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、**${kindLabel}** で計画を更新したよ。修正履歴 (PlanRevision) に残してあるから、後から「いつ何を変えたか」見返せるよ。\n\n**お母さん・お父さんにも変更点を伝えておいたよ** ✉️ 違和感があれば 24 時間以内に連絡くるかも。次どうする?`,
          quickReplies:
            draft.replanKind === "material-change"
              ? ["新しい計画立てる", "別の話"]
              : ["スケジュール見せて", "別の話"],
          createdAt: now,
        },
      };
    }
    if (wantsAbort || wantsDefer) {
      return {
        nextState: { ...state, proposedReplanDraft: undefined },
        reply: {
          id: makeId(),
          role: "tutor",
          text: wantsDefer
            ? "OK、保留しておくね。気が変わったらまた言って。"
            : "OK、今回は見送るね。",
          quickReplies: ["別の話", "学習を始める"],
          createdAt: now,
        },
      };
    }
  }

  // (b) 明示発話: ペース変更
  if (
    lower.includes("ペース変え") ||
    lower.includes("ペース調整") ||
    lower.includes("もっとゆっくり") ||
    lower.includes("もっと速く")
  ) {
    const activePlan = MOCK_LEARNING_PLANS.find((p) => p.status === "active");
    if (activePlan) {
      const draft = buildReplanDraft({
        plan: activePlan,
        replanKind: "pace-change",
        triggeredBy: "manual",
      });
      return {
        nextState: {
          ...state,
          proposedReplanDraft: {
            planId: activePlan.id,
            replanKind: "pace-change",
            triggeredBy: "manual",
            reason: `本人発話「${userInput.slice(0, 30)}」によるペース変更要望`,
          },
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、**ペース調整** の Replan 案を作ったよ。`,
          card: {
            kind: "replan-draft",
            planId: activePlan.id,
            planTitle: activePlan.title,
            replanKind: "pace-change",
            triggeredBy: "manual",
            proposedChange: draft.proposedChange,
            rationale: draft.rationale,
          },
          quickReplies: ["OK 反映して", "あとで", "いらない"],
          createdAt: now,
        },
      };
    }
  }

  // (b) 明示発話: 教材変更
  if (
    lower.includes("教材変え") ||
    lower.includes("教材を変") ||
    lower.includes("テキスト変え")
  ) {
    const activePlan = MOCK_LEARNING_PLANS.find((p) => p.status === "active");
    if (activePlan) {
      const draft = buildReplanDraft({
        plan: activePlan,
        replanKind: "material-change",
        triggeredBy: "manual",
      });
      return {
        nextState: {
          ...state,
          proposedReplanDraft: {
            planId: activePlan.id,
            replanKind: "material-change",
            triggeredBy: "manual",
            reason: `本人発話「${userInput.slice(0, 30)}」による教材変更`,
          },
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: `**教材変更** は計画立案やり直し相当だよ。一旦今の plan を一時停止して、新しい plan を立てる流れになる。`,
          card: {
            kind: "replan-draft",
            planId: activePlan.id,
            planTitle: activePlan.title,
            replanKind: "material-change",
            triggeredBy: "manual",
            proposedChange: draft.proposedChange,
            rationale: draft.rationale,
          },
          quickReplies: ["OK 反映して", "あとで", "いらない"],
          createdAt: now,
        },
      };
    }
  }

  // (b) 明示発話: 再計画して (種類自動判定で carry-over をデフォルト)
  if (
    lower.includes("再計画") ||
    lower.includes("リプラン") ||
    lower === "replan"
  ) {
    const activePlan = MOCK_LEARNING_PLANS.find((p) => p.status === "active");
    const delay = detectPlanDelay();
    if (activePlan) {
      const draft = buildReplanDraft({
        plan: activePlan,
        replanKind: "carry-over",
        triggeredBy: "manual",
        delayedItemCount: delay?.delayedItemCount,
      });
      return {
        nextState: {
          ...state,
          proposedReplanDraft: {
            planId: activePlan.id,
            replanKind: "carry-over",
            triggeredBy: "manual",
            reason: `本人発話「${userInput.slice(0, 30)}」による再計画要望`,
          },
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、**当月内の調整** で再計画案を作ったよ (ペースや教材を変えたい時はそう言って)。`,
          card: {
            kind: "replan-draft",
            planId: activePlan.id,
            planTitle: activePlan.title,
            replanKind: "carry-over",
            triggeredBy: "manual",
            proposedChange: draft.proposedChange,
            rationale: draft.rationale,
          },
          quickReplies: [
            "OK 反映して",
            "ペース変えたい",
            "教材変えたい",
            "あとで",
          ],
          createdAt: now,
        },
      };
    }
  }

  // C18 Phase 5 P5-Q4: NodeReviewSuggestion 3 択発話分岐
  // 冒頭で提示された Suggestion カードの quickReplies に対する応答。
  // 「復習する」/「やる」 = accept、「いらない」 = dismiss、「あとで」 = pending のまま
  const pendingForResponse = getOldestPendingSuggestion();
  if (pendingForResponse) {
    const wantsAccept =
      lower.includes("復習する") ||
      lower === "やる" ||
      lower.includes("やってみる") ||
      lower.includes("やろう") ||
      lower === "accept";
    const wantsDismiss =
      lower.includes("いらない") ||
      lower.includes("いいかな") ||
      lower.includes("やらない") ||
      lower === "dismiss";
    const wantsDefer =
      lower.includes("あとで") || lower.includes("後で考える");

    if (wantsAccept) {
      const result = acceptNodeReviewSuggestion(pendingForResponse.id);
      if (result) {
        return {
          nextState: state,
          reply: {
            id: makeId(),
            role: "tutor",
            text: `OK、**${result.parentNodeName} の復習** を今週のスケジュールに入れたよ。\n\n他のタスクが押し出されたら、carry-over で翌週に回すから安心してね。次どうする?`,
            quickReplies: [
              "スケジュール見せて",
              "学習を始める",
              "別の話",
            ],
            createdAt: now,
          },
        };
      }
    }
    if (wantsDismiss) {
      dismissNodeReviewSuggestion(pendingForResponse.id);
      return {
        nextState: state,
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、今回は見送るね。また必要そうな時に提案するよ。",
          quickReplies: ["別の話", "学習を始める"],
          createdAt: now,
        },
      };
    }
    if (wantsDefer) {
      return {
        nextState: state,
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、保留しておくね。次にゆいの chat 開いた時にまた聞くよ。",
          quickReplies: ["別の話", "学習を始める"],
          createdAt: now,
        },
      };
    }
  }

  // C21 Phase 5 P5-Q6: Plan Engine ダッシュボードを開く発話
  // 「プラン見せて」「計画一覧」「Plan Engine」 → 右ペインに /tutor?view=plans
  // 「計画立て」「計画作る」等の立案系より先置き (具体的キーワード優先)
  if (
    lower.includes("プラン見せ") ||
    lower.includes("プラン一覧") ||
    lower.includes("計画一覧") ||
    lower.includes("計画見せ") ||
    lower.includes("plan engine") ||
    lower.includes("plan-engine")
  ) {
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "**Plan Engine ダッシュボード** を右に出したよ。一覧から計画を選んで詳細見れる。新規立案は右上の [新しい計画 +] から。",
        rightPaneAction: { kind: "open-plans" },
        quickReplies: ["新しい計画立てる", "別の話"],
        createdAt: now,
      },
    };
  }

  // C17 Phase 5 P5-Q5: PlanType 明示発話分岐
  // 「計画立て」一般発話より具体的なキーワードを先にマッチ
  // 該当した PlanType を state.proposedPlanType にセットして立案開始
  const planTypeFromUtterance = detectPlanTypeFromUtterance(lower);
  if (planTypeFromUtterance) {
    const typeLabel =
      planTypeFromUtterance === "exam-prep"
        ? "試験対策"
        : planTypeFromUtterance === "weakness-grind"
          ? "苦手克服"
          : planTypeFromUtterance === "review"
            ? "復習"
            : planTypeFromUtterance === "long-term-memory"
              ? "長期記憶化"
              : "通常学習";
    return {
      nextState: {
        ...state,
        state: "plan-await-subject",
        proposedPlanType: planTypeFromUtterance,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、**${typeLabel}** の計画立てよう! まず科目から。`,
        card: {
          kind: "subject-picker",
          options: MOCK_SUBJECTS.map((s) => ({ subjectId: s.id, label: s.name })),
        },
        createdAt: now,
      },
    };
  }

  // C8: 「計画立て」「学習計画」 → 計画立案フロー開始 (subject-picker 表示)
  // chat 内完結フロー (Q11 ハイブリッド: ゆい対話 + カード)
  // C17 Phase 5: デフォルト planType: "regular-study" がセットされる
  // C21 Phase 5: 「新しい計画立てる」も同フローに入る (Plan Engine ダッシュボードからの導線)
  if (
    lower.includes("計画立て") ||
    lower.includes("計画作") ||
    lower.includes("学習計画") ||
    lower.includes("プラン作") ||
    lower.includes("新しい計画立") ||
    lower.includes("plan")
  ) {
    return {
      nextState: {
        ...state,
        state: "plan-await-subject",
        proposedPlanType: "regular-study",
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、学習計画立てよう! まず科目から。\n（教材を 3 回まわす計画を立てるよ）",
        card: {
          kind: "subject-picker",
          options: MOCK_SUBJECTS.map((s) => ({ subjectId: s.id, label: s.name })),
        },
        createdAt: now,
      },
    };
  }

  // C9: 「帰ってきた」「ただいま」「学校から帰った」「学校レポート」「学校の話」
  // → 帰宅儀式 第 1 部 (学校レポート) 開始
  if (
    lower.includes("帰ってきた") ||
    lower.includes("ただいま") ||
    lower.includes("学校から帰") ||
    lower.includes("学校レポート") ||
    lower.includes("学校の話") ||
    lower.includes("学校どうだった")
  ) {
    return {
      nextState: {
        ...state,
        state: "evening-await-period-count",
        schoolReportDraft: emptySchoolReportDraft(),
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "おかえり! まず学校の話聞かせて。\n\n**今日は何時限まで授業あった?**",
        quickReplies: ["1", "2", "3", "4", "5", "6"],
        createdAt: now,
      },
    };
  }

  // --- C8 plan-await-material: subject 選択後、教材ピッカー ---
  if (state.state === "plan-await-material") {
    const subjectId = state.proposedSubjectId ?? "subj-english";
    // 該当科目の active な教材を出す
    const materialOptions = MOCK_MATERIALS.filter(
      (m) => m.subjectId === subjectId && !m.deletedAt,
    ).map((m) => ({ materialId: m.id, label: m.name, tag: m.label }));

    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "**どの教材で進める?**",
        card: {
          kind: "material-picker",
          subjectId,
          options: materialOptions,
        },
        createdAt: now,
      },
    };
  }

  // --- C8 plan-await-duration: material 選択後、期間 + 回転数ピッカー ---
  if (state.state === "plan-await-duration") {
    const materialId = state.proposedMaterialId ?? "";
    const subjectId = state.proposedSubjectId ?? "subj-english";
    const totalPages = getMaterialTotalPages(materialId);

    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: `**全体で何ヶ月で 1 回転終わらせる? 何回転する?**\n（${getMaterialName(materialId)} は ${totalPages} ページだよ）`,
        card: {
          kind: "duration-picker",
          subjectId,
          materialId,
          totalPages,
          recommendedMonthsPerRotation: 3,
          recommendedRotations: 3,
          monthsOptions: [1, 2, 3, 4, 6, 12],
          rotationsOptions: [1, 2, 3, 4],
        },
        createdAt: now,
      },
    };
  }

  // --- C17 Phase 5 P5-Q2: plan-await-weak-nodes: 弱いノード候補ピッカー ---
  // duration 選択直後に呼ばれる。userInput="" の初回 = カード表示、
  // 確定は onPickWeakNodes ハンドラ経由で plan-await-confirm に遷移 (本ファイルは表示のみ)。
  if (state.state === "plan-await-weak-nodes") {
    const subjectId = state.proposedSubjectId ?? "subj-english";
    const candidates = computeWeakNodeCandidates();

    // 候補ゼロ = picker をスキップして plan-await-confirm に進める
    if (candidates.length === 0) {
      return {
        nextState: { ...state, state: "plan-await-confirm" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "弱いところの候補がまだ見つからなかったよ。普通に進めるね。",
          createdAt: now,
        },
      };
    }

    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: `この計画で **特に重点的に練習したいところ** はある? (なくても OK、その時は何もチェックせず確定してね)`,
        card: {
          kind: "weak-node-picker",
          subjectId,
          candidates,
        },
        createdAt: now,
      },
    };
  }

  // --- C8 plan-await-confirm: duration 選択後、roadmap-preview を出す ---
  // 初回 (onPickDuration から userInput="" で呼ばれる): roadmap-preview を初期表示
  // 2 回目以降 (ユーザー発話): 「OK」で確定 / 「ゆっくり」「速く」で duration に戻る
  if (state.state === "plan-await-confirm") {
    const monthsPerRotation = state.proposedMonthsPerRotation ?? 3;
    const rotations = state.proposedRotations ?? 3;
    const subjectId = state.proposedSubjectId ?? "subj-english";
    const materialId = state.proposedMaterialId ?? "";

    // 初回 表示パス: userInput が空 (onPickDuration ハンドラ経由)
    if (lower === "") {
      const totalPages = getMaterialTotalPages(materialId);
      const monthlyRoadmap = buildRoadmapFromInputs({
        startDate: new Date(),
        totalPages,
        monthsPerRotation,
        rotations,
      });
      return {
        nextState: state,
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、${monthsPerRotation} ヶ月 × ${rotations} 回転で計画作ってみた、見て!`,
          card: {
            kind: "roadmap-preview",
            subjectId,
            materialId,
            materialName: getMaterialName(materialId),
            totalPages,
            monthsPerRotation,
            rotations,
            startDate: formatLocalDate(new Date()),
            monthlyRoadmap,
          },
          quickReplies: ["これで OK", "もう少しゆっくり", "もう少し速く"],
          createdAt: now,
        },
      };
    }

    // 2 回目以降: ユーザー発話を判定
    const wantsConfirm =
      lower.includes("ok") ||
      lower.includes("これで") ||
      lower.includes("決定") ||
      lower.includes("これでいい") ||
      lower.includes("これがいい");
    const wantsSlower =
      lower.includes("ゆっくり") || lower.includes("もう少し時間");
    const wantsFaster = lower.includes("速く") || lower.includes("早く");

    if (wantsSlower || wantsFaster) {
      // duration-picker に戻す (推奨値を 1 段調整)
      const newMonths = wantsSlower
        ? Math.min(monthsPerRotation + 1, 12)
        : Math.max(monthsPerRotation - 1, 1);
      return {
        nextState: {
          ...state,
          state: "plan-await-duration",
          proposedMonthsPerRotation: newMonths,
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: wantsSlower
            ? `OK、もう少しゆっくりめで作り直すね。1 回転を **${newMonths} ヶ月** にしてみる?`
            : `OK、もう少し速めで作り直すね。1 回転を **${newMonths} ヶ月** にしてみる?`,
          card: {
            kind: "duration-picker",
            subjectId: state.proposedSubjectId ?? "subj-english",
            materialId: state.proposedMaterialId ?? "",
            totalPages: getMaterialTotalPages(state.proposedMaterialId ?? ""),
            recommendedMonthsPerRotation: newMonths,
            recommendedRotations: rotations,
            monthsOptions: [1, 2, 3, 4, 6, 12],
            rotationsOptions: [1, 2, 3, 4],
          },
          createdAt: now,
        },
      };
    }

    if (wantsConfirm) {
      // 確定: LearningPlan を MOCK に push + 当月分を ScheduleItem に展開
      // C17 Phase 5: planType / weakNodeIds を state から引き継いで反映
      const plan = derivePlanFromInputs({
        subjectId,
        materialId,
        monthsPerRotation,
        rotations,
        startDate: new Date(),
        planType: state.proposedPlanType ?? "regular-study",
        weakNodeIds: state.proposedWeakNodeIds ?? [],
      });
      const month = currentMonth();
      const expanded = expandPlanMonth(plan, month);

      const weakNoteSuffix =
        (state.proposedWeakNodeIds?.length ?? 0) > 0
          ? `\n\n**弱いところ** に登録した ${state.proposedWeakNodeIds!.length} 件は、Plan Engine が drill / review を多めに入れて重点的に練習するよ。`
          : "";

      return {
        nextState: {
          ...state,
          state: "plan-done",
          confirmedLearningPlanId: plan.id,
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: `OK、計画決まったよ！\n\n**${plan.title}** を作って、**${month} の分 ${expanded.length} 件** を今のスケジュールに出しておいたね。${weakNoteSuffix}\n\n**お母さん・お父さんにも伝えておいたよ** ✉️ もし「これは違うかな」って思うところがあれば、24 時間以内にお母さんからゆいに連絡くるね。それまではこの計画でいつでも始めて OK だよ。\n\n来月以降は月初に同じように展開していくよ。次どうする?`,
          quickReplies: ["スケジュール見せて", "学習を始める", "別の話"],
          createdAt: now,
        },
      };
    }

    // OK でも調整でもない発話 = ユーザーが roadmap を見て考え中
    // → roadmap-preview を再表示 (or quickReplies で誘導)
    return {
      nextState: state,
      reply: {
        id: makeId(),
        role: "tutor",
        text: "どうする? 上のロードマップでよさそうなら「OK」、もう少し変えたいなら「ゆっくり」か「速く」を教えて。",
        quickReplies: ["これで OK", "もう少しゆっくり", "もう少し速く"],
        createdAt: now,
      },
    };
  }

  // ========================================================================
  // C9 帰宅儀式 第 1 部 — 学校レポート (時限別シーケンシャル)
  // ========================================================================

  // --- evening-await-period-count: 時限数 (1-6) を受け取って各時限へ ---
  if (state.state === "evening-await-period-count") {
    const periodCount = extractPeriodCount(userInput);
    if (periodCount === null) {
      // 数値が抽出できない → 再質問
      return {
        nextState: state,
        reply: {
          id: makeId(),
          role: "tutor",
          text: "1 から 6 の数字で教えてくれる? 今日の時限数。",
          quickReplies: ["1", "2", "3", "4", "5", "6"],
          createdAt: now,
        },
      };
    }
    const draft = state.schoolReportDraft ?? emptySchoolReportDraft();
    return {
      nextState: {
        ...state,
        state: "evening-await-period-subject",
        schoolReportDraft: {
          ...draft,
          periodCount,
          periods: Array.from({ length: periodCount }, () => ({})),
          currentPeriodIndex: 0,
        },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、${periodCount} 時限ね。\n\n**1 時限目は何の科目?**`,
        quickReplies: SCHOOL_SUBJECT_QUICK_REPLIES,
        createdAt: now,
      },
    };
  }

  // --- evening-await-period-subject: N 時限目の科目を保存して content へ ---
  if (state.state === "evening-await-period-subject") {
    const draft = state.schoolReportDraft ?? emptySchoolReportDraft();
    const idx = draft.currentPeriodIndex;
    const newPeriods = [...draft.periods];
    newPeriods[idx] = { ...newPeriods[idx], subject: userInput };
    return {
      nextState: {
        ...state,
        state: "evening-await-period-content",
        schoolReportDraft: { ...draft, periods: newPeriods },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `**${userInput} で何習った?**\n\n（短くて OK、覚えてる範囲で）`,
        createdAt: now,
      },
    };
  }

  // --- evening-await-period-content: N 時限目の内容を保存して次の時限 or extraEvents へ ---
  if (state.state === "evening-await-period-content") {
    const draft = state.schoolReportDraft ?? emptySchoolReportDraft();
    const idx = draft.currentPeriodIndex;
    const newPeriods = [...draft.periods];
    newPeriods[idx] = { ...newPeriods[idx], content: userInput };
    const nextIndex = idx + 1;
    const periodCount = draft.periodCount ?? 0;

    if (nextIndex >= periodCount) {
      // 全時限完了 → extraEvents へ
      return {
        nextState: {
          ...state,
          state: "evening-await-extra-events",
          schoolReportDraft: {
            ...draft,
            periods: newPeriods,
            currentPeriodIndex: nextIndex,
          },
        },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "全時限聞けた! ありがとう。\n\n**他に学校で起こったこと、相談したいことある?**\n\n（なければ「特にない」で OK）",
          quickReplies: ["特にない", "話したい事ある"],
          createdAt: now,
        },
      };
    }

    // 次の時限へ
    return {
      nextState: {
        ...state,
        state: "evening-await-period-subject",
        schoolReportDraft: {
          ...draft,
          periods: newPeriods,
          currentPeriodIndex: nextIndex,
        },
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、覚えといたよ。\n\n**${nextIndex + 1} 時限目は何の科目?**`,
        quickReplies: SCHOOL_SUBJECT_QUICK_REPLIES,
        createdAt: now,
      },
    };
  }

  // --- evening-await-extra-events: extraEvents を保存して SchoolDailyReport 確定 ---
  // C10: 第 1 部完了後、第 2 部 (スケジュール確定) へ自動遷移
  if (state.state === "evening-await-extra-events") {
    const draft = state.schoolReportDraft ?? emptySchoolReportDraft();
    const hasExtra =
      !lower.includes("特にない") &&
      !lower.includes("ない") &&
      !lower.includes("なし") &&
      lower.length > 0;
    const finalDraft: SchoolReportDraft = {
      ...draft,
      extraEvents: hasExtra ? userInput : undefined,
    };
    // SchoolDailyReport 確定 push
    const report = deriveSchoolDailyReport(finalDraft);

    // C10: 今日のスケジュール (plan + carry-over) を集めて today-schedule カードを出す
    const today = formatLocalDate(new Date());
    const todayItems = MOCK_SCHEDULE_TODAY.filter((s) => s.date === today);

    return {
      nextState: {
        ...state,
        state: "evening-show-schedule",
        schoolReportDraft: finalDraft,
        confirmedSchoolReportId: report.id,
      },
      reply: {
        id: makeId(),
        role: "tutor",
        text:
          (hasExtra
            ? "OK、覚えといたよ、それも。\n\n**今日の学校レポート、書いておいたよ。**\n\n"
            : "OK、じゃあ学校の話はここまで。\n\n**今日の学校レポート、書いておいたよ。**\n\n") +
          `じゃあ今日のスケジュール確認しよう。\n計画と繰り越しから ${todayItems.length} 件あるね。\n\n**他に学校から宿題とか課題、出てない?**`,
        card: {
          kind: "today-schedule",
          scheduleItemIds: todayItems.slice(0, 5).map((i) => i.id),
          seeAllLabel: "スケジュールを全部見る",
        },
        quickReplies: ["特にない (始める)", "宿題出た", "提出物ある", "テスト発表あった"],
        createdAt: now,
      },
    };
  }

  // --- evening-show-schedule: 「特にない」で確定、それ以外で ad-hoc 入力へ ---
  if (state.state === "evening-show-schedule") {
    const noMoreTasks =
      lower.includes("特にない") ||
      lower.includes("ないかな") ||
      lower.includes("始める") ||
      lower.includes("はじめる");
    if (noMoreTasks) {
      return {
        nextState: { ...state, state: "evening-finalize" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、今日はこれで全部だね。\n\n**いい感じ、開始しよう!** どれからやる?",
          quickReplies: ["学習を始める", "課題見せて", "別の話"],
          createdAt: now,
        },
      };
    }
    // ad-hoc タスク入力へ。何の種類か推定するため userInput を見てタグを暫定設定
    const inferredTag = inferTaskTagFromHint(userInput);
    return {
      nextState: { ...state, state: "evening-await-task-text" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、${inferredTag}だね。**内容と期限を教えて。**\n\n例:「数学プリント p.20-25、明日まで」みたいな感じで一文で OK。`,
        createdAt: now,
      },
    };
  }

  // --- evening-await-task-text: ad-hoc タスクを ScheduleItem に追加 ---
  if (state.state === "evening-await-task-text") {
    const tag = inferTaskTagFromHint(userInput);
    addAdHocScheduleItem(userInput, tag);
    return {
      nextState: { ...state, state: "evening-await-more-tasks" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: `OK、「${userInput.slice(0, 30)}${userInput.length > 30 ? "…" : ""}」を **「${tag}」** タグで今日のスケジュールに入れたよ。\n\n**もう 1 件ある?**`,
        quickReplies: ["もう 1 件ある", "もうない (始める)"],
        createdAt: now,
      },
    };
  }

  // --- evening-await-more-tasks: もう 1 件 or 確定 ---
  if (state.state === "evening-await-more-tasks") {
    const hasMore =
      lower.includes("もう 1 件") ||
      lower.includes("ある") && !lower.includes("ない");
    if (hasMore) {
      return {
        nextState: { ...state, state: "evening-show-schedule" },
        reply: {
          id: makeId(),
          role: "tutor",
          text: "OK、何が出たか教えて。",
          quickReplies: ["宿題出た", "提出物ある", "テスト発表あった"],
          createdAt: now,
        },
      };
    }
    // 確定
    return {
      nextState: { ...state, state: "evening-finalize" },
      reply: {
        id: makeId(),
        role: "tutor",
        text: "OK、今日はこれで全部だね。\n\n**いい感じ、開始しよう!** どれからやる?",
        quickReplies: ["学習を始める", "課題見せて", "別の話"],
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
          options: MOCK_SUBJECTS.map((s) => ({ subjectId: s.id, label: s.name })),
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

// Phase 6 smoke test: NEXT_PUBLIC_USE_CLAUDE_API=true のときに「計画立てよう」入口の
// 1 発話だけ Claude Opus 4.7 で生成する async wrapper。matchesPlanRequest 以外は
// 既存の同期 buildNextTutorReply に委譲、Claude 呼び出し失敗時も mock に fallback する。
// 既存同期関数を破壊しない並走方式 — caller (TutorWorkspace) だけが await に切替わる。
export async function buildNextTutorReplyAsync(args: {
  state: TutorStep;
  userInput: string;
}): Promise<{ reply: TutorMessage; nextState: TutorStep }> {
  const useClaude = process.env.NEXT_PUBLIC_USE_CLAUDE_API === "true";
  if (!useClaude) return buildNextTutorReply(args);

  const lower = args.userInput.toLowerCase().trim();
  const matchesPlanRequest =
    lower.includes("計画立て") ||
    lower.includes("計画作") ||
    lower.includes("学習計画") ||
    lower.includes("プラン作") ||
    lower.includes("新しい計画立") ||
    lower.includes("plan");

  if (!matchesPlanRequest) return buildNextTutorReply(args);

  try {
    const claudeText = await tutorClaudeRespondToPlanRequest(args.userInput);
    const now = new Date().toISOString();
    const reply: TutorMessage = {
      id: makeId(),
      role: "tutor",
      text: claudeText,
      card: {
        kind: "subject-picker",
        options: MOCK_SUBJECTS.map((s) => ({
          subjectId: s.id,
          label: s.name,
        })),
      },
      createdAt: now,
    };
    reply.topic = deriveTutorTopic("plan-await-subject", reply.rightPaneAction);
    return {
      nextState: {
        ...args.state,
        state: "plan-await-subject",
        proposedPlanType: "regular-study",
      },
      reply,
    };
  } catch (err) {
    console.error(
      "[Phase 6 smoke test] Claude call failed, fallback to mock:",
      err,
    );
    return buildNextTutorReply(args);
  }
}
