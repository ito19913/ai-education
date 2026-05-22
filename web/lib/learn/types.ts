/**
 * /learn 画面で使う型定義。
 * MVP のモック段階。サーバー DB スキーマと一致させるかは後で詰める。
 */

export type KnowledgeNode = {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
};

/** ノードごとに分離されたチャットメッセージ */
export type ChatMessage = {
  id: string;
  nodeId: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string; // ISO
};

/** ノード 1 つに対する AI 生成ノート（編集可） */
export type Note = {
  nodeId: string; // 1:1 対応
  content: string; // マークダウンっぽいテキスト
  updatedAt: string;
};

/**
 * @deprecated Issue (source: "self") に統合済み。
 * 既存コードの段階的移行のため type alias を残す。
 */
export type Memo = {
  id: string;
  nodeId: string;
  content: string;
  resolved: boolean;
  createdAt: string;
};

// ============================================================================
// 課題（Issue）— イシュードリブン思考の中核
// ============================================================================

/**
 * 発生源:
 *   - "self": 本人が「これ分からない」と立てたもの（旧 Memo）
 *   - "ai-detected": AI が会話の中で「理解に達してない」と検知したもの
 */
export type IssueSource = "self" | "ai-detected";

export type IssueStatus = "open" | "resolved";

/** 1 件の課題に対する「発生」。同じトピックが複数回出た時に蓄積する。 */
export type IssueOccurrence = {
  id: string;
  detectedAt: string; // ISO
  /** どのセッションで発生したか */
  sessionId?: string;
  /** AI 検知の根拠となったチャットメッセージ ID（あれば）*/
  triggerMessageId?: string;
  /** 発生時の状況メモ */
  description: string;
  source: IssueSource;
};

/** 課題本体 */
export type Issue = {
  id: string;
  /** どの論点（KnowledgeNode）の課題か */
  nodeId: string;
  /** 初回の発生源 */
  source: IssueSource;
  /** 1 行タイトル */
  title: string;
  /** 詳細（省略可） */
  detail?: string;
  status: IssueStatus;
  createdAt: string;
  resolvedAt?: string;
  /** AI が「もうクリアして良さそう」と判定した場合の提案 */
  aiSuggestedClear?: boolean;
  aiSuggestedClearReason?: string;
  /** 発生履歴。複数回発生した時に蓄積される */
  occurrences?: IssueOccurrence[];
};

/**
 * セッション終了時に AI が提示する「課題候補」（採用前）。
 * 本人がチェックしたものだけが Issue として登録される。
 */
export type IssueCandidate = {
  id: string;
  nodeId: string;
  title: string;
  detail?: string;
  /** AI 検知の根拠となったチャットメッセージ ID */
  triggerMessageId?: string;
  /** AI が「これ既存の課題と同じトピックでは？」と判定した場合の候補 */
  suggestedLinkIssueId?: string;
};

// ============================================================================
// 学習スケジュール — 時間軸の集約画面
//
// 4 種類のタスクが時間軸上に並ぶ:
//   - issue: 既存の Issue を「今日掘る対象」として配置
//   - lesson-review: 今日の授業で学んだ内容を復習するタスク
//   - exam-prep: 試験対策プロジェクトの「今日の分」
//   - homework: 宿題プロジェクトの「今日の分」
//
// 統合モデルではなく、各 source は独自の型を持つ。日々のタスクは
// 「ScheduleItem」として、source への参照を持つ軽い view-model になる。
// ============================================================================

export type StudyTaskType =
  | "issue"
  | "lesson-review"
  | "exam-prep"
  | "homework";

export type StudyTaskStatus = "todo" | "doing" | "done" | "skipped";

/** ダッシュボードに並ぶ「今日のタスク」1 件 */
export type ScheduleItem = {
  id: string;
  /** 何の派生か（issue / lesson-review / exam-prep / homework） */
  type: StudyTaskType;
  /** 元 source の id（issue.id, examPrep.id, homework.id, lessonReview.id） */
  sourceId: string;
  /** 関連する KnowledgeNode（あれば） */
  nodeId?: string;
  /** タイトル（一行） */
  title: string;
  /** 詳細 */
  detail?: string;
  /** どの日に配置されているか (YYYY-MM-DD, ローカル日付) */
  date: string;
  /** 見積もり時間（分）*/
  estimateMinutes?: number;
  status: StudyTaskStatus;
  /** AI がこのタスクを「今日入れた方が良い」と提案している理由 */
  aiRationale?: string;
  /** 完了時刻 ISO */
  doneAt?: string;
};

