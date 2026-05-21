/**
 * /learn 画面のサンプルデータ（モック）。
 * 後で Supabase からの取得に置き換える。
 *
 * チャット・ノート・メモは「ノードごと」に分離。
 * MVP モックでは、パス上の 4 ノード（grammar / verb-form / inf / inf-noun）
 * に充実したサンプルを置き、他ノードは空の状態。
 */
import type {
  ChatMessage,
  CurrentUser,
  KnowledgeNode,
  LearnSubject,
  Material,
  Memo,
  Note,
  Subject,
} from "./types";

export const MOCK_SUBJECT: LearnSubject = {
  name: "中2 英語",
  unitName: "不定詞 (to + 動詞)",
  pageRange: "p.42-58",
};

export const MOCK_USER: CurrentUser = {
  displayName: "娘さん",
  role: "learner",
};

export const MOCK_CURRENT_NODE_ID = "inf-noun";

export const MOCK_TREE: KnowledgeNode[] = [
  // ルート
  {
    id: "grammar",
    name: "中2 英語文法",
    parentId: null,
    description:
      "中2 で学ぶ英文法の全体。動詞・助動詞・受動態・比較・接続詞・文型などのツールを少しずつ揃えていく。",
  },

  // ====== 大カテゴリ ======
  {
    id: "verb-tense",
    name: "動詞の時制と相",
    parentId: "grammar",
    description: "「いつのことか」「進行中か終わっているか」を表現するツール群。",
  },
  {
    id: "verb-form",
    name: "動詞の派生形",
    parentId: "grammar",
    description: "動詞を別の品詞（名詞・形容詞・副詞）のように変形して使うツール群。",
  },
  {
    id: "modal",
    name: "助動詞",
    parentId: "grammar",
    description: "動詞に意味（義務・可能・推量など）を足すツール群。",
  },
  {
    id: "passive",
    name: "受動態",
    parentId: "grammar",
    description: "「〜される」を表現するツール。be 動詞 + 過去分詞。",
  },
  {
    id: "comparison",
    name: "比較",
    parentId: "grammar",
    description: "ものを比べる時のツール。比較級・最上級・同等比較。",
  },
  {
    id: "conjunction",
    name: "接続詞",
    parentId: "grammar",
    description: "文と文、語と語をつなぐツール。",
  },
  {
    id: "sentence-pattern",
    name: "文型",
    parentId: "grammar",
    description: "英語の文の骨格のパターン。SVOO / SVOC など。",
  },

  // ====== 動詞の時制と相 の子 ======
  { id: "be-past", name: "be 動詞の過去形", parentId: "verb-tense", description: "was / were で「〜だった」を表現するツール。" },
  { id: "verb-past", name: "一般動詞の過去形", parentId: "verb-tense", description: "動詞に -ed をつける（規則変化）か、別の形に変える（不規則変化）。" },
  { id: "past-progressive", name: "過去進行形", parentId: "verb-tense", description: "was/were + 動詞 -ing で「〜していた」を表現。" },
  { id: "future", name: "未来表現 (will / be going to)", parentId: "verb-tense", description: "will は「その場で決めた未来」、be going to は「予定の未来」。" },

  // ====== 動詞の派生形 の子 ======
  { id: "inf", name: "不定詞 (to + 動詞)", parentId: "verb-form", description: "動詞の前に to を置いて、別の品詞のように使えるツール群。3 つの用法がある。" },
  { id: "gerund", name: "動名詞 (-ing)", parentId: "verb-form", description: "動詞 + ing で「〜すること」を表現、名詞のように使えるツール。" },

  // ====== 助動詞 の子 ======
  { id: "modal-must", name: "must / have to", parentId: "modal", description: "「〜しなければならない」（義務）を表現。" },
  { id: "modal-should", name: "should", parentId: "modal", description: "「〜すべき」（助言・推奨）を表現。" },
  { id: "modal-may", name: "may / might", parentId: "modal", description: "「〜かもしれない」（推量）「〜してもよい」（許可）。" },

  // ====== 受動態 の子 ======
  { id: "passive-basic", name: "be + 過去分詞", parentId: "passive", description: "受動態の基本形。「〜される」「〜された」。" },
  { id: "passive-by", name: "by 〜 の有無", parentId: "passive", description: "「誰によって〜される」が必要な場合だけ by 〜 をつける。" },

  // ====== 比較 の子 ======
  { id: "comparative", name: "比較級 (-er / more)", parentId: "comparison", description: "2 つを比べて「〜より…」を表現。" },
  { id: "superlative", name: "最上級 (-est / most)", parentId: "comparison", description: "3 つ以上の中で「一番〜」を表現。" },
  { id: "as-as", name: "同等比較 (as 〜 as)", parentId: "comparison", description: "「〜と同じくらい…」を表現。" },

  // ====== 接続詞 の子 ======
  { id: "conj-coordinate", name: "等位接続詞 (and, but, or, so)", parentId: "conjunction", description: "対等な関係で語や文をつなぐ。" },
  { id: "conj-subordinate", name: "従位接続詞 (when, if, because, that)", parentId: "conjunction", description: "メインの文に補足の文をつなぐ。" },

  // ====== 文型 の子 ======
  { id: "svoo", name: "SVOO (give 型)", parentId: "sentence-pattern", description: "「〜に〜をあげる/見せる/教える」のパターン。" },
  { id: "svoc", name: "SVOC (call 型)", parentId: "sentence-pattern", description: "「〜を〜と呼ぶ/思う/する」のパターン。" },
  { id: "there-is", name: "There is / There are", parentId: "sentence-pattern", description: "「〜がある/いる」を表現。" },

  // ====== 不定詞 の子（小カテゴリ） ======
  { id: "inf-noun", name: "名詞的用法", parentId: "inf", description: "「〜すること」を意味して、文の中で名詞のように働く。主語・目的語・補語になれる。" },
  { id: "inf-adj", name: "形容詞的用法", parentId: "inf", description: "前の名詞を後ろから説明して、形容詞のように働く。" },
  { id: "inf-adv", name: "副詞的用法", parentId: "inf", description: "動詞・形容詞を後ろから飾って、副詞のように働く。" },

  // ====== 副詞的用法 の子 ======
  { id: "inf-adv-purpose", name: "目的（〜するために）", parentId: "inf-adv", description: "I went to the library to study. のように「〜するために」。" },
  { id: "inf-adv-result", name: "結果（〜して…になった）", parentId: "inf-adv", description: "He grew up to be a doctor. のように「〜して結果〜になった」。" },
  { id: "inf-adv-emotion", name: "感情の原因（〜して嬉しい等）", parentId: "inf-adv", description: "I'm glad to see you. のように、感情の理由を後ろから説明。" },
];

