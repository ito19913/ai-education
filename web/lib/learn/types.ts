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
  /** AI 発の場合の検知元 ChatMessage ID（初手の trigger-message-quote カードに使う）*/
  triggerMessageId?: string;
  /** 課題ごとに独立した chat スレッド（Phase 3）。クリア後も readonly で残す */
  chatThread?: IssueChatMessage[];
  /** 科目の先生 → ゆい先生 への引継ぎサマリー（Phase 6 で自動生成、Phase 3 は手書き mock）*/
  summary?: string;
};

// 課題 chat（Phase 3）
// ノード対話とは別に、Issue 1 件ごとに独立した chat スレッドを持つ。
// 担当 AI は科目の先生（既存 DialogPane と同 persona）。
// 1 本の長いスレッドが日をまたいで蓄積し、クリアまで継続する。

export type IssueChatRole = "teacher" | "learner";

/** 課題 chat メッセージに埋め込めるリッチカード */
export type IssueChatCard =
  | {
      kind: "trigger-message-quote";
      /** 引用元 ChatMessage の ID */
      sourceMessageId: string;
      sourceNodeId: string;
      /** メッセージ本文（コピーで保持。元が消えても表示可）*/
      quote: string;
      sourceCreatedAt: string;
    }
  | {
      kind: "resolve-suggestion";
      /** 「もうクリアして良さそう」の理由 */
      reason?: string;
    };

