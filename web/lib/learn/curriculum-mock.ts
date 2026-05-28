/**
 * カリキュラム DB (仮実装 2026-05-28、C66)
 *
 * 学習プラン再設計 grill (2026-05-27) 確定:
 * - C2: 教材アップロードから体系図ノードを作る方式を廃止
 * - C3: 小〜高の全カリキュラムを事前に AI が検索して用意 (中高一貫対応で高校まで)
 * - C1: 学年を超える遡及 (中2 連立 → 小5 割合 など)
 *
 * 本ファイルは英語の中1〜高3 体系図の **仮 mock**。Phase 5 解体プラン確定後に
 * カリキュラム DB grill (未確定 #2) で構造を本格的に詰めて作り直す。
 *
 * 階層: 分野 (6) × 学年 (6 + agnostic) × 単元 (5-10) ≒ 約 55 ノード
 *
 * 既存 MOCK_TREE (教材ベース、英語/不定詞のみ) との関係:
 * - 旧 MOCK_TREE は Phase 5 解体で廃止予定 (C2)
 * - 当面は **並走** (既存 /learn は MOCK_TREE 維持、新 /curriculum だけ本ファイル使用)
 * - 段階移行で差し替え
 */

export type CurriculumDomain =
  | "grammar" // 文法
  | "vocab" // 語彙
  | "reading" // 読解
  | "listening" // 聴解
  | "writing" // 作文
  | "speaking"; // 会話

export const CURRICULUM_DOMAIN_LABELS: Record<CurriculumDomain, string> = {
  grammar: "文法",
  vocab: "語彙",
  reading: "読解",
  listening: "聴解",
  writing: "作文",
  speaking: "会話",
};

export type CurriculumGrade =
  | "j1"
  | "j2"
  | "j3" // 中1-中3
  | "h1"
  | "h2"
  | "h3"; // 高1-高3

export const CURRICULUM_GRADE_LABELS: Record<CurriculumGrade, string> = {
  j1: "中1",
  j2: "中2",
  j3: "中3",
  h1: "高1",
  h2: "高2",
  h3: "高3",
};

/**
 * ノード状態 5 種:
 * - unlearned: 未学習 (グレー)
 * - in-progress: 学習中 (青)
 * - mastered: 完了 (緑)
 * - weak-detected: AI つまずき認定 (黄) ← テスト誤答多 / ヒアリングで曖昧
 * - weak-confirmed: 戻り誘導候補 (赤) ← ヒアリング後の本人/親確認済、ここから戻る
 */
export type CurriculumNodeState =
  | "unlearned"
  | "in-progress"
  | "mastered"
  | "weak-detected"
  | "weak-confirmed";

export const CURRICULUM_NODE_STATE_LABELS: Record<CurriculumNodeState, string> =
  {
    unlearned: "未学習",
    "in-progress": "学習中",
    mastered: "完了",
    "weak-detected": "AI つまずき認定",
    "weak-confirmed": "戻り誘導候補",
  };

export type CurriculumNode = {
  id: string;
  subjectId: string;
  domain: CurriculumDomain;
  /** 学年分けない分野 (読解 / 聴解 / 作文 / 会話) は undefined */
  grade?: CurriculumGrade;
  name: string;
  description?: string;
  /** つまずき遡及の親候補 (= 前提となるノード)、複数可。学年を超えてもよい (C1) */
  prerequisiteIds?: string[];
  state: CurriculumNodeState;
};

/** 横軸: 学年 (中1 → 高3) */
export const CURRICULUM_GRADES: CurriculumGrade[] = [
  "j1",
  "j2",
  "j3",
  "h1",
  "h2",
  "h3",
];

/** 縦軸: 分野 */
export const CURRICULUM_DOMAINS: CurriculumDomain[] = [
  "grammar",
  "vocab",
  "reading",
  "listening",
  "writing",
  "speaking",
];

/** 学年区分のない分野 (読解 / 聴解 / 作文 / 会話) */
export const GRADE_AGNOSTIC_DOMAINS: CurriculumDomain[] = [
  "reading",
  "listening",
  "writing",
  "speaking",
];