/** 試験対策プロジェクト（範囲を期日までに詰める器） */
export type ExamPrep = {
  id: string;
  subjectId: string;
  /** 試験名（中間試験、第1回 定期テスト 等） */
  name: string;
  /** 試験日 (YYYY-MM-DD) */
  examDate: string;
  /** 範囲: ノード ID 群（体系図ベース） */
  scopeNodeIds: string[];
  /** 範囲補足: ページ表記等 */
  pageRangeNote?: string;
  /** 関連する教材 ID（オプション）*/
  materialIds?: string[];
  /** AI と対話して立てた計画の根拠サマリー（chat の最終出力）*/
  planSummary?: string;
  createdAt: string;
};

/** 宿題プロジェクト */
export type Homework = {
  id: string;
  subjectId: string;
  /** 宿題名（数学ワーク p.20-25、英語プリント 等） */
  name: string;
  /** 提出日 (YYYY-MM-DD) */
  dueDate: string;
  /** 関連する教材 ID（オプション）*/
  materialIds?: string[];
  /** 問題数や量の補足 */
  amountNote?: string;
  createdAt: string;
};

/** 授業復習タスク（その日の授業で学んだ内容） */
export type LessonReview = {
  id: string;
  subjectId: string;
  /** 授業日 (YYYY-MM-DD) */
  lessonDate: string;
  /** 何を学んだか（本人入力 or AI 推定） */
  topic: string;
  /** 紐づくノード（あれば）*/
  nodeIds?: string[];
  createdAt: string;
};

// ============================================================================
// 担任の先生（チューター） chat — アプリの「顔」
//
// アーキテクチャの 2 層:
//   - Tutor (担任): 1 人。生活と学習の総合アドバイザー。ログイン後の最初。
//   - Subject Teacher (科目の先生): 教科ごと。/learn の DialogPane で会話。
//
// 担任は時系列に長いスレッドを持つ。日々の挨拶・気分・予定相談・
// 振り返りなどがここに溜まる。リッチカード（教科選択・教材選択・体系図プレビュー
// ・開始ボタン）が会話の流れに合わせて埋め込まれる。
// ============================================================================

/** 担任 chat メッセージの送信者 */
export type TutorRole = "tutor" | "learner";

/**
 * 担任メッセージに埋め込まれるリッチ UI 部品。
 * Phase 2 mock では subject-picker / material-picker / range-preview /
 * start-study の 4 種類。今後 issue-list / today-tasks / homework-progress
 * など足していく想定。
 */
export type TutorCard =
  | {
      kind: "subject-picker";
      /** 選んだ subjectId が次のターンで使われる */
      options: Array<{ subjectId: string; label: string }>;
      /** 確定後にハイライトする選択結果 */
      selectedSubjectId?: string;
    }
  | {
      kind: "material-picker";
      subjectId: string;
      options: Array<{ materialId: string; label: string; tag: string }>;
      selectedMaterialId?: string;
    }
  | {
      kind: "range-preview";
      /** 体系図のうち、今日の学習範囲としてハイライトするノード ID */
      highlightNodeIds: string[];
      /** ノートの「ここから」の入口ノード */
      entryNodeId: string;
      /** 全体のスコープ（材料の coveredNodeIds 等） */
      scopeNodeIds: string[];
      /** 範囲の人間向け説明 */
      humanLabel: string;
    }
  | {
      kind: "start-study";
      /** 学習画面に遷移する時に渡す ?node= の値 */
      entryNodeId: string;
      /** 体系図 復元テストをトリガーするか */
      withReconstruction: boolean;
      /** ボタンのラベル */
      label: string;
    };

/** 担任 chat の 1 メッセージ */
export type TutorMessage = {
  id: string;
  role: TutorRole;
  /** プレーンテキスト本文（マークダウン軽め） */
  text?: string;
  /** 埋め込みカード（最大 1 つ）*/
  card?: TutorCard;
  /** AI 側が提示する「クイック返信チップ」候補 */
  quickReplies?: string[];
  createdAt: string;
};

/** 担任 chat スレッド全体 */
export type TutorThread = {
  /** learner ごとに 1 つ。MVP は固定 1 件 */
  id: string;
  learnerId: string;
  messages: TutorMessage[];
};

export type LearnSubject = {
  name: string;
  unitName: string;
  pageRange: string;
};

export type CurrentUser = {
  displayName: string;
  role: "admin" | "learner";
};

/** 教材のラベル（種類） */
export type MaterialLabel = "テキスト" | "問題集" | "副教材";