/** 課題 chat の 1 メッセージ（TutorMessage を雛形にした新型）*/
export type IssueChatMessage = {
  id: string;
  issueId: string;
  role: IssueChatRole;
  text?: string;
  card?: IssueChatCard;
  /** AI 側が提示するクイック返信チップ候補 */
  quickReplies?: string[];
  createdAt: string;
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

/**
 * Phase 4 拡張: ScheduleItem の出処を識別 (Q7 確定)。
 * - "plan"       = LearningPlan の月次バッチ展開で生成された分
 * - "carry-over" = 前日できなかった繰り越し
 * - "ad-hoc"     = 帰宅儀式で当日追加された突発タスク
 */
export type ScheduleItemSource = "plan" | "carry-over" | "ad-hoc";

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

  // === Phase 4 追加 (Q7) ===
  /**
   * 自由タグ（「宿題」「提出物」「テスト範囲」「親に頼まれた」等）。
   * 帰宅儀式で ad-hoc 追加された ScheduleItem に AI 提案 + 本人選択で付与される。
   */
  tags?: string[];
  /**
   * 出処識別。既存 mock は optional のままで「未指定 = "plan" 相当」と扱う。
   * Phase 4 UI 実装で計画展開 / 繰り越し / 突発を厳密に区別する時に活用。
   */
  source?: ScheduleItemSource;

  // === Phase 5 追加 (P5-Q1: GT × SI 並走 + 紐付け) ===
  /**
   * 元の GeneratedTask.id への参照。
   * source: "plan" の SI ではほぼ全て埋まる (1 GT : 1 SI、月初 expansion で生成)。
   * source: "ad-hoc" (帰宅儀式) / "carry-over" (前日繰越) では null。
   *
   * 完了同期: SI を done にすると GT.status も done に同期 (Plan 全体進捗に反映)。
   */
  generatedTaskId?: string;
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

/**
 * 担任 chat メッセージの送信者。
 * - tutor: ゆい先生 (左寄せ吹き出し)
 * - learner: 本人 (右寄せ吹き出し)
 * - section: 話題セクションのヘッダー (中央寄せ区切り線 + ラベル、Phase 3 拡張)
 */
export type TutorRole = "tutor" | "learner" | "section";

/**
 * 担任 chat の「話題」分類（Phase 3 拡張）。
 * 1 日 1 chat の中で複数話題が登場するので、ヘッダーで区切る + アーカイブで
 * フィルタするためにメッセージにタグを付ける。
 */
export type TutorTopic =
  | "morning-reflection" // 朝の振り返り (昨日 / 学校 / 気分 / 疑問 / 計画)
  | "excavation" // 掘り起こし (「分からない」を言語化)
  | "issue-check" // 課題を確認
  | "schedule-check" // スケジュールを確認
  | "history-check" // 学習履歴を確認
  | "reflection-check" // 振り返りログを確認 (C4: ReflectionLog 一覧)
  | "material-add" // 教材を追加
  | "subject-history" // 科目の先生 対話履歴を見る
  | "start-study" // 学習開始フロー (教科→教材→範囲→開始)
  | "ending" // 学習終了 (思いつき発話 → 要約 → 確認 → 終了)
  | "free-chat"; // 上記いずれでもない自由会話 (デフォルト)

/**
 * 担任メッセージに埋め込まれるリッチ UI 部品。
 * Phase 2 mock では subject-picker / material-picker / range-preview /
 * start-study の 4 種類。Phase 3 で issue-list / today-schedule を追加。
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
    }
  | {
      kind: "issue-list";
      /** カードに並べる未クリア課題の ID（最大 5 件想定）*/
      issueIds: string[];
      /** 「全部見る」CTA のラベル */
      seeAllLabel: string;
    }
  | {
      kind: "today-schedule";
      /** 今日のタスクの ScheduleItem ID（時刻順）*/
      scheduleItemIds: string[];
      /** 「全部見る」CTA のラベル */
      seeAllLabel: string;
    }
  | {
      /** Phase 4 C8: 計画立案フロー - 期間 + 回転数の選択カード */
      kind: "duration-picker";
      subjectId: string;
      materialId: string;
      /** 教材総ページ */
      totalPages: number;
      /** AI 推奨 (例: 「3 ヶ月で 1 回転 × 3 回 = 9 ヶ月」) */
      recommendedMonthsPerRotation: number;
      recommendedRotations: number;
      /** 選択肢: 月数 (1 回転あたり) */
      monthsOptions: number[];
      /** 選択肢: 回転数 */
      rotationsOptions: number[];
    }
  | {
      /** Phase 4 C8: 計画立案フロー - AI 生成 roadmap の確認カード */
      kind: "roadmap-preview";
      subjectId: string;
      materialId: string;
      materialName: string;
      totalPages: number;
      monthsPerRotation: number;
      rotations: number;
      startDate: string; // YYYY-MM-DD
      /** 月別 roadmap (PlanSegment 相当だが card 用にシンプル化) */
      monthlyRoadmap: Array<{
        month: string;
        targetPages: number;
        startPage?: number;
        endPage?: number;
      }>;
    }
  | {
      /**
       * Phase 5 P5-Q2 確定: 計画立案フロー - 弱いノード候補ピッカー。
       * subject → material → duration の後、roadmap-preview の前に挟む。
       * Plan Engine が候補抽出 (Issue open + 最近 7 日 + NodeComprehension<0.55)
       * したものを表示、本人がチェックで weakNodeIds を確定する。
       */
      kind: "weak-node-picker";
      subjectId: string;
      /** 候補ノード (1 件 = 1 つの weak node 候補) */
      candidates: Array<{
        nodeId: string;
        nodeName: string;
        /** AI の所感: なぜ弱いと判断したか (Issue title or NodeComprehension reason) */
        reason: string;
        /** 抽出ソース */
        source: "issue" | "comprehension" | "both";
        /** デフォルトでチェック済みにするか (推奨度高い) */
        preChecked: boolean;
      }>;
    }
  | {
      /**
       * Phase 5 P5-Q4 確定: 上ノード復習提案カード。
       * NodeComprehension 低下検出 or テスト失敗 (failureAction: "review-parent")
       * 時に生成された NodeReviewSuggestion を、ゆい chat 冒頭で 3 択提示する。
       *
       * accept → 復習 GT 生成 (mode: "review", nodeId: parentNodeId) → 即時 SI 挿入
       * dismiss → status: "dismissed"
       * deferred → pending のまま、次セッションで再提示
       */
      kind: "node-review-suggestion";
      /** 対象 NodeReviewSuggestion.id */
      suggestionId: string;
      /** 失敗した子ノード名 (例: 「副詞的用法」) */
      failedNodeName: string;
      /** 戻る先の親ノード名 (例: 「不定詞」) */
      parentNodeName: string;
      /** ゆいの所感 (なぜ戻った方がいいか) */
      reason: string;
    }
  | {
      /** Phase 3 拡張: 「あの話したよね?」検索ヒット候補のリスト */
      kind: "chat-search-result";
      /** AI が抽出 or 本人が指定したクエリ */
      query: string;
      /** ヒット候補（最大 5 件想定、クリックでアーカイブにジャンプ） */
      results: Array<{
        date: string;
        messageId: string;
        topic?: TutorTopic;
        role: TutorRole;
        snippet: string;
      }>;
    };

/**
 * 担任メッセージから右ペインを切り替えるアクション（Phase 3）。
 * カードの button click や quickReplies のクリックで発火し、
 * TutorWorkspace 側で URL を /tutor?view=... に push する。
 */