// ============================================================================
// MOCK データ: 英語 中1〜高3 体系図 (約 55 ノード)
// 状態は仮 — 中1 系は完了、中2 で「不定詞」つまずき認定、中3「関係代名詞」戻り
// 誘導候補に設定して 5 色全部見えるようにする
// ============================================================================

export const MOCK_CURRICULUM_EN: CurriculumNode[] = [
  // ============================
  // 文法 (grammar) - 学年別 約 36 ノード
  // ============================
  // === 中1 (mastered) ===
  {
    id: "g-j1-be",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "be 動詞",
    description: "I am / You are / He is の基本",
    state: "mastered",
  },
  {
    id: "g-j1-do",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "一般動詞",
    description: "play, like, have の現在形",
    state: "mastered",
  },
  {
    id: "g-j1-wh",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "疑問詞",
    description: "What / Where / When / Who / Why / How",
    state: "mastered",
  },
  {
    id: "g-j1-3rd",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "三人称単数",
    description: "He plays / She has",
    state: "mastered",
  },
  {
    id: "g-j1-prog",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "現在進行形",
    description: "be + V-ing",
    state: "mastered",
  },
  {
    id: "g-j1-past",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "過去形 (規則/不規則)",
    description: "played, went, came",
    state: "mastered",
  },
  {
    id: "g-j1-imp",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j1",
    name: "命令文",
    description: "Open the door. Don't run.",
    state: "mastered",
  },
  // === 中2 (mix: mastered / in-progress / weak-detected) ===
  {
    id: "g-j2-fut",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "未来表現",
    description: "will / be going to",
    state: "mastered",
  },
  {
    id: "g-j2-aux",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "助動詞",
    description: "can, must, have to, may, should",
    state: "mastered",
  },
  {
    id: "g-j2-inf",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "不定詞 3 用法",
    description: "名詞的 / 形容詞的 / 副詞的",
    prerequisiteIds: ["g-j1-be", "g-j1-do"],
    state: "weak-detected", // ← AI つまずき認定の例 (黄)
  },
  {
    id: "g-j2-ger",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "動名詞",
    description: "V-ing の名詞用法",
    prerequisiteIds: ["g-j2-inf"],
    state: "in-progress",
  },
  {
    id: "g-j2-comp",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "比較",
    description: "比較級 / 最上級 / 同等比較",
    state: "in-progress",
  },
  {
    id: "g-j2-conj",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "接続詞",
    description: "when, if, that, because",
    state: "mastered",
  },
  {
    id: "g-j2-pat",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j2",
    name: "文型 (5 文型)",
    description: "SV / SVC / SVO / SVOO / SVOC",
    state: "in-progress",
  },
  // === 中3 (mix: in-progress / weak-detected / weak-confirmed / unlearned) ===
  {
    id: "g-j3-pass",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "受動態",
    description: "be + 過去分詞",
    prerequisiteIds: ["g-j1-past"],
    state: "in-progress",
  },
  {
    id: "g-j3-pp",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "現在完了",
    description: "完了 / 結果 / 経験 / 継続",
    prerequisiteIds: ["g-j1-past"],
    state: "weak-detected", // ← 黄
  },
  {
    id: "g-j3-rel",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "関係代名詞",
    description: "who, which, that の制限用法",
    prerequisiteIds: ["g-j2-pat"],
    state: "weak-confirmed", // ← 赤、戻り誘導候補
  },
  {
    id: "g-j3-relw",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "関係副詞",
    description: "where, when, why",
    prerequisiteIds: ["g-j3-rel"],
    state: "unlearned",
  },
  {
    id: "g-j3-sub",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "仮定法 (基礎)",
    description: "If I were... I would...",
    state: "unlearned",
  },
  {
    id: "g-j3-part",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "分詞構文 (基礎)",
    description: "現在分詞 / 過去分詞の修飾",
    state: "unlearned",
  },
  {
    id: "g-j3-iq",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "j3",
    name: "間接疑問文",
    description: "I know what he wants.",
    state: "unlearned",
  },
  // === 高1 (all unlearned) ===
  {
    id: "g-h1-tense",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "時制 (12 時制完全版)",
    description: "過去完了 / 未来完了 / 進行形との組み合わせ",
    state: "unlearned",
  },
  {
    id: "g-h1-sub",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "仮定法完成",
    description: "過去完了 / 混合仮定法",
    prerequisiteIds: ["g-j3-sub"],
    state: "unlearned",
  },
  {
    id: "g-h1-part",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "分詞構文 (応用)",
    description: "完了形 / 受動 / 慣用表現",
    prerequisiteIds: ["g-j3-part"],
    state: "unlearned",
  },
  {
    id: "g-h1-rel",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "関係詞 (応用)",
    description: "制限 / 非制限 / 複合関係詞",
    prerequisiteIds: ["g-j3-rel", "g-j3-relw"],
    state: "unlearned",
  },
  {
    id: "g-h1-mod",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "完了助動詞",
    description: "must have done, should have done",
    state: "unlearned",
  },
  {
    id: "g-h1-gvi",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "動名詞 vs 不定詞",
    description: "remember, forget, try の使い分け",
    prerequisiteIds: ["g-j2-inf", "g-j2-ger"],
    state: "unlearned",
  },
  {
    id: "g-h1-passa",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h1",
    name: "受動態 (応用)",
    description: "It is said that... / S is said to V",
    prerequisiteIds: ["g-j3-pass"],
    state: "unlearned",
  },
  // === 高2 (all unlearned) ===
  {
    id: "g-h2-emp",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "強調構文",
    description: "It is ... that ...",
    state: "unlearned",
  },
  {
    id: "g-h2-inv",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "倒置",
    description: "否定副詞前置の倒置",
    state: "unlearned",
  },
  {
    id: "g-h2-cl",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "名詞節・副詞節 (応用)",
    description: "that 節 / 関係詞 / 副詞節の複合",
    state: "unlearned",
  },
  {
    id: "g-h2-rs",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "話法 (直接/間接)",
    description: 'He said "..." → He said that...',
    state: "unlearned",
  },
  {
    id: "g-h2-neg",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "否定構文",
    description: "部分否定 / 二重否定 / 否定の慣用句",
    state: "unlearned",
  },
  {
    id: "g-h2-inan",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h2",
    name: "無生物主語",
    description: "This book made me happy. の構造",
    state: "unlearned",
  },
  // === 高3 (all unlearned) ===
  {
    id: "g-h3-adv",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h3",
    name: "構文応用",
    description: "難関入試レベル構文",
    state: "unlearned",
  },
  {
    id: "g-h3-comp",
    subjectId: "subj-english",
    domain: "grammar",
    grade: "h3",
    name: "総合演習",
    description: "全範囲混合",
    state: "unlearned",
  },

  // ============================
  // 語彙 (vocab) - 学年別 6 ノード
  // ============================
  {
    id: "v-j1",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "j1",
    name: "中1 基礎 500 語",
    description: "教科書水準",
    state: "mastered",
  },
  {
    id: "v-j2",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "j2",
    name: "中2 基礎 500 語",
    description: "教科書水準",
    state: "in-progress",
  },
  {
    id: "v-j3",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "j3",
    name: "中3 基礎 500 語",
    description: "教科書水準",
    state: "unlearned",
  },
  {
    id: "v-h1",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "h1",
    name: "高1 必修 1000 語",
    description: "高校基礎",
    state: "unlearned",
  },
  {
    id: "v-h2",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "h2",
    name: "高2 必修 1000 語",
    description: "標準的高校水準",
    state: "unlearned",
  },
  {
    id: "v-h3",
    subjectId: "subj-english",
    domain: "vocab",
    grade: "h3",
    name: "大学入試 1000 語",
    description: "共通テスト〜難関大",
    state: "unlearned",
  },

  // ============================
  // 読解 (reading) - 学年区分なし、4 ノード
  // ============================
  {
    id: "r-short",
    subjectId: "subj-english",
    domain: "reading",
    name: "短文読解",
    description: "1-3 文の読み取り",
    state: "mastered",
  },
  {
    id: "r-para",
    subjectId: "subj-english",
    domain: "reading",
    name: "段落読解",
    description: "1 段落 (4-8 文)",
    state: "in-progress",
  },
  {
    id: "r-mid",
    subjectId: "subj-english",
    domain: "reading",
    name: "中長文読解",
    description: "200-400 語",
    state: "unlearned",
  },
  {
    id: "r-long",
    subjectId: "subj-english",
    domain: "reading",
    name: "長文読解",
    description: "500 語以上",
    state: "unlearned",
  },

  // ============================
  // 聴解 (listening) - 3 ノード
  // ============================
  {
    id: "l-short",
    subjectId: "subj-english",
    domain: "listening",
    name: "短文聴解",
    description: "10-20 秒",
    state: "in-progress",
  },
  {
    id: "l-dialogue",
    subjectId: "subj-english",
    domain: "listening",
    name: "会話聴解",
    description: "1-2 分の対話",
    state: "unlearned",
  },
  {
    id: "l-long",
    subjectId: "subj-english",
    domain: "listening",
    name: "長文聴解",
    description: "3-5 分のモノローグ",
    state: "unlearned",
  },

  // ============================
  // 作文 (writing) - 3 ノード
  // ============================
  {
    id: "w-sentence",
    subjectId: "subj-english",
    domain: "writing",
    name: "単文作成",
    description: "1 文の英作文",
    state: "in-progress",
  },
  {
    id: "w-para",
    subjectId: "subj-english",
    domain: "writing",
    name: "段落作成",
    description: "5-8 文のまとまり",
    state: "unlearned",
  },
  {
    id: "w-essay",
    subjectId: "subj-english",
    domain: "writing",
    name: "エッセイ",
    description: "200 語以上の論述",
    state: "unlearned",
  },

  // ============================
  // 会話 (speaking) - 3 ノード
  // ============================
  {
    id: "s-greet",
    subjectId: "subj-english",
    domain: "speaking",
    name: "挨拶・自己紹介",
    description: "基本フレーズ",
    state: "mastered",
  },
  {
    id: "s-daily",
    subjectId: "subj-english",
    domain: "speaking",
    name: "日常会話",
    description: "1-3 分の対話",
    state: "in-progress",
  },
  {
    id: "s-disc",
    subjectId: "subj-english",
    domain: "speaking",
    name: "議論・プレゼン",
    description: "意見表明 + 説明",
    state: "unlearned",
  },
];

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * 特定 domain + grade のセルに属するノードを抽出。
 * 学年区分なし分野 (reading/listening/writing/speaking) は最初のセル (中1 列)
 * にだけ全部入れる仕様 (UI 上は cellSpan=6 で全幅表示する)。
 */
