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

/** 「ここが分からない」フラグ。次回確認用 */
export type Memo = {
  id: string;
  nodeId: string;
  content: string;
  resolved: boolean;
  createdAt: string;
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
  /** この教材に紐づくノートが存在するノード ID 群 */
  noteNodeIds: string[];
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