export type TutorRightPaneAction =
  | { kind: "open-issues" }
  | { kind: "open-issue"; issueId: string }
  | { kind: "open-schedule" }
  | { kind: "open-history" }
  | { kind: "open-reflections" } // C4: ReflectionLog 一覧
  | { kind: "open-weekly-report" } // C11 Phase 4: 週次レポート
  | { kind: "open-monthly-report" } // C11 Phase 4: 月次レポート
  | { kind: "open-material-new" }
  | { kind: "open-subject-history"; subjectId: string }
  | { kind: "open-tutor-archive" }
  | { kind: "close" };

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
  /** このメッセージ送信時に右ペインを切り替えるアクション（Phase 3）*/
  rightPaneAction?: TutorRightPaneAction;
  /**
   * このメッセージの話題タグ（Phase 3 拡張）。
   * tutor / section ロールで設定。learner ロールは直前の tutor message から継承。
   * 話題が切り替わると TutorWorkspace 側で section ロールのヘッダー
   * メッセージが自動挿入される。
   */
  topic?: TutorTopic;
  createdAt: string;
};

/**
 * /tutor 右ペインの表示状態（URL `?view=` のパース・構築で再利用）。
 * - default: 空 or 今日のサマリー
 * - issues: 課題一覧（コア IssueListView）
 * - issue: 単一課題の chat（IssueChat、id クエリで指定）
 * - schedule: 今日のスケジュール（コア ScheduleDashboard）
 * - history: 学習履歴（コア HistoryView）
 * - material-new: 新規教材登録ウィザード（コア MaterialEditWizard）
 * - subject-history: 科目の先生との対話履歴ビュー（SubjectHistoryView、subjectId クエリで指定）
 */
export type RightPaneView =
  | "default"
  | "issues"
  | "issue"
  | "schedule"
  | "history"
  | "reflections" // C4: ReflectionLog 一覧
  | "weekly-report" // C11 Phase 4: 週次レポート
  | "monthly-report" // C11 Phase 4: 月次レポート
  | "material-new"
  | "subject-history"
  | "tutor-archive";

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
  /** その科目を担当する「科目の先生」persona（Phase 3 追加）*/
  teacher?: SubjectTeacher;
};

/**
 * 科目の先生 persona。ゆい先生（担任）の TUTOR_PERSONA と同じ構造。
 * /tutor 右ペインの IssueChat ヘッダや SubjectHistoryView の見出しで使う。
 */
export type SubjectTeacher = {
  /** 名前（呼び捨て、例: "あおい"）*/
  name: string;
  /** 「○○先生」表記の完成形（例: "あおい先生"）*/
  displayName: string;
  /** アバターに表示する 1 文字（例: "あ"）*/
  avatarLetter: string;
  /** ヘッダ等で使うサブタイトル（例: "英語の先生"）*/
  subtitle: string;
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
  /** どのセッションで判定されたか */
  sessionId?: string;
  /** 判定時刻 ISO */
  createdAt?: string;
};

// ============================================================================
// 振り返り / コーチング契約 / 申し送り（Phase 3 拡張）
//
// ARCHITECTURE.md「振り返りとコーチング契約」セクションで定義した型を実装。
// REVIEW-2026-05-24.md の最重要 3 つの 3 つ目（Phase 3 拡張型 6 個追加）として
// C2 で types.ts に追加された。
//
// ゆい先生のコーチング軸（純粋コーチ、教えない、引き出す）の永続化機構:
// - ReflectionLog: 朝/夜の振り返りログ（日次 / 週次 / 月次）
// - LongTermGoal / WeeklyGoal / GoalReview: コーチング契約の長期 + 週次
// - TutorHandoff: ゆい → 葵への申し送り（葵 → ゆいの Issue.summary の逆方向）
// ============================================================================

/**
 * 振り返りログの周期。
 * - daily: 毎朝・毎晩（5 セクションが埋まる）
 * - weekly: 週次（日曜想定、5 セクション + weekStart + goalIds）
 * - monthly: 月次（月末、5 セクション + goalIds）
 */
export type ReflectionCadence = "daily" | "weekly" | "monthly";

/**
 * 振り返りログ。日記的に保存 + 中身から既存型（Issue / ScheduleItem / LessonReview / TutorHandoff）
 * に派生リンクを持つハイブリッド型。
 *
 * cadence で 5 セクションのうち必要なものが埋まる（daily は基本全部、
 * weekly/monthly は yesterdayReview のかわりに「期間全体のレビュー」が来る）。
 */
