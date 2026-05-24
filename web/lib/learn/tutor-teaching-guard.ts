/**
 * tutor-teaching-guard - ゆい先生が「教えない」を保つためのハードガード判定（C6）。
 *
 * REVIEW-2026-05-24.md コーチング #1「最高」優先項目への対応。
 *
 * 設計（grill-me で確定）:
 * - 判定方式: カテゴリ別キーワードリスト (Q5: B、False positive 寄り)
 * - 境界事例: META_KEYWORDS で hit 抑制 (Q7: ii)
 * - hit 時挙動: tutor-mock 側で draft TutorHandoff 自動生成 + 3 肢選択 (Q6: c)
 *
 * カテゴリ:
 * - teach: 「教えて」「知りたい」系
 * - answer: 「答えは」「正解は」系
 * - translate: 「訳して」「英訳」系
 * - solve: 「解いて」「やり方」系
 * - explain: 「説明して」「とは」系
 *
 * メタ救済:
 * 「数学って何のためにやるの?」のような **勉強の必要性 / 学び方** 系は
 * ゆいが受けるべき哲学的話題なので、META_KEYWORDS が含まれている時は
 * detectTeachingRequest() が null を返す（ハードガードを抑制）。
 *
 * Phase 6 で system prompt + LLM classifier の二重ガードに統合する想定。
 * 本ファイルの CATEGORY_PATTERNS は few-shot 評価セットとして再利用可能。
 */

export type TeachingCategory =
  | "teach"
  | "answer"
  | "translate"
  | "solve"
  | "explain";

export type TeachingDetection = {
  hit: true;
  category: TeachingCategory;
  matched: string;
};

/**
 * カテゴリ別キーワード。中2 女子の口語想定で False positive 寄りに広めに取る。
 * Phase 6 で実データから「これは教えないでスルーしたい」サンプルを集めて
 * 否定リスト or LLM classifier に置換する。
 */
const CATEGORY_PATTERNS: Record<TeachingCategory, readonly string[]> = {
  teach: ["教えて", "おしえて", "知りたい", "わからない教えて"],
  answer: ["答えは", "答え何", "正解は", "正解何", "答えて"],
  translate: ["訳して", "英訳", "和訳", "日本語にして", "英語にして"],
  solve: ["解いて", "どうやって解く", "やり方教え", "式は", "計算して"],
  explain: [
    "説明して",
    "解説して",
    "意味は",
    "意味教え",
    "って何",
    "って何だっけ",
    "とは",
  ],
} as const;

/**
 * 「教えない」原則の例外（メタ質問救済）。
 *
 * 「○○って何のためにやるの?」「集中力どう上げる?」のような
 * 勉強の必要性 / 学び方 / メタ認知系は、ARCHITECTURE.md で
 * 「教えない系 (= OK、ゆいが話す)」と定義されているため、
 * このキーワードが含まれていればハードガードを抑制する。
 */
const META_KEYWORDS: readonly string[] = [
  "勉強",
  "努力",
  "集中",
  "やる気",
  "意味",
  "意義",
  "なんで",
  "なぜ",
  "目的",
  "habit",
  "習慣",
  "モチベ",
  "受験",
  "将来",
];

/**
 * 否定形・反対の意図を粗く除外。
 * 「教えて欲しくない」「説明しないで」のような hit させたくないパターン。
 */
function isLikelyNegated(text: string): boolean {
  return (
    text.includes("欲しくない") ||
    text.includes("いらない") ||
    text.includes("いいから") ||
    text.includes("しないで") ||
    text.includes("教えないで")
  );
}

/**
 * 1 つでもキーワードが含まれていれば true。
 */
function containsAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/**
 * ゆいへの発話が「教えて」要求か判定する。
 *
 * 返り値:
 * - 判定 hit: `{ hit: true, category, matched }`
 * - hit しない or 救済された: `null`
 *
 * 判定ロジック:
 * 1. META_KEYWORDS が含まれていれば null (メタ質問救済)
 * 2. 否定形なら null
 * 3. CATEGORY_PATTERNS のどれかにマッチすれば hit
 * 4. それ以外は null
 */
export function detectTeachingRequest(
  rawText: string,
): TeachingDetection | null {
  const text = rawText.trim();
  if (text.length === 0) return null;

  // メタ質問救済
  if (containsAny(text, META_KEYWORDS)) return null;

  // 否定形除外
  if (isLikelyNegated(text)) return null;

  // カテゴリ別キーワードマッチ
  for (const category of Object.keys(CATEGORY_PATTERNS) as TeachingCategory[]) {
    const patterns = CATEGORY_PATTERNS[category];
    const matched = patterns.find((p) => text.includes(p));
    if (matched) {
      return { hit: true, category, matched };
    }
  }

  return null;
}

/**
 * カテゴリの日本語ラベル（ゆいの発話で「それは ◯◯ だから」に使う）。
 */
export function labelForTeachingCategory(category: TeachingCategory): string {
  switch (category) {
    case "teach":
      return "教科の中身";
    case "answer":
      return "答え合わせ";
    case "translate":
      return "訳の話";
    case "solve":
      return "解き方の話";
    case "explain":
      return "用語の説明";
  }
}