/** 教材（教科書 PDF など 1 冊 1 教材） */
export type Material = {
  id: string;
  subjectId: string;
  name: string;
  label: MaterialLabel;
  /** 学年（'中1' | '中2' | '中3' | '高1' ... など、任意） */
  gradeLevel?: string;
  /** この教材が扱う体系図ノードの ID 群（教材ビュー表示用） */
  coveredNodeIds: string[];
  /** 論理削除日時 (ISO)。undefined = アクティブ、値あり = ゴミ箱に入っている */
  deletedAt?: string;
};

/** 科目（英語、数学など） */
export type Subject = {
  id: string;
  name: string;
};

// ============================================================================
// テスト機能（悪い癖の強制矯正システム）の型
// ============================================================================

/** 5 観点フィードバック分類（哲学に直結） */
export type DiagnosisCategory =
  | "vague-word" // 言葉が曖昧だった
  | "not-understood" // 理解していなかった
  | "not-organized" // 整理できていなかった
  | "no-howto" // 使い方を知らなかった
  | "missed-cue"; // 気づかなかった

export const DIAGNOSIS_LABELS: Record<DiagnosisCategory, string> = {
  "vague-word": "言葉が曖昧だった",
  "not-understood": "理解していなかった",
  "not-organized": "整理できていなかった",
  "no-howto": "使い方を知らなかった",
  "missed-cue": "気づかなかった",
};

/** 問題（多肢選択） */
export type Question = {
  id: string;
  /** どの論点（KnowledgeNode）を問う問題か */
  nodeId: string;
  /** 問題文 */
  prompt: string;
  /** 選択肢（4 つ想定） */
  choices: string[];
  /** 正解の choices インデックス */
  correctIndex: number;
  /** 解説 */
  explanation: string;
};

/** 自己評価: 答えを思い出した？ それともツールを使った？ */
export type SelfEvaluationResult = "recalled" | "tool-used";

// ============================================================================
// 学習セッション履歴
// ============================================================================

export type SessionEndReason =
  | "manual"
  | "auto-idle"
  | "auto-day-change"
  | "browser-close";

export type LearningSession = {
  id: string;
  learnerId: string;
  /** 開始時刻 ISO */
  startedAt: string;
  /** 終了時刻 ISO。undefined = active */
  endedAt?: string;
  endReason?: SessionEndReason;
  /** 訪れたノード（時系列、重複可） */
  visitedNodeIds: string[];
  /** チャットの user 発話数 */
  messageCount: number;
  /** ノートを編集した回数 */
  noteEditCount: number;
  /** 体系図 復元テストの結果（任意） */
  reconstructionResult?: {
    correctCount: number;
    totalCount: number;
  };
  /** AI が生成した学習まとめ（学んだこと + 疑問点） */
  summary?: {
    learned: string[];
    questions: string[];
  };
  /** どの科目を学習したか（集計用） */
  subjectId?: string;
  /** AI 理解度判定: 0..1。低いほど浅い、null = 未判定 */
  comprehensionScore?: number;
};

/** ノード単位の AI 理解度判定 */
export type NodeComprehension = {
  nodeId: string;
  score: number; // 0..1
  /** AI が判定した根拠の短いコメント */
  reason: string;
  /** 浅い場合、推奨される戻り先ノード（親ノード等） */
  suggestedNodeId?: string;
};

// ============================================================================
// 教材登録（admin）の型
// ============================================================================

/** AI が PDF から抽出したノード候補（監修前） */
export type AiExtractedNode = {
  tempId: string;
  /** AI が提案する名前 */
  name: string;
  /** 親候補（tempId or 既存ノード ID） */
  parentRef: string | null;
  /** AI が生成した説明 */
  description: string;
  /** 教材内の該当ページ範囲（例: "p.42-45"） */
  pageRange: string;
  /** 既存体系図ノードに合致した場合の ID（null なら新規候補） */
  matchedNodeId: string | null;
  /** 信頼度（0-1、mock では固定） */
  confidence: number;
  /** 監修ステータス */
  reviewStatus: "pending" | "approved" | "rejected" | "edited";
};

/** 教材登録ウィザードの入力データ */
export type MaterialDraft = {
  name: string;
  subjectId: string;
  label: MaterialLabel;
  gradeLevel: string;
  fileName: string | null;
  fileSize: number | null;
};

// 後方互換: 古い名前を残す（既存コードを徐々に移行する間に使う）
export type DialogMessage = ChatMessage;
export type ToolCard = {
  id: string;
  nodeId: string;
  whatDoes: string;
  whenToUse: string;
  example: string;
  relatedNotes: string;
};