export type ReflectionLog = {
  id: string;
  learnerId: string;
  /** 振り返り日付 (YYYY-MM-DD, ローカル) */
  date: string;
  cadence: ReflectionCadence;

  // === 朝の振り返り (cadence: "daily") の 5→4 セクション ===
  // Phase 3: 5 セクション。
  // Phase 4 (Q8): schoolToday を撤去 → 4 セクションに縮退
  //   (学校で何やったかは記憶が新鮮な帰宅儀式で聞く → SchoolDailyReport へ)。
  // schoolToday フィールドは後方互換のため残す (既存 mock データ参照用)。

  /** 昨日（or 期間）の学習レビュー */
  yesterdayReview?: string;
  /**
   * @deprecated Phase 4 で帰宅儀式 (SchoolDailyReport) に移行。
   * 既存 mock データの後方互換のため残置。新規 ReflectionLog では設定しない。
   */
  schoolToday?: string;
  /** 起きたこと、気分 */
  emotionsAndEvents?: string;
  /** 疑問・不安・「先生の言ってる意味分からない」*/
  questionsAndDoubts?: string;
  /** 今日（or 期間）の計画 */
  todayPlan?: string;

  // === Phase 4 追加 (Q9): cadence: "weekly" | "monthly" で 4 セクションレポート ===
  /**
   * 週次/月次レポートの本体 (4 セクション + 月末週は + α)。
   * cadence: "weekly" | "monthly" の場合に設定される。
   * cadence: "daily" では未設定 (undefined)。
   */
  weeklyMonthlyReport?: WeeklyMonthlyReport;

  // 派生リンク（独立型のハイブリッド性の核心）
  /** ここから生まれた Issue */
  derivedIssueIds?: string[];
  /** ここから生まれた ScheduleItem */
  derivedScheduleItemIds?: string[];
  /** ここから生まれた LessonReview */
  derivedLessonReviewIds?: string[];
  /** ここから生まれた TutorHandoff */
  derivedHandoffIds?: string[];

  // 週次 / 月次の場合
  /** 週次の場合の月曜日付 (YYYY-MM-DD) */
  weekStart?: string;
  /** 該当期間の goal id 群 */
  goalIds?: string[];

  createdAt: string;
};

/**
 * 長期ゴール（月 / 学期 / 試験単位 / フリー）。
 * 月初 or 試験前にコーチング契約として設定される。
 */
export type LongTermGoal = {
  id: string;
  learnerId: string;
  scope: "month" | "semester" | "exam" | "free";
  /** 「2026 年 5 月」「中間試験まで」のような人間表記 */
  scopeLabel: string;
  /** 開始日 (YYYY-MM-DD) */
  startDate: string;
  /** 終了日 (YYYY-MM-DD) */
  endDate: string;
  /**
   * ゴール本文（自由テキスト）。
   * 学習成果 / メタ認知 / 気持ち / モチベ、本人が言ったものは何でも OK。
   */
  title: string;
  detail?: string;
  status: "active" | "achieved" | "abandoned" | "expired";
  createdAt: string;
  achievedAt?: string;
};

/**
 * 週次ゴール。長期ゴールに紐づく（紐付けなしも可）。
 * 週初に設定、週末に GoalReview で振り返る。
 */
export type WeeklyGoal = {
  id: string;
  learnerId: string;
  /** 週の月曜日付 (YYYY-MM-DD) */
  weekStart: string;
  /** 親 LongTermGoal への紐付け（任意）*/
  parentGoalId?: string;
  title: string;
  detail?: string;
  status: "active" | "achieved" | "missed";
  createdAt: string;
};

/**
 * ゴール振り返り（合議制）。
 * LongTermGoal / WeeklyGoal の両方に紐付けられる（goalId は両方を指せる）。
 */
export type GoalReview = {
  id: string;
  /** LongTermGoal.id or WeeklyGoal.id */
  goalId: string;
  learnerId: string;
  /** 振り返り日 (YYYY-MM-DD) */
  reviewDate: string;
  /** ゆいと本人で書いた振り返り (自由テキスト) */
  reflection: string;
  /** 0-100 自己評価 (optional、メタゴールでは未使用) */
  achievementPct?: number;
  /** 「次どうする?」の具体アクション */
  nextActions?: string[];
  createdAt: string;
};

/**
 * ゆい先生 → 科目の先生 への申し送りドキュメント。
 * 葵先生 → ゆい先生 の `Issue.summary` の逆方向。
 *
 * 流れ:
 *   1. ゆいが掘り起こし or ハードガード hit で「これは葵に振ろう」と判断
 *   2. TutorHandoff を draft で作成（status: "unread"）
 *   3. 葵 IssueChat ヘッダに「ゆいから N 件」表示
 *   4. 葵がクリック → 読む → status を "read" に更新 → 指導戦略に反映
 *
 * 将来 reverse 方向（葵 → ゆい）の handoff も追加するなら fromTutor を bool union に。
 */