export function nodesInCell(
  nodes: CurriculumNode[],
  domain: CurriculumDomain,
  grade: CurriculumGrade,
): CurriculumNode[] {
  if (GRADE_AGNOSTIC_DOMAINS.includes(domain)) {
    if (grade === "j1") return nodes.filter((n) => n.domain === domain);
    return [];
  }
  return nodes.filter((n) => n.domain === domain && n.grade === grade);
}

/** ノード状態 → tailwind 色クラス + ラベル */
export function nodeStateColor(state: CurriculumNodeState): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (state) {
    case "unlearned":
      return {
        bg: "bg-slate-100",
        text: "text-slate-500",
        border: "border-slate-300",
        label: "未学習",
      };
    case "in-progress":
      return {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-300",
        label: "学習中",
      };
    case "mastered":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        border: "border-emerald-300",
        label: "完了",
      };
    case "weak-detected":
      return {
        bg: "bg-amber-100",
        text: "text-amber-800",
        border: "border-amber-400",
        label: "AI つまずき認定",
      };
    case "weak-confirmed":
      return {
        bg: "bg-rose-100",
        text: "text-rose-800",
        border: "border-rose-400",
        label: "戻り誘導候補",
      };
  }
}

/** 状態の優先順 (画面の凡例で使う順序) */
export const CURRICULUM_NODE_STATES: CurriculumNodeState[] = [
  "unlearned",
  "in-progress",
  "mastered",
  "weak-detected",
  "weak-confirmed",
];