// パス上の 4 ノードにサンプルチャットを置く（他ノードは空 = 未学習）
export const MOCK_MESSAGES: ChatMessage[] = [
  // ====== ルート「中2 英語文法」のチャット ======
  {
    id: "m-g-1",
    nodeId: "grammar",
    role: "assistant",
    content:
      "ようこそ。今日もよろしくね。\nまずは「中2 英語文法」って全体で何があるか、軽く一緒に見ていこう。",
    createdAt: "2026-05-21T20:00:00.000Z",
  },
  {
    id: "m-g-2",
    nodeId: "grammar",
    role: "assistant",
    content:
      "中2 では、動詞の時制と相、動詞の派生形、助動詞、受動態、比較、接続詞、文型 — この 7 つを学んでいくよ。\n\nどうしてこの順序かというと、まず動詞の時制で文の核を作って、その動詞をいろんな形に変えたり意味を足したり（派生形・助動詞・受動態）して、最後に比較や接続詞で文と文の関係、文型で全体構造を整える流れだから。動詞の世界が広がっていくイメージだよ。\n\nここまで分かったかな？",
    createdAt: "2026-05-21T20:00:30.000Z",
  },

  // ====== 「動詞の派生形」のチャット ======
  {
    id: "m-vf-1",
    nodeId: "verb-form",
    role: "assistant",
    content:
      "動詞の派生形は、動詞をそのまま動詞として使うんじゃなくて、名詞や形容詞や副詞みたいに別の品詞っぽく使うツール群だよ。\n中2 では、不定詞 (to + 動詞) と動名詞 (-ing) の 2 つを学ぶ。\n\n今日はこの中の「不定詞」をやるよ。ここまで OK?",
    createdAt: "2026-05-21T20:05:00.000Z",
  },

  // ====== 「不定詞」のチャット ======
  {
    id: "m-inf-1",
    nodeId: "inf",
    role: "assistant",
    content:
      "不定詞は「to + 動詞」の形で、動詞を別の品詞っぽく変身させるツール。3 つの使い方があるよ:\n\n1. 名詞的用法 — 「〜すること」（主語・目的語にする）\n2. 形容詞的用法 — 前の名詞を後ろから飾る\n3. 副詞的用法 — 動詞や形容詞を後ろから飾る\n\n今日はこの中の「名詞的用法」をやろう。",
    createdAt: "2026-05-21T20:08:00.000Z",
  },

  // ====== 「名詞的用法」のチャット ======
  {
    id: "m-noun-1",
    nodeId: "inf-noun",
    role: "assistant",
    content:
      "じゃあ、自分の言葉で「名詞的用法ってどんなツール？」って言ってみてくれる？分からなくても全然 OK、それが分かったら学習の入口だから。",
    createdAt: "2026-05-21T20:10:00.000Z",
  },
  {
    id: "m-noun-2",
    nodeId: "inf-noun",
    role: "user",
    content: "動詞を名詞っぽく使えるやつ…？",
    createdAt: "2026-05-21T20:10:30.000Z",
  },
  {
    id: "m-noun-3",
    nodeId: "inf-noun",
    role: "assistant",
    content:
      "いいね、その通り。じゃあ「動詞を名詞っぽく使う」と、何ができるようになる？例えば「サッカーをすること」って日本語で言いたいとき。",
    createdAt: "2026-05-21T20:11:00.000Z",
  },
];