export type TutorHandoff = {
  id: string;
  /** 現状は常に true（ゆい→葵）。将来 reverse 追加時に false が登場する */
  fromTutor: true;
  /** 葵先生（英語）の subject id */
  toSubjectId: string;
  /** 関連ノード（あれば）*/
  relatedNodeId?: string;
  /** 関連 Issue（あれば）*/
  relatedIssueId?: string;
  /** 1 行タイトル（「不定詞 名詞的用法 — 動名詞との使い分けで混乱中」等）*/
  title: string;
  /** ヒアリング要約 + ゆいの所感 + 指導提案（マークダウン OK）*/
  body: string;
  status: "unread" | "read";
  createdAt: string;
  readAt?: string;
};

// ============================================================================
// Phase 4: 中学生向け設計軌道修正 (2026-05-25 grill) — 計画立案 / 帰宅儀式 /
// 週次月次レポート / 達成バッジ / 親共有
//
// ARCHITECTURE.md「## Phase 4: 中学生向け設計軌道修正」セクションの実装。
// grill-me Q1-Q17 の決定事項を型に落とし込む。C7 は型 + 静的 mock のみで止め、
// UI / chat フロー / 月次バッチロジック等は次セッションで実装する。
// ============================================================================

// -------- LearningPlan (計画立案の中心、Q3) --------

/** LearningPlan のスコープ (Q4: 全体通読 × 3 回 + ページ単位) */
export type LearningPlanScope = "year" | "semester" | "term";

/** LearningPlan の状態 */
export type LearningPlanStatus = "active" | "completed" | "paused";

/**
 * 月次ロードマップの 1 セグメント。
 * monthlyRoadmap の各要素。Q5: roadmap (全期間) + 月次バッチ展開。
 */
export type PlanSegment = {
  /** "YYYY-MM" */
  month: string;
  /** この月の目標ページ数 */
  targetPages: number;
  /** 開始ページ (任意、累積から計算可) */
  startPage?: number;
  /** 終了ページ */
  endPage?: number;
  /** 前月からの繰り越し (Q5: 月末判定で繰り越し) */
  carryOverFromPrev?: number;
};

/** 月次バッチで ScheduleItem 化した記録 (Q5/Q12) */
export type ExpandedMonth = {
  /** "YYYY-MM" */
  month: string;
  /** この月の ScheduleItem id 群 */
  scheduleItemIds: string[];
  /** 展開日時 (月初に AI が展開) */
  expandedAt: string;
};

/** 計画見直し履歴 (PDCA の Action、Q17 修正プラン) */
export type PlanRevision = {
  id: string;
  revisedAt: string;
  /** 「テキスト使いにくい」「ペース速すぎ」等 */
  reason: string;
  /** 変更したフィールド名 */
  changedFields: string[];
  triggeredBy: "monthly-review" | "manual" | "ai-suggestion";
};

/**
 * 科目ごとの長期計画。ExamPrep (試験対策、短期集中) と独立並走。
 * Q3-Q5, Q11, Q12, Q17 を集約。
 */
export type LearningPlan = {
  id: string;
  learnerId: string;
  subjectId: string;
  /** 「中2 英語 教科書 計画」 */
  title: string;
  scope: LearningPlanScope;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** 教材選択 (1 〜複数)、Material.id 群 */
  materialIds: string[];
  /** 回転数 (3 回推奨、Q4) */
  targetRotations: number;
  /** 今何回転目 */
  currentRotation: number;
  /** 教材総ページ */
  totalPages: number;
  /** 全期間 roadmap (必ず作る、Q5 ito19 さん念押し) */
  monthlyRoadmap: PlanSegment[];
  /** 月次展開済みの記録 (当月のみ展開、Q12) */
  expandedMonths: ExpandedMonth[];
  status: LearningPlanStatus;
  /** PDCA Action の履歴 (Q17 修正プラン履歴) */
  revisions: PlanRevision[];
  createdAt: string;
  updatedAt: string;

  // === Phase 5 試作 拡張 (C14、2026-05-25) ===
  // 既存 mock 後方互換のため全て optional。Phase 5 本実装で required に
  // 昇格を grill で議論する。
  /** 計画の目的 (試験対策 / 苦手克服 / 通常学習 等) */
  planType?: PlanType;
  /** ターゲットの弱いノード id 群 (KnowledgeNode.id)。苦手克服計画で必須 */
  weakNodeIds?: string[];
  /** 復習ルール (テスト失敗 / 時間経過で復習タスク自動生成) */
  reviewRules?: ReviewRules;
  /** テストルール (定期テスト + 合格判定 + 失敗時アクション) */
  testRules?: TestRules;
  /** 再計画ルール (遅れた時の再計画モード) */
  replanRules?: ReplanRules;
  /** 1 日あたりの想定キャパシティ (分)、Plan Engine の負荷分散用 */
  dailyCapacityMinutes?: number;
};

