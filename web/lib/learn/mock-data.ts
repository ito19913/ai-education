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
  ExamPrep,
  GoalReview,
  Homework,
  Issue,
  IssueCandidate,
  KnowledgeNode,
  LearningSession,
  LearnSubject,
  LessonReview,
  LongTermGoal,
  Material,
  Memo,
  NodeComprehension,
  Note,
  ReflectionLog,
  ScheduleItem,
  Subject,
  TutorHandoff,
  WeeklyGoal,
} from "./types";

export const MOCK_SUBJECT: LearnSubject = {
  name: "中2 英語",
  unitName: "不定詞 (to + 動詞)",
  pageRange: "p.42-58",
};

export const MOCK_USER: CurrentUser = {
  displayName: "伊藤華英",
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

/**
 * @deprecated MOCK_ISSUES の source: "self" に統合済み。
 * 既存コード（NotePane 旧版）が消えるまでの間だけ残す。
 */
export const MOCK_MEMOS: Memo[] = [
  {
    id: "memo-1",
    nodeId: "inf-noun",
    content: "動名詞 (-ing) と不定詞の名詞的用法、どう使い分けるんだっけ？次回確認したい。",
    resolved: false,
    createdAt: "2026-05-21T20:13:00.000Z",
  },
];

// ====== 課題（Issue）— イシュードリブン思考の本体 ======

export const MOCK_ISSUES: Issue[] = [
  // ====== 本人発（旧メモから昇格） ======
  {
    id: "issue-self-1",
    nodeId: "inf-noun",
    source: "self",
    title: "動名詞 (-ing) と不定詞 名詞的用法、どう使い分け？",
    detail:
      "意味は両方「〜すること」なのに使い分けがあるのが分からない。次回確認したい。",
    status: "open",
    createdAt: "2026-05-21T20:13:00.000Z",
    occurrences: [
      {
        id: "occ-self-1-1",
        detectedAt: "2026-05-21T20:13:00.000Z",
        sessionId: "sess-2026-05-21",
        description: "メモを書いた時点。",
        source: "self",
      },
    ],
    chatThread: [
      {
        id: "ic-self-1-1",
        issueId: "issue-self-1",
        role: "teacher",
        text: "これ、自分でメモしてくれてたやつだね。\n動名詞 -ing と不定詞の名詞的用法、両方「〜すること」って訳すから、確かに見分けつきにくいよね。\nどんな時に「あれ、どっちだろ?」って思った?",
        quickReplies: ["どっちでもいい気がする", "例で考えたい", "違いを教えて"],
        createdAt: "2026-05-22T19:05:00.000Z",
      },
      {
        id: "ic-self-1-2",
        issueId: "issue-self-1",
        role: "learner",
        text: "違いを教えて",
        createdAt: "2026-05-22T19:05:15.000Z",
      },
      {
        id: "ic-self-1-3",
        issueId: "issue-self-1",
        role: "teacher",
        text: "OK！じゃあ 1 つだけ核を渡すね。\n\n**不定詞**は「これからやる感じ」、**動名詞**は「もう動詞そのもの / すでにある行為」のイメージ。\n\n例: I like to swim.（これから泳ぐのが好き＝具体場面）\n   I like swimming.（泳ぐこと自体が好き＝動詞そのもの）\n\nどう、しっくりくる?",
        quickReplies: ["なるほど", "もう少し例ほしい", "まだピンとこない"],
        createdAt: "2026-05-22T19:05:45.000Z",
      },
    ],
  },
  {
    id: "issue-self-2",
    nodeId: "verb-past",
    source: "self",
    title: "不規則動詞、どう覚えるのが効率いいの？",
    detail: "go/went/gone みたいなのが多すぎて混乱する。",
    status: "open",
    createdAt: "2026-04-25T20:40:00.000Z",
    occurrences: [
      {
        id: "occ-self-2-1",
        detectedAt: "2026-04-25T20:40:00.000Z",
        sessionId: "sess-2026-04-25",
        description: "メモを書いた時点。",
        source: "self",
      },
    ],
  },

  // ====== AI 発（会話の中で「届いてない」と検知） ======
  {
    id: "issue-ai-1",
    nodeId: "inf-noun",
    source: "ai-detected",
    title: "「〜すること」を主語に置く感覚が曖昧",
    detail:
      "「To play soccer is fun.」を本人に説明してもらった時、主語に来る感覚を自分の言葉で言えなかった。例文を見て理解しているが、自発的に組み立てる段で詰まる可能性。",
    status: "open",
    createdAt: "2026-05-20T19:30:00.000Z",
    triggerMessageId: "m-noun-2",
    occurrences: [
      {
        id: "occ-ai-1-1",
        detectedAt: "2026-05-20T19:30:00.000Z",
        sessionId: "sess-2026-05-20",
        triggerMessageId: "m-noun-2",
        description:
          "AI: 「自分の言葉で『名詞的用法』を説明してみて」→ 本人:「動詞を名詞っぽく使えるやつ…？」（短い、曖昧）",
        source: "ai-detected",
      },
    ],
    chatThread: [
      {
        id: "ic-ai-1-1",
        issueId: "issue-ai-1",
        role: "teacher",
        card: {
          kind: "trigger-message-quote",
          sourceMessageId: "m-noun-2",
          sourceNodeId: "inf-noun",
          quote:
            "動詞を名詞っぽく使えるやつ…？",
          sourceCreatedAt: "2026-05-20T19:30:00.000Z",
        },
        createdAt: "2026-05-22T19:00:00.000Z",
      },
      {
        id: "ic-ai-1-2",
        issueId: "issue-ai-1",
        role: "teacher",
        text: "5/20 の会話でこう言ってたよね。\nあの時「主語に置く感覚」がフワッとしてそうだったから、今もう一度だけ確認してみる?\n\nたとえば「To play soccer is fun.」、これ訳せる?",
        quickReplies: ["訳してみる", "ヒントほしい", "もう大丈夫"],
        createdAt: "2026-05-22T19:00:05.000Z",
      },
    ],
  },
  {
    id: "issue-ai-2",
    nodeId: "modal-may",
    source: "ai-detected",
    title: "may の「許可」と「推量」の文脈判断が定まっていない",
    detail:
      "「You may go.」と「It may rain.」で意味が違うことを説明したが、本人の言い換えが似たような訳になった。",
    status: "open",
    createdAt: "2026-05-08T20:30:00.000Z",
    aiSuggestedClear: false,
    occurrences: [
      {
        id: "occ-ai-2-1",
        detectedAt: "2026-05-08T20:30:00.000Z",
        sessionId: "sess-2026-05-08",
        description: "本人の言い換えが文脈別になっておらず、両方「〜してもいい」と訳した。",
        source: "ai-detected",
      },
    ],
  },
  {
    id: "issue-ai-3",
    nodeId: "passive-basic",
    source: "ai-detected",
    title: "過去分詞の形がパッと出てこない",
    detail:
      "受動態 be + 過去分詞の形は理解しているが、不規則動詞の過去分詞が口頭で出てこなかった。",
    status: "open",
    createdAt: "2026-05-13T19:45:00.000Z",
    aiSuggestedClear: false,
    occurrences: [
      {
        id: "occ-ai-3-1",
        detectedAt: "2026-05-13T19:45:00.000Z",
        sessionId: "sess-2026-05-13",
        description:
          "「The book was written by him.」で written がすぐ出ず、「write の過去形…wrote…written…」と詰まった。",
        source: "ai-detected",
      },
    ],
  },

  // ====== AI が「もうクリアして OK」と提案している例 ======
  {
    id: "issue-ai-4",
    nodeId: "inf-adj",
    source: "ai-detected",
    title: "「前の名詞を後ろから飾る」が曖昧だった",
    detail: "I have something to eat. の to eat が something を飾っている、が言えなかった。",
    status: "open",
    createdAt: "2026-05-13T19:00:00.000Z",
    aiSuggestedClear: true,
    aiSuggestedClearReason:
      "5/17 のセッションで「形容詞的用法って後ろから前を飾るんだよね？」と本人から自発的に出た。理解が定着した可能性が高い。",
    occurrences: [
      {
        id: "occ-ai-4-1",
        detectedAt: "2026-05-13T19:00:00.000Z",
        sessionId: "sess-2026-05-13",
        description: "形容詞的用法の説明で詰まった。",
        source: "ai-detected",
      },
    ],
  },

  // ====== クリア済みの例（履歴感を出す） ======
  {
    id: "issue-self-3",
    nodeId: "future",
    source: "self",
    title: "will と be going to の違いがフワッとしている",
    status: "resolved",
    createdAt: "2026-04-22T19:25:00.000Z",
    resolvedAt: "2026-04-29T19:55:00.000Z",
    summary:
      "will = その場で決めた未来 / be going to = 前から決まってる未来、で本人が自発的に整理。例文を 5 つ作って全部正しく使い分けできた。",
    occurrences: [
      {
        id: "occ-self-3-1",
        detectedAt: "2026-04-22T19:25:00.000Z",
        sessionId: "sess-2026-04-22",
        description: "メモを書いた時点。",
        source: "self",
      },
    ],
    chatThread: [
      {
        id: "ic-self-3-1",
        issueId: "issue-self-3",
        role: "teacher",
        text: "will と be going to の違い、自分でメモしてくれたんだね。\nまずどんな違いをイメージしてる?",
        createdAt: "2026-04-29T19:30:00.000Z",
      },
      {
        id: "ic-self-3-2",
        issueId: "issue-self-3",
        role: "learner",
        text: "どっちも「〜するつもり」って訳すから、違いがよく分からない。",
        createdAt: "2026-04-29T19:30:45.000Z",
      },
      {
        id: "ic-self-3-3",
        issueId: "issue-self-3",
        role: "teacher",
        text: "うん、訳は似てるよね。核は「いつ決めたか」だよ。\n- will: 今その場で決めた\n- be going to: 前から決まってた\n\n例: 電話が鳴った → I'll get it!（今決めた）\n   I'm going to study tonight.（前から決めてた）",
        createdAt: "2026-04-29T19:31:30.000Z",
      },
      {
        id: "ic-self-3-4",
        issueId: "issue-self-3",
        role: "learner",
        text: "あ、なるほど。じゃあ「明日テストだから勉強する」は be going to の方が自然?",
        createdAt: "2026-04-29T19:32:30.000Z",
      },
      {
        id: "ic-self-3-5",
        issueId: "issue-self-3",
        role: "teacher",
        text: "そうそう、その通り。「明日テストある」は前から知ってる事だから be going to。\nクリアして OK そう?",
        card: {
          kind: "resolve-suggestion",
          reason: "本人から「明日テストだから〜」の例を正しく使い分けて出せた。",
        },
        quickReplies: ["クリアして", "もう少し練習したい"],
        createdAt: "2026-04-29T19:33:00.000Z",
      },
      {
        id: "ic-self-3-6",
        issueId: "issue-self-3",
        role: "learner",
        text: "クリアして",
        createdAt: "2026-04-29T19:55:00.000Z",
      },
      {
        id: "ic-self-3-7",
        issueId: "issue-self-3",
        role: "teacher",
        text: "OK、クリアしておくね。お疲れさま！",
        createdAt: "2026-04-29T19:55:05.000Z",
      },
    ],
  },
];

/**
 * SessionEndDialog で「今日 AI が見つけた課題候補」として
 * 提示するためのモック候補。本人がチェックして採用 → MOCK_ISSUES に
 * 追加されていく流れ。MVP は state ローカルで完結する。
 */
export const MOCK_SESSION_ISSUE_CANDIDATES: IssueCandidate[] = [
  {
    id: "cand-1",
    nodeId: "inf-noun",
    title: "動名詞との使い分けで詰まった瞬間があった",
    detail:
      "「to play と playing の違いは？」と聞いたら、両方「〜すること」と返ってきた。違いに自分で気づけない可能性。",
    triggerMessageId: "m-noun-2",
    // 既存課題と同トピックなので統合提案
    suggestedLinkIssueId: "issue-self-1",
  },
  {
    id: "cand-2",
    nodeId: "inf-noun",
    title: "主語に置く感覚をもう一度確認したい",
    detail:
      "「To play soccer is fun.」の主語が長いことに違和感を示した。日本語の感覚に引きずられている。",
    triggerMessageId: "m-noun-3",
  },
  {
    id: "cand-3",
    nodeId: "inf",
    title: "3 つの用法を区別する判断材料を整理できていない",
    detail:
      "名詞的・形容詞的・副詞的の見分け方を聞いた時、「うーん」と長く詰まった。判断軸が頭にない。",
  },
];

// 後方互換: 古い MOCK_TOOL_CARDS は MVP では使わないが、export は残す
export const MOCK_TOOL_CARDS = [] as const;

// ====== サイドバー用: 科目 / 教材 ======

export const MOCK_SUBJECTS: Subject[] = [
  {
    id: "subj-english",
    name: "英語",
    teacher: {
      name: "あおい",
      displayName: "あおい先生",
      avatarLetter: "あ",
      subtitle: "英語の先生",
    },
  },
];

/**
 * MOCK_TREE の root ノード ID → subject ID 対応（Phase 3 追加）。
 * 履歴集約などで `resolveSubjectIdForNode` が使う。
 * 将来 subjects 複数化された際はここに数学・国語等の root を追加していく。
 */
export const ROOT_NODE_TO_SUBJECT: Record<string, string> = {
  grammar: "subj-english",
};

// ====== 学習セッション履歴 (mock) ======

export const MOCK_SESSIONS: LearningSession[] = [
  // ====== 4 月後半 ======
  {
    id: "sess-2026-04-22",
    learnerId: "girl",
    startedAt: "2026-04-22T19:00:00.000Z",
    endedAt: "2026-04-22T19:28:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["grammar", "verb-tense", "be-past"],
    messageCount: 9,
    noteEditCount: 1,
    subjectId: "subj-english",
    comprehensionScore: 0.72,
    summary: {
      learned: [
        "中2 英語文法の全体マップを初めて眺めた",
        "be 動詞の過去形（was / were）の使い分けを言えた",
      ],
      questions: ["過去進行形と過去形ってどう違うんだっけ？"],
    },
  },
  {
    id: "sess-2026-04-25",
    learnerId: "girl",
    startedAt: "2026-04-25T20:10:00.000Z",
    endedAt: "2026-04-25T20:42:00.000Z",
    endReason: "auto-idle",
    visitedNodeIds: ["verb-tense", "verb-past", "past-progressive"],
    messageCount: 11,
    noteEditCount: 2,
    subjectId: "subj-english",
    comprehensionScore: 0.66,
    summary: {
      learned: ["一般動詞の過去形（規則・不規則）の概略", "過去進行形の形（was/were + -ing）"],
      questions: ["不規則動詞の覚え方が分からない"],
    },
  },
  {
    id: "sess-2026-04-29",
    learnerId: "girl",
    startedAt: "2026-04-29T19:30:00.000Z",
    endedAt: "2026-04-29T20:05:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["verb-tense", "future"],
    messageCount: 13,
    noteEditCount: 2,
    subjectId: "subj-english",
    comprehensionScore: 0.81,
    summary: {
      learned: ["未来表現の will と be going to の違い"],
      questions: [],
    },
  },

  // ====== 5 月前半 ======
  {
    id: "sess-2026-05-02",
    learnerId: "girl",
    startedAt: "2026-05-02T18:00:00.000Z",
    endedAt: "2026-05-02T18:25:00.000Z",
    endReason: "auto-idle",
    visitedNodeIds: ["grammar", "modal", "modal-must"],
    messageCount: 7,
    noteEditCount: 1,
    subjectId: "subj-english",
    comprehensionScore: 0.55,
    summary: {
      learned: ["助動詞は「動詞に意味を足すツール」と整理"],
      questions: ["must と have to ってほぼ同じ？違いがあるなら何？"],
    },
  },
  {
    id: "sess-2026-05-08",
    learnerId: "girl",
    startedAt: "2026-05-08T20:00:00.000Z",
    endedAt: "2026-05-08T20:48:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["modal", "modal-should", "modal-may"],
    messageCount: 16,
    noteEditCount: 3,
    subjectId: "subj-english",
    comprehensionScore: 0.74,
    summary: {
      learned: ["should / may / might の意味の幅"],
      questions: ["may は「許可」と「推量」どっちでも取れる時、どう判断する？"],
    },
  },
  {
    id: "sess-2026-05-13",
    learnerId: "girl",
    startedAt: "2026-05-13T19:15:00.000Z",
    endedAt: "2026-05-13T19:55:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["passive", "passive-basic", "passive-by"],
    messageCount: 14,
    noteEditCount: 3,
    reconstructionResult: { correctCount: 25, totalCount: 33 },
    subjectId: "subj-english",
    comprehensionScore: 0.68,
    summary: {
      learned: ["受動態の基本形 be + 過去分詞", "by 〜 は必要な時だけつける"],
      questions: ["過去分詞ってどう作るんだっけ？不規則のやつが怪しい"],
    },
  },

  // ====== 5 月後半 ======
  {
    id: "sess-2026-05-17",
    learnerId: "girl",
    startedAt: "2026-05-17T18:30:00.000Z",
    endedAt: "2026-05-17T19:10:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["comparison", "comparative", "superlative", "as-as"],
    messageCount: 17,
    noteEditCount: 4,
    subjectId: "subj-english",
    comprehensionScore: 0.78,
    summary: {
      learned: ["比較級・最上級・同等比較の使い分け"],
      questions: ["as 〜 as の中身は原級って原則、忘れそう"],
    },
  },
  {
    id: "sess-2026-05-20",
    learnerId: "girl",
    startedAt: "2026-05-20T19:00:00.000Z",
    endedAt: "2026-05-20T19:35:00.000Z",
    endReason: "manual",
    visitedNodeIds: ["grammar", "verb-form", "inf", "inf-noun"],
    messageCount: 12,
    noteEditCount: 2,
    reconstructionResult: { correctCount: 28, totalCount: 33 },
    subjectId: "subj-english",
    comprehensionScore: 0.7,
    summary: {
      learned: [
        "中2 英語文法の全体構造（7 つのグループ）を辿った",
        "動詞の派生形は不定詞と動名詞の 2 系統あることを掴んだ",
        "不定詞 名詞的用法の「〜すること」感覚を自分の言葉で説明できた",
      ],
      questions: [
        "動名詞 -ing と不定詞 名詞的用法、どう使い分けるんだっけ？",
      ],
    },
  },
  {
    id: "sess-2026-05-21",
    learnerId: "girl",
    startedAt: "2026-05-21T19:30:00.000Z",
    endedAt: "2026-05-21T20:05:00.000Z",
    endReason: "auto-idle",
    visitedNodeIds: ["inf", "inf-noun", "inf-adj"],
    messageCount: 8,
    noteEditCount: 1,
    reconstructionResult: { correctCount: 30, totalCount: 33 },
    subjectId: "subj-english",
    comprehensionScore: 0.62,
    summary: {
      learned: [
        "不定詞の形容詞的用法（前の名詞を後ろから説明する）の感覚",
        "I have something to eat. のパターンを自分で言えるようになった",
      ],
      questions: [
        "「to + 動詞」と「~ing」って、見た目では区別つくけど、意味の違いがまだ曖昧",
        "副詞的用法ってまだやってないけど、どこに位置するの？",
      ],
    },
  },
  {
    id: "sess-2026-05-22",
    learnerId: "girl",
    startedAt: "2026-05-22T18:45:00.000Z",
    endedAt: "2026-05-22T19:50:00.000Z",
    endReason: "manual",
    visitedNodeIds: [
      "verb-form",
      "inf",
      "inf-noun",
      "inf-adj",
      "inf-adv",
      "inf-adv-purpose",
    ],
    messageCount: 18,
    noteEditCount: 4,
    subjectId: "subj-english",
    comprehensionScore: 0.45, // 浅め: AI が「上のノードに戻ろう」と提案する材料
    summary: {
      learned: [
        "不定詞 3 用法（名詞的・形容詞的・副詞的）の全体像を整理",
        "副詞的用法の「目的」(〜するために) の使い方",
        "I went to the library to study. のような文を自分で組み立てられた",
      ],
      questions: [
        "副詞的用法の「結果」と「目的」、どう見分けるの？",
        "形容詞的用法と副詞的用法、前の言葉によって判断するで合ってる？",
      ],
    },
  },
];

// ============================================================================
// NodeComprehension — ノード単位の AI 理解度判定 (Phase 3 拡張、2026-05-24 復活)
//
// 旧版（バナー方式の UI）は撤去したが、ARCHITECTURE.md が「ゆいが読む重要型」
// として位置付けているため、Phase 6 (Claude API) で「ゆいへの入力アダプタ」
// の土台として mock を復活させた。
//
// 同じ判定信号は MOCK_ISSUES.source: "ai-detected" や MOCK_SESSION_ISSUE_CANDIDATES
// にも表現されるが、NodeComprehension は「ノード単位の浅さ・戻り先提案」を
// 軸にした補完的な信号源として並走する。
// ============================================================================

export const MOCK_NODE_COMPREHENSIONS: NodeComprehension[] = [
  // 副詞的用法（浅め）。親ノード inf に戻る提案。sess-2026-05-22 の comprehensionScore: 0.45 と整合。
  {
    nodeId: "inf-adv",
    score: 0.45,
    reason:
      "副詞的用法の 3 種類（目的・結果・原因）を 1 つも自分の言葉で言い分けできなかった。例文を見せれば理解できるが、自発的な分類ができない。",
    suggestedNodeId: "inf",
    sessionId: "sess-2026-05-22",
    createdAt: "2026-05-22T19:48:00.000Z",
  },
  // 過去分詞（中）。issue-ai-3 と同根の判定。
  {
    nodeId: "passive-basic",
    score: 0.62,
    reason:
      "受動態 be + 過去分詞の形は理解しているが、不規則動詞の過去分詞が口頭で詰まった。形は理解、語彙が定着途中。",
    suggestedNodeId: "verb-past",
    sessionId: "sess-2026-05-13",
    createdAt: "2026-05-13T19:50:00.000Z",
  },
];

// ============================================================================
// 振り返り / コーチング契約 / 申し送り (Phase 3 拡張、C2 で追加)
//
// ARCHITECTURE.md「振り返りとコーチング契約」セクションの実装。
// REVIEW-2026-05-24.md で「ARCHITECTURE.md と実装の乖離（仕様詐欺）」と
// 指摘された 6 型のうち、5 型 + NodeComprehension mock を C2 で投入する。
//
// 今日 = 2026-05-24（日曜）想定:
//   - ReflectionLog: 5/18(月)〜5/24(日) の 7 日分（うち日次 5、週次 1、月次 1）
//   - 学習セッションがあった日（5/20, 5/21, 5/22）と無かった日（5/18, 5/19, 5/23）を混ぜる
//   - LongTermGoal: 2026 年 5 月の月次ゴール
//   - WeeklyGoal: 5/18 週のゴール（不定詞 3 用法を自分の言葉で）
//   - GoalReview: WeeklyGoal の週末振り返り
//   - TutorHandoff: ゆい → 葵 の申し送り 2 件（excavation 経由 / メタ質問経由）
// ============================================================================

export const MOCK_REFLECTION_LOGS: ReflectionLog[] = [
  // ====== 5/18 (月) daily ======
  {
    id: "ref-2026-05-18",
    learnerId: "girl",
    date: "2026-05-18",
    cadence: "daily",
    yesterdayReview: "日曜は学習お休み。",
    schoolToday: "数学で平方完成のやり方、英語でリスニング小テスト。",
    emotionsAndEvents:
      "リスニング、ちょっと聞き取れなかった単語あって悔しい。あと友達と昼休み楽しかった。",
    questionsAndDoubts: "平方完成の途中の式が、なんでそう変形できるのか分かんない。",
    todayPlan: "今日は数学のワークだけやる。英語はお休み。",
    derivedIssueIds: [],
    derivedScheduleItemIds: [],
    createdAt: "2026-05-18T07:30:00.000Z",
  },
  // ====== 5/20 (水) daily — sess-2026-05-20 と連動 ======
  {
    id: "ref-2026-05-20",
    learnerId: "girl",
    date: "2026-05-20",
    cadence: "daily",
    yesterdayReview: "昨日は学校から帰ってすぐ寝ちゃった。学習なし。",
    schoolToday: "英語で不定詞の名詞的用法。to + 動詞で「〜すること」になるやつ。",
    emotionsAndEvents: "今日は元気。",
    questionsAndDoubts:
      "「To play soccer is fun.」みたいに、文の最初に to が来るやつ、自分で組み立てる自信ない。",
    todayPlan: "今日 ゆい先生のとこで不定詞 名詞的用法、葵先生と話す。",
    derivedIssueIds: ["issue-ai-1"],
    derivedScheduleItemIds: [],
    createdAt: "2026-05-20T18:55:00.000Z",
  },
  // ====== 5/21 (木) daily — sess-2026-05-21 と連動 ======
  {
    id: "ref-2026-05-21",
    learnerId: "girl",
    date: "2026-05-21",
    cadence: "daily",
    yesterdayReview:
      "葵先生と不定詞 名詞的用法、けっこう話した。「to play は『これからやる感じ』」って言われて、ちょっと掴めた気がする。でも動名詞との違いはまだフワッとしてる。",
    schoolToday: "数学で関数の応用問題。",
    emotionsAndEvents: "ちょっと疲れた。今日は短めにしたい。",
    questionsAndDoubts: "動名詞 -ing と不定詞 名詞的用法、結局どう使い分けるの？",
    todayPlan: "形容詞的用法を軽く触って終わる。30 分だけ。",
    derivedIssueIds: ["issue-self-1"],
    derivedScheduleItemIds: [],
    createdAt: "2026-05-21T19:25:00.000Z",
  },
  // ====== 5/22 (金) daily — sess-2026-05-22 と連動、副詞的用法 浅め ======
  {
    id: "ref-2026-05-22",
    learnerId: "girl",
    date: "2026-05-22",
    cadence: "daily",
    yesterdayReview:
      "形容詞的用法は「前の名詞を後ろから飾る」で、I have something to eat. の例で自分で言えた。動名詞との使い分けは保留。",
    schoolToday:
      "英語で不定詞の副詞的用法。「〜するために」が出てきて、目的・結果・原因の 3 つあるって言われた。",
    emotionsAndEvents: "授業中、3 つの違いがフワッとしてて、置いてかれた感じあった。",
    questionsAndDoubts:
      "副詞的用法の「結果」と「目的」、どう見分けるの？前の言葉で判断するんだっけ？",
    todayPlan: "今日は副詞的用法を葵先生と話す。3 つの違いを言葉にしたい。",
    derivedIssueIds: [],
    derivedScheduleItemIds: [],
    derivedHandoffIds: ["handoff-2026-05-22-1"],
    createdAt: "2026-05-22T18:40:00.000Z",
  },
  // ====== 5/23 (土) daily — 学校なし / 学習なし ======
  {
    id: "ref-2026-05-23",
    learnerId: "girl",
    date: "2026-05-23",
    cadence: "daily",
    yesterdayReview:
      "副詞的用法 葵先生と話したけど、目的と結果の見分けがまだフワッとしてる。形容詞的用法と副詞的用法も、前の言葉で判断ってちょっと違う気がする…？",
    schoolToday: "（土曜なので学校なし）",
    emotionsAndEvents: "週末で気持ち楽。でも来週水曜の英語小テスト、不定詞が範囲だから不安。",
    questionsAndDoubts: "副詞的用法の 3 種類、自分の言葉で言える?",
    todayPlan: "今日は休む。日曜に小テストの不安を ゆい先生に話す。",
    derivedIssueIds: [],
    derivedScheduleItemIds: [],
    createdAt: "2026-05-23T09:00:00.000Z",
  },
  // ====== 5/18 週 weekly (5/24 日曜 = 今日に記録) ======
  {
    id: "ref-week-2026-05-18",
    learnerId: "girl",
    date: "2026-05-24",
    cadence: "weekly",
    weekStart: "2026-05-18",
    goalIds: ["wgoal-2026-05-18"],
    yesterdayReview:
      "今週は不定詞を 3 用法とも触った週。名詞・形容詞・副詞の順で、副詞が一番フワッとしてる。",
    questionsAndDoubts:
      "副詞的用法の 3 種類（目的・結果・原因）の見分け。これは来週、葵先生にもう一回。",
    todayPlan: "来週: 副詞的用法 3 種類を自分の言葉で言えるようにする。動名詞との使い分けも一緒に。",
    derivedIssueIds: ["issue-self-1"],
    derivedHandoffIds: ["handoff-2026-05-22-1"],
    createdAt: "2026-05-24T08:30:00.000Z",
  },
  // ====== 2026 年 5 月 monthly (5/24 日曜 = 今日に記録、中間まとめ) ======
  {
    id: "ref-month-2026-05",
    learnerId: "girl",
    date: "2026-05-24",
    cadence: "monthly",
    goalIds: ["lgoal-2026-05"],
    yesterdayReview:
      "5 月は助動詞 → 受動態 → 比較 → 不定詞 と、けっこう色々触った。「教えてもらう」じゃなくて「葵先生と話して自分で言う」のが少し慣れてきた。",
    emotionsAndEvents:
      "学習開始の儀式や、終わりの「お疲れさま」のループがあると、サボった日も罪悪感少ない。前みたいに「今日もできなかった…」ってならない。",
    questionsAndDoubts: "覚えるんじゃなくて整理する、って感覚がまだ完全には掴めてない。",
    todayPlan: "6 月: 期末（6/3）までに不定詞をクリア、その後 ing 形と関係詞へ。",
    createdAt: "2026-05-24T08:45:00.000Z",
  },
];

export const MOCK_LONG_TERM_GOALS: LongTermGoal[] = [
  {
    id: "lgoal-2026-05",
    learnerId: "girl",
    scope: "month",
    scopeLabel: "2026 年 5 月",
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    title: "英語に「自分から触る」感覚を作る",
    detail:
      "テストの点じゃなくて、葵先生との会話で「自分で気づいた」と言える瞬間を週 3 つ。",
    status: "active",
    createdAt: "2026-05-01T08:00:00.000Z",
  },
];

export const MOCK_WEEKLY_GOALS: WeeklyGoal[] = [
  {
    id: "wgoal-2026-05-18",
    learnerId: "girl",
    weekStart: "2026-05-18",
    parentGoalId: "lgoal-2026-05",
    title: "不定詞 3 用法を自分の言葉で言える",
    detail: "名詞 / 形容詞 / 副詞、それぞれ「いつ使うか」を自分で 1 文ずつ。",
    status: "active",
    createdAt: "2026-05-18T08:00:00.000Z",
  },
];

export const MOCK_GOAL_REVIEWS: GoalReview[] = [
  {
    id: "greview-wgoal-2026-05-18",
    goalId: "wgoal-2026-05-18",
    learnerId: "girl",
    reviewDate: "2026-05-24",
    reflection:
      "名詞的・形容詞的は自分の言葉で言えた。副詞的は 3 種類の違いがフワッとしてて、まだ言葉にできてない。「ちゃんと達成」とは言いきれない。",
    achievementPct: 65,
    nextActions: [
      "副詞的用法の 3 種類（目的・結果・原因）を、葵先生ともう一回。",
      "動名詞 -ing との使い分けと合わせて、5 月最終週で仕上げる。",
    ],
    createdAt: "2026-05-24T08:35:00.000Z",
  },
];

export const MOCK_HANDOFFS: TutorHandoff[] = [
  // 5/22 振り返りの「目的と結果の見分け」掘り起こしから派生
  {
    id: "handoff-2026-05-22-1",
    fromTutor: true,
    toSubjectId: "subj-english",
    relatedNodeId: "inf-adv",
    relatedIssueId: undefined,
    title: "副詞的用法 — 目的・結果・原因の見分けで混乱中",
    body: [
      "**ゆいから葵先生へ**",
      "",
      "今日の振り返りで本人がこう言ってました:",
      "> 副詞的用法の「結果」と「目的」、どう見分けるの？前の言葉で判断するんだっけ？",
      "",
      "**所感**: 形容詞的用法（前の名詞を後ろから飾る）と副詞的用法を「前の言葉で判断」と混同してる気配。",
      "「前の言葉」じゃなくて「to + 動詞 全体が何を修飾するか」が軸だと思うので、",
      "ノード `inf` まで戻って **3 用法を並べて比較する** 形で対話してもらえると、本人の中で言葉になりそう。",
      "",
      "急ぎではないですが、次回 inf-adv の chat 開いた時に頭の片隅に置いといてください。",
    ].join("\n"),
    status: "unread",
    createdAt: "2026-05-22T18:42:00.000Z",
  },
  // 過去分詞の口頭詰まり (issue-ai-3) に紐づく申し送り（既読済み、5/13 の判定からの派生）
  {
    id: "handoff-2026-05-13-1",
    fromTutor: true,
    toSubjectId: "subj-english",
    relatedNodeId: "passive-basic",
    relatedIssueId: "issue-ai-3",
    title: "過去分詞 — 形は理解 / 口頭で詰まる",
    body: [
      "**ゆいから葵先生へ**",
      "",
      "本人から「不規則動詞、どう覚えるのが効率いいの？」と相談あり。",
      "受動態の chat (5/13) でも `written` がパッと出ず詰まってたので、",
      "**理解じゃなくて語彙の問題** という認識でいてほしいです。",
      "",
      "「覚える」じゃなくて「使い続けて自然に出るようにする」方向で、",
      "短い英作文を組み立てさせる形で接してもらえると、本人の哲学（暗記ではなくツール化）にも沿います。",
    ].join("\n"),
    status: "read",
    createdAt: "2026-05-13T20:00:00.000Z",
    readAt: "2026-05-14T18:30:00.000Z",
  },
];

// ============================================================================
// 学習スケジュール (Phase 1 mock)
//
// 「今日 = 2026-05-22」前提で、ダッシュボードに表示するサンプル。
// - 試験対策: 6/3 期末試験、範囲は不定詞関連 + 助動詞
// - 宿題: 5/24 提出の英語ワーク
// - 授業復習: 5/22 今日の授業で副詞的用法
// - 課題: 既存 MOCK_ISSUES から数件を「今日掘る」として配置
// ============================================================================

export const MOCK_EXAM_PREPS: ExamPrep[] = [
  {
    id: "exam-1",
    subjectId: "subj-english",
    name: "第1回 定期テスト",
    examDate: "2026-06-03",
    scopeNodeIds: [
      "inf",
      "inf-noun",
      "inf-adj",
      "inf-adv",
      "inf-adv-purpose",
      "inf-adv-result",
      "inf-adv-emotion",
      "modal",
      "modal-must",
      "modal-should",
      "modal-may",
    ],
    pageRangeNote: "教科書 p.42-78",
    materialIds: ["mat-english-textbook-g8", "mat-english-workbook-g8"],
    planSummary:
      "試験まで 12 日。範囲を 4 ブロック（不定詞 3 用法 / 助動詞）に分け、前半 8 日で 1 周、後半 4 日で弱点補強と問題集仕上げ。AI 理解度から「不定詞 副詞的用法」と「modal-may」が弱いと判断、その 2 ブロックには 2 日ずつ余裕を持たせる。",
    createdAt: "2026-05-22T08:00:00.000Z",
  },
];

export const MOCK_HOMEWORKS: Homework[] = [
  {
    id: "hw-1",
    subjectId: "subj-english",
    name: "英語ワーク p.32-35（不定詞）",
    dueDate: "2026-05-24",
    materialIds: ["mat-english-workbook-g8"],
    amountNote: "問題数 12 問。穴埋め + 並び替え + 英作文 3 問",
    createdAt: "2026-05-22T08:00:00.000Z",
  },
];

export const MOCK_LESSON_REVIEWS: LessonReview[] = [
  {
    id: "lesson-1",
    subjectId: "subj-english",
    lessonDate: "2026-05-22",
    topic: "不定詞 副詞的用法（目的の to）",
    nodeIds: ["inf-adv", "inf-adv-purpose"],
    createdAt: "2026-05-22T08:00:00.000Z",
  },
];

/**
 * 今日 (2026-05-22) のダッシュボードに並ぶ「今日のタスク」mock。
 *
 * Phase 1 では AI 提案 → 本人編集 のフローを模した結果として
 * すでに「今日やる」が確定している状態を表現する。
 * Phase 2 で chat 作成 UI が乗ったら、source から動的に生成する。
 */
export const MOCK_SCHEDULE_TODAY: ScheduleItem[] = [
  {
    id: "sched-today-1",
    type: "lesson-review",
    sourceId: "lesson-1",
    nodeId: "inf-adv-purpose",
    title: "今日の授業: 不定詞 副詞的用法（目的）",
    detail:
      "学校で I went to the library to study. のパターンを習った。自分の言葉で言えるようにする。",
    date: "2026-05-22",
    estimateMinutes: 15,
    status: "todo",
    aiRationale:
      "今日学校で習った内容は「今日中の復習」が最も効果的（忘却曲線）。",
  },
  {
    id: "sched-today-2",
    type: "exam-prep",
    sourceId: "exam-1",
    nodeId: "inf-noun",
    title: "試験対策: 不定詞 名詞的用法を仕上げる",
    detail:
      "問題集 p.32-33 を解く + 自分の言葉で「〜すること」感覚を説明できるか確認。",
    date: "2026-05-22",
    estimateMinutes: 25,
    status: "todo",
    aiRationale:
      "6/3 試験まで 12 日。不定詞 3 用法は 4 日で 1 周予定。今日が初日。",
  },
  {
    id: "sched-today-3",
    type: "issue",
    sourceId: "issue-self-1",
    nodeId: "inf-noun",
    title: "課題: 動名詞 (-ing) との使い分け",
    detail:
      "5/21 から残っている本人発の課題。AI と話して掘る。",
    date: "2026-05-22",
    estimateMinutes: 15,
    status: "todo",
    aiRationale:
      "試験範囲に含まれる + 5 日以上クリアされていない。今日触れて整理しておくのが効率的。",
  },
  {
    id: "sched-today-4",
    type: "homework",
    sourceId: "hw-1",
    title: "宿題: 英語ワーク p.32-33（半分）",
    detail:
      "5/24 提出。AI と一緒に考え方を確認しながら進める。残り半分は明日。",
    date: "2026-05-22",
    estimateMinutes: 30,
    status: "todo",
    aiRationale:
      "提出日まで 2 日。今日と明日で半分ずつ、考え方を一緒に整理しながら進める。",
  },
];

/**
 * 直近 1 週間の予定（カレンダー描画用、簡易 mock）。
 * 各日に何件タスクがあるかと、内訳の type を表す。
 */
export const MOCK_SCHEDULE_UPCOMING: ScheduleItem[] = [
  // 5/23 (明日)
  {
    id: "s-23-1",
    type: "exam-prep",
    sourceId: "exam-1",
    title: "試験対策: 不定詞 形容詞的用法",
    date: "2026-05-23",
    estimateMinutes: 25,
    status: "todo",
  },
  {
    id: "s-23-2",
    type: "homework",
    sourceId: "hw-1",
    title: "宿題 残り半分（英語ワーク）",
    date: "2026-05-23",
    estimateMinutes: 25,
    status: "todo",
  },
  // 5/24
  {
    id: "s-24-1",
    type: "exam-prep",
    sourceId: "exam-1",
    title: "試験対策: 不定詞 副詞的用法 1/2",
    date: "2026-05-24",
    estimateMinutes: 25,
    status: "todo",
  },
  // 5/25
  {
    id: "s-25-1",
    type: "exam-prep",
    sourceId: "exam-1",
    title: "試験対策: 不定詞 副詞的用法 2/2",
    date: "2026-05-25",
    estimateMinutes: 25,
    status: "todo",
  },
  // 5/27
  {
    id: "s-27-1",
    type: "exam-prep",
    sourceId: "exam-1",
    title: "試験対策: 助動詞 must / have to",
    date: "2026-05-27",
    estimateMinutes: 25,
    status: "todo",
  },
];

export const MOCK_MATERIALS: Material[] = [
  {
    id: "mat-english-textbook-g8",
    subjectId: "subj-english",
    name: "中2 英語 教科書",
    label: "テキスト",
    gradeLevel: "中2",
    // 教科書は中2 範囲全部を扱う想定（33 ノードすべて）
    coveredNodeIds: [
      "grammar",
      "verb-tense",
      "be-past",
      "verb-past",
      "past-progressive",
      "future",
      "verb-form",
      "inf",
      "inf-noun",
      "inf-adj",
      "inf-adv",
      "inf-adv-purpose",
      "inf-adv-result",
      "inf-adv-emotion",
      "gerund",
      "modal",
      "modal-must",
      "modal-should",
      "modal-may",
      "passive",
      "passive-basic",
      "passive-by",
      "comparison",
      "comparative",
      "superlative",
      "as-as",
      "conjunction",
      "conj-coordinate",
      "conj-subordinate",
      "sentence-pattern",
      "svoo",
      "svoc",
      "there-is",
    ],
  },
  {
    id: "mat-english-workbook-g8",
    subjectId: "subj-english",
    name: "中2 英語 問題集（不定詞特化）",
    label: "問題集",
    gradeLevel: "中2",
    // 問題集は不定詞関連だけを扱う
    coveredNodeIds: [
      "inf",
      "inf-noun",
      "inf-adj",
      "inf-adv",
      "inf-adv-purpose",
      "inf-adv-result",
      "inf-adv-emotion",
    ],
  },
  {
    id: "mat-english-sub-g8",
    subjectId: "subj-english",
    name: "中2 英語 副教材（比較・接続詞）",
    label: "副教材",
    gradeLevel: "中2",
    coveredNodeIds: [
      "comparison",
      "comparative",
      "superlative",
      "as-as",
      "conjunction",
      "conj-coordinate",
      "conj-subordinate",
    ],
  },
];