export const MOCK_NOTES: Note[] = [
  {
    nodeId: "grammar",
    content:
      "# 中2 英語文法 — 全体の地図\n\n中2 で学ぶ文法は次の 7 グループ:\n\n1. 動詞の時制と相\n2. 動詞の派生形\n3. 助動詞\n4. 受動態\n5. 比較\n6. 接続詞\n7. 文型\n\n## なぜこの順序か\n\n動詞の時制で文の核を作って、動詞のバリエーション（派生形・助動詞・受動態）を広げ、比較・接続詞で文と文の関係、文型で全体構造を学ぶ流れ。動詞の世界が広がっていくイメージ。",
    updatedAt: "2026-05-21T20:01:00.000Z",
  },
  {
    nodeId: "verb-form",
    content:
      "# 動詞の派生形\n\n動詞をそのまま動詞として使うんじゃなく、別の品詞っぽく変形するツール群。\n\n## 中2 で扱うもの\n\n- **不定詞** (to + 動詞)\n- **動名詞** (-ing)\n\n## 共通の性質\n\nどちらも「動詞 → 名詞・形容詞・副詞」への変身ツール。使い分けは別ノートで。",
    updatedAt: "2026-05-21T20:06:00.000Z",
  },
  {
    nodeId: "inf",
    content:
      "# 不定詞 (to + 動詞)\n\n動詞の前に **to** を置く形。動詞を 3 通りに変身させる。\n\n## 3 つの用法\n\n1. **名詞的用法** —「〜すること」、文の主語・目的語・補語\n2. **形容詞的用法** — 前の名詞を後ろから説明\n3. **副詞的用法** — 動詞・形容詞を後ろから飾る\n\n## 例\n\n- To play soccer is fun.  (名詞的)\n- I have something to eat.  (形容詞的)\n- I went to the library to study.  (副詞的)",
    updatedAt: "2026-05-21T20:09:00.000Z",
  },
  {
    nodeId: "inf-noun",
    content:
      "# 不定詞 — 名詞的用法\n\n## 何をするツール？\n\n「to + 動詞」で、動詞を名詞のように使えるツール。\n\n## いつ使う？\n\n「〜すること」を主語・目的語・補語にしたいとき。\n\n## 例文\n\n- **To play soccer is fun.**  (主語:「サッカーをすることは楽しい」)\n- I like **to read books**.  (目的語:「本を読むこと」)\n- My dream is **to be a teacher**.  (補語:「先生になること」)\n\n## メモ\n\n動名詞 (-ing) とちょっと似ている。違いは次回に。",
    updatedAt: "2026-05-21T20:12:00.000Z",
  },
];

export const MOCK_MEMOS: Memo[] = [
  {
    id: "memo-1",
    nodeId: "inf-noun",
    content: "動名詞 (-ing) と不定詞の名詞的用法、どう使い分けるんだっけ？次回確認したい。",
    resolved: false,
    createdAt: "2026-05-21T20:13:00.000Z",
  },
];

// 後方互換: 古い MOCK_TOOL_CARDS は MVP では使わないが、export は残す
export const MOCK_TOOL_CARDS = [] as const;

// ====== サイドバー用: 科目 / 教材 ======

export const MOCK_SUBJECTS: Subject[] = [
  { id: "subj-english", name: "英語" },
];

export const MOCK_MATERIALS: Material[] = [
  {
    id: "mat-english-textbook",
    subjectId: "subj-english",
    name: "中2 英語 教科書",
    label: "テキスト",
    noteNodeIds: ["grammar", "verb-form", "inf", "inf-noun"],
  },
];