// -------- SchoolDailyReport (帰宅儀式の学校レポート、Q8/Q14) --------

/** 時限別エントリ */
export type PeriodEntry = {
  /** 1-6 (時限数は可変、Q14) */
  periodNumber: number;
  /** 「英語」「数学」「体育」等 */
  subject: string;
  /** 何を習ったか */
  content: string;
};

/**
 * 学校日報 (帰宅儀式の第 1 部で AI 対話を通じて確定)。
 * 1 日 1 件。ReflectionLog.schoolToday の代替 (Phase 4 で移行)。
 */
export type SchoolDailyReport = {
  id: string;
  learnerId: string;
  /** YYYY-MM-DD */
  date: string;
  /** この日の時限数 (1-6、可変、Q14) */
  periodCount: number;
  /** 時限別 */
  periods: PeriodEntry[];
  /** 学校での他の出来事・相談事 (任意) */
  extraEvents?: string;
  createdAt: string;
};

// -------- 週次/月次レポート (4 セクション、Q9) --------

/**
 * 達成バッジの種類 (Q16: 5-7 種類)。
 */
export type AchievementBadgeKind =
  | "streak-3" // 連続 3 日 (1 日 5 分でも OK の軽め基準)
  | "streak-7" // 連続 7 日
  | "streak-30" // 連続 30 日
  | "month-80" // 月達成 80%+
  | "month-100" // 月達成 100%+
  | "issue-5-cleared" // Issue 5 件クリア
  | "reconstruction-perfect"; // 復元テスト全問正解

/** 獲得した達成バッジ (プロフィールに静的に残る) */
export type AchievementBadge = {
  id: string;
  learnerId: string;
  kind: AchievementBadgeKind;
  /** 獲得日時 (ISO) */
  earnedAt: string;
  /** 「3 日続いたよ」等の表示用テキスト */
  description: string;
};

/** Q17 修正プランの種類 */
export type ActionProposalKind =
  | "time-increase" // 翌月の毎日時間を増やす
  | "duration-extend" // 期間延長 (3 ヶ月 → 4 ヶ月)
  | "rotation-reduce" // 回転数削減 (3 回 → 2 回)
  | "material-change" // 教材変更
  | "order-change"; // 順序変更 (難しい単元を後回し)

/**
 * 月末判定 / 来週計画で AI が提示する Action 提案。
 * 本人が選択して採用 → PlanRevision に記録。
 */
export type ActionProposal = {
  kind: ActionProposalKind;
  /** 「月: +20 分早めに始める」等の具体内容 */
  detail: string;
  /** ゆいの所感 (なぜこの提案か) */
  rationale: string;
};

/**
 * 週次/月次レポートの本体 (4 セクション + 月末週は + α)。
 * ReflectionLog.cadence: "weekly" | "monthly" の場合に
 * ReflectionLog.weeklyMonthlyReport に格納される。
 *
 * セクション順序 (Q9): 達成度 → 学校 → 弱いところ → 来週計画 + Action。
 * サンドイッチ構造 (最初と最後がポジティブ)、達成感最優先 (ito19 さん哲学)。
 */
export type WeeklyMonthlyReport = {
  // 1. 達成度 (達成感を出す、最重要)
  achievement: {
    plannedPages: number;
    actualPages: number;
    /** 0-100 */
    achievementPct: number;
    /** 先週/先月比 (任意) */
    previousPeriodPct?: number;
    /** 連続学習日数 */
    consecutiveDays: number;
    /** この期間で獲得したバッジ */
    badgeIds: string[];
    /** 月末週のみ: 月次達成度も併記 */
    monthlyAchievement?: {
      plannedPages: number;
      actualPages: number;
      achievementPct: number;
    };
  };

  // 2. 学校まとめ
  schoolSummary: {
    /** 当該期間の SchoolDailyReport.id 群 */
    dailyReportIds: string[];
    /** AI 生成「今週/今月の重要ポイント」 */
    aiSummary: string;
  };

  // 3. 弱いところ (戻る候補、Q10 Issue + NodeComprehension ハイブリッド)
  weakSpots: {
    /** 未クリア Issue 上位 3 件 */
    issueIds: string[];
    /** 浅いノードの NodeComprehension 上位 2 件 (nodeId で参照) */
    weakNodeIds: string[];
  };

  // 4. 来週/来月の計画 + Action
  nextPeriodPlan: {
    plannedPages: number;
    /** 繰り越し */
    carryOver: number;
    /** 合計 (planned + carryOver) */
    totalPages: number;
    /** 時間配分・教材変更・ペース調整 等の提案 */
    actionProposals: ActionProposal[];
  };

  // 5. 月末週のみ: 来月計画 + 修正プラン draft
  nextMonthPlan?: {
    /** 来月の roadmap (LearningPlan.monthlyRoadmap の翌月分) */
    monthlyRoadmap: PlanSegment;
    /** 修正プラン draft (AI 提案、本人確認待ち) */
    revisionDraft?: Omit<PlanRevision, "id" | "revisedAt">;
  };
};

// -------- 親 (admin) への共有 (Q15: 本人同意制) --------

/**
 * 週次/月次レポートを親 (admin) に共有した記録。
 * デフォルト OFF、本人が選んだものだけ生成される。
 */
export type SharedToParent = {
  id: string;
  /** ReflectionLog.id (weekly/monthly) */
  reportId: string;
  /** 共有日時 (ISO) */
  sharedAt: string;
  /** "summary" = 数値のみ / "full" = フルレポート */
  scope: "summary" | "full";
};

// ============================================================================
// Phase 5 試作型 — 学習戦略エンジン (C14、2026-05-25 設計叩き台)
//
// ito19 さんの「計画 = 課題と試験対策の 2 つ、毎日は計画じゃない」発話 +
// 別 AI が提案した 4 軸分離 (Plan Type / Learning Mode / Resource / Node) +
// Replan エンジン / 割込みイベント / 上ノード復習 を試作型として実装。
//
// **後で書き換え前提の叩き台**。grill で詰めて Phase 5 本実装時に再設計する。
// 既存 LearningPlan には Phase 5 拡張フィールドを optional で追加することで
// 後方互換を保つ (Phase 4 mock も動作継続)。
// ============================================================================

/**
 * Plan Type (計画の目的、別 AI 提案より)。
 * 「なぜこの計画を立てるか」の軸。
 *
 * 注: ito19 さん発話で「宿題は計画じゃない、突発」と確定したため、
 * "homework-response" は外し、宿題は ad-hoc ScheduleItem (帰宅儀式) で扱う。
 */
export type PlanType =
  | "exam-prep" // 試験対策 (期間有限・短期集中)
  | "weakness-grind" // 苦手克服 (Issue や NodeComprehension の弱さを潰す)
  | "regular-study" // 通常学習 (体系的に進める、定期テスト範囲含む)
  | "review" // 復習 (過去分の再学習)
  | "long-term-memory"; // 長期記憶化 (定着、間隔反復)

/**
 * Learning Mode (学習モード、別 AI 提案より)。
 * 「どうやって学ぶか」の軸。GeneratedTask.mode に紐づく。
 */
export type LearningMode =
  | "input" // 読む・理解 (テキスト読み込み)
  | "output" // 解く・説明 (問題演習、口頭説明)
  | "review" // 復習 (過去分の再読 / 再演習)
  | "drill" // 反復 (短時間で大量に)
  | "test"; // 確認 (理解度測定、合否判定あり)

/**
 * Resource Type (教材種別、別 AI 提案より)。
 * GeneratedTask.resource.type に紐づく。
 */
export type ResourceType =
  | "textbook" // 教科書
  | "workbook" // 問題集
  | "note" // ノート (本人作成 or AI 生成)
  | "school-material" // 学校教材 (プリント等)
  | "ai-generated"; // AI 生成問題

/**
 * 復習ルール (LearningPlan に組み込まれる)。
 * テスト失敗 / 時間経過で復習タスクを自動生成する条件。
 */
export type ReviewRules = {
  /** 復習間隔 (日数、例: 7 日後に再出題) */
  reviewIntervalDays: number;
  /** 復習時の学習モード */
  reviewMode: LearningMode;
};

/**
 * テストルール (LearningPlan に組み込まれる)。
 * 週末/月末などの定期テスト + 合格判定 + 失敗時のアクション。
 */
export type TestRules = {
  /** テスト間隔 (日数、例: 7 日 = 週末テスト) */
  testIntervalDays: number;
  /** 合格スコア (0-1、例: 0.7 = 70% 以上) */
  passingThreshold: number;
  /**
   * 失敗時のアクション:
   * - "retry": 同ノードを再度
   * - "review-parent": 上のノード (親) の復習を提案 ← ito19 さん発話の核
   * - "manual": 何もせず本人 + ゆいで判断
   */
  failureAction: "retry" | "review-parent" | "manual";
};

/**
 * 再計画ルール (LearningPlan に組み込まれる)。
 * 「死なないシステム」(別 AI 評価) のコア。
 */
export type ReplanRules = {
  /** 何日遅れたら再計画提案するか (例: 3 日) */
  delayThresholdDays: number;
  /**
   * 再計画モード:
   * - "extend": 期間延長 (デフォルト)
   * - "drop": 範囲削減
   * - "ai-suggest": AI が状況見て提案 (ゆいから)
   */
  replanMode: "extend" | "drop" | "ai-suggest";
};

/**
 * Plan Engine が自動生成する学習タスク (Phase 5 コア)。
 * 「今日のタスクは結果でしかない」(別 AI) を体現。
 *
 * Phase 5 grill P5-Q1 確定設計:
 * - GT は「計画の実行単位」、ScheduleItem (SI) は「今日のカレンダー view」
 * - **1 GT : 1 SI** (cardinality 固定)、GT は 1 日分のタスク粒度、ページ範囲含む
 * - **計画立案時に全期間 GT 化** (例: 9 ヶ月計画なら ~180 GT)
 * - **月初 expansion** = 該当月の GT[] → SI[] 生成 (日付/status 付与)
 * - SI.generatedTaskId で逆参照 (ad-hoc/carry-over は null)
 * - Replan は GT[] 書き換え、未来 SI 再生成、履歴は PlanRevision[]
 */
export type GeneratedTask = {
  id: string;
  learnerId: string;
  /** 元の LearningPlan.id (どの計画から生成されたか) */
  planId: string;
  /** 対象 KnowledgeNode.id (何を学ぶか) */
  nodeId: string;
  /** 学習モード */
  mode: LearningMode;
  /** 使う教材 */
  resource: {
    type: ResourceType;
    /** Material.id (あれば) */
    materialId?: string;
    /** ページ範囲 (textbook / workbook の場合) */
    pageRange?: { start: number; end: number };
  };
  /** 見積もり時間 (分) */
  estimatedMinutes: number;
  /** 優先度 1-5 (5 が最優先) */
  priority: number;
  /** 期限 (YYYY-MM-DD) */
  dueDate: string;
  status: StudyTaskStatus;
  /** 配置日 (YYYY-MM-DD)、未定なら undefined (Plan Engine の宙ぶらりん) */
  scheduledDate?: string;
  /** AI が「なぜこのタスクを今ここに置いたか」 */
  rationale?: string;
  generatedAt: string;
  doneAt?: string;
};

/**
 * 割込みイベント (Phase 5 試作、ito19 さん「割込み」発話 + 別 AI 提案)。
 *
 * 計画通りに進まない事象を正式型化:
 *   宿題 / 体調不良 / 学校行事 / 想定外復習 等
 *
 * これが発生 → スケジューラが再計算 → 影響タスクの再配分 + 必要なら再計画提案。
 */
export type InterruptEvent = {
  id: string;
  learnerId: string;
  type:
    | "homework" // 急な宿題
    | "sick" // 体調不良
    | "school-event" // 学校行事 (体育祭 / 文化祭 / 修学旅行)
    | "unexpected-review" // 想定外復習 (上ノード復習が降ってきた)
    | "other";
  occurredAt: string; // ISO
  title: string;
  detail?: string;
  /** 影響を受ける日付 (YYYY-MM-DD)、複数日にまたがる場合は範囲の起点 */
  affectedDate?: string;
  /** 何日影響するか (1 日なら 1) */
  affectedDurationDays?: number;
  /** 再計画が走ったか (Replan Engine が処理した印) */
  replanTriggered: boolean;
};

/**
 * 上ノード復習提案 (Phase 5 試作、ito19 さん発話の核)。
 *
 * 子ノード (例: 不定詞 副詞的用法) のテスト失敗 / 浅い理解 → AI が
 * 親ノード (例: 不定詞) の復習を提案。本人が accept すると
 * 復習 GeneratedTask が自動追加される。
 */
export type NodeReviewSuggestion = {
  id: string;
  learnerId: string;
  /** 提案のトリガー */
  triggerType: "test-failure" | "low-comprehension" | "manual";
  /** 失敗した子ノードの id */
  failedNodeId: string;
  /** 戻る先の親ノード id (KnowledgeNode.parentId 経由で決まる) */
  suggestedParentNodeId: string;
  /** ゆいの所感 (なぜ戻った方がいいか) */
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
  acceptedAt?: string;
  dismissedAt?: string;
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
