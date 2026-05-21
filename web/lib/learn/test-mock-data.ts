/**
 * テスト機能用の mock 問題集。
 * 中2 英語、ノード単位で論点をタグ付け。
 * 後で Supabase に置き換え、最終的には教材 PDF から AI が抽出 + タグ付けする。
 */
import type { Question } from "./types";

export const MOCK_QUESTIONS: Question[] = [
  // ====== 不定詞 名詞的用法 (3 問) ======
  {
    id: "q-noun-1",
    nodeId: "inf-noun",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nMy hobby is __to read books__.",
    choices: [
      "名詞的用法（補語、「〜すること」）",
      "形容詞的用法（前の名詞を説明）",
      "副詞的用法（目的）",
      "副詞的用法（感情の原因）",
    ],
    correctIndex: 0,
    explanation:
      "is の補語として「本を読むこと」と名詞のように働いている → 名詞的用法。",
  },
  {
    id: "q-noun-2",
    nodeId: "inf-noun",
    prompt: "「英語を学ぶことは大切だ。」を英訳した文として正しいものを選びなさい。",
    choices: [
      "To learn English is important.",
      "Learn English is important.",
      "Learning to English is important.",
      "I learn English important.",
    ],
    correctIndex: 0,
    explanation:
      "「〜すること」が文の主語 → 不定詞の名詞的用法（主語の位置）。",
  },
  {
    id: "q-noun-3",
    nodeId: "inf-noun",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nI want __to play soccer__.",
    choices: [
      "名詞的用法（目的語、「〜すること」）",
      "形容詞的用法",
      "副詞的用法（目的）",
      "副詞的用法（結果）",
    ],
    correctIndex: 0,
    explanation: "want の目的語として「サッカーをすることを欲する」→ 名詞的用法。",
  },

  // ====== 不定詞 形容詞的用法 (2 問) ======
  {
    id: "q-adj-1",
    nodeId: "inf-adj",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nI have a lot of homework __to do__.",
    choices: [
      "名詞的用法",
      "形容詞的用法（前の homework を後ろから説明）",
      "副詞的用法（目的）",
      "副詞的用法（結果）",
    ],
    correctIndex: 1,
    explanation:
      "to do が前の名詞「homework」を後ろから説明（やるべき宿題）→ 形容詞的用法。",
  },
  {
    id: "q-adj-2",
    nodeId: "inf-adj",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nI want something __to drink__.",
    choices: [
      "名詞的用法",
      "形容詞的用法（something を後ろから説明）",
      "副詞的用法（目的）",
      "副詞的用法（感情の原因）",
    ],
    correctIndex: 1,
    explanation:
      "to drink が前の代名詞「something」を後ろから説明（飲むための何か）→ 形容詞的用法。",
  },

  // ====== 不定詞 副詞的用法 — 目的 (2 問) ======
  {
    id: "q-adv-purpose-1",
    nodeId: "inf-adv-purpose",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nI went to the library __to study__.",
    choices: [
      "名詞的用法",
      "形容詞的用法",
      "副詞的用法（目的「勉強するために」）",
      "副詞的用法（結果）",
    ],
    correctIndex: 2,
    explanation:
      "「勉強するために」と動詞 went を後ろから飾る → 副詞的用法（目的）。",
  },
  {
    id: "q-adv-emotion-1",
    nodeId: "inf-adv-emotion",
    prompt:
      "次の文の下線部の用法として正しいものを選びなさい:\nI'm glad __to see you__.",
    choices: [
      "名詞的用法",
      "形容詞的用法",
      "副詞的用法（目的）",
      "副詞的用法（感情の原因「あなたに会えて嬉しい」）",
    ],
    correctIndex: 3,
    explanation:
      "形容詞 glad の理由を後ろから説明（会えて → 嬉しい）→ 副詞的用法（感情の原因）。",
  },

  // ====== 動名詞 (1 問) ======
  {
    id: "q-gerund-1",
    nodeId: "gerund",
    prompt:
      "次の文の下線部について正しいものを選びなさい:\n__Playing tennis__ is fun.",
    choices: [
      "動名詞（主語、「テニスをすること」）",
      "不定詞の名詞的用法",
      "現在進行形",
      "形容詞用法",
    ],
    correctIndex: 0,
    explanation:
      "「Playing tennis」が文の主語、動詞 + ing で「〜すること」を意味 → 動名詞。",
  },

  // ====== 過去進行形 (2 問) ======
  {
    id: "q-past-prog-1",
    nodeId: "past-progressive",
    prompt: "「私はそのとき本を読んでいた。」を英訳した文として正しいものを選びなさい。",
    choices: [
      "I read a book then.",
      "I am reading a book then.",
      "I was reading a book then.",
      "I have read a book then.",
    ],
    correctIndex: 2,
    explanation:
      "過去のある時点で「〜していた」→ was/were + 動詞 -ing → 過去進行形。",
  },
  {
    id: "q-past-prog-2",
    nodeId: "past-progressive",
    prompt: "次の文の用法として正しいものを選びなさい:\nShe was cooking dinner at 7 pm.",
    choices: [
      "現在進行形",
      "過去進行形（過去のある時点で進行中）",
      "未来進行形",
      "現在完了進行形",
    ],
    correctIndex: 1,
    explanation: "was + cooking で「7 時に料理していた」→ 過去進行形。",
  },

  // ====== 未来表現 (2 問) ======
  {
    id: "q-future-1",
    nodeId: "future",
    prompt: "「明日サッカーをするつもりだ。」を英訳した文として最もふさわしいものを選びなさい。",
    choices: [
      "I play soccer tomorrow.",
      "I am going to play soccer tomorrow.",
      "I played soccer tomorrow.",
      "I have played soccer tomorrow.",
    ],
    correctIndex: 1,
    explanation:
      "「するつもり」= 予定の未来 → be going to が適切（will でも可だが「予定」のニュアンスは be going to）。",
  },
  {
    id: "q-future-2",
    nodeId: "future",
    prompt:
      "次の文の用法として正しいものを選びなさい:\nI'll help you with your homework.",
    choices: [
      "現在形",
      "現在完了",
      "未来表現（その場で決めた未来、will）",
      "過去進行形",
    ],
    correctIndex: 2,
    explanation: "I'll = I will、その場で決めた未来。",
  },

  // ====== 助動詞 (2 問) ======
  {
    id: "q-modal-must-1",
    nodeId: "modal-must",
    prompt: "「あなたは宿題をしなければならない。」を英訳した文として正しいものを選びなさい。",
    choices: [
      "You can do your homework.",
      "You must do your homework.",
      "You may do your homework.",
      "You should do your homework.",
    ],
    correctIndex: 1,
    explanation: "義務 = must（または have to）。",
  },
  {
    id: "q-modal-should-1",
    nodeId: "modal-should",
    prompt: "「もっと早く寝るべきだ。」を英訳した文として最もふさわしいものを選びなさい。",
    choices: [
      "You must go to bed earlier.",
      "You can go to bed earlier.",
      "You should go to bed earlier.",
      "You may go to bed earlier.",
    ],
    correctIndex: 2,
    explanation: "助言・推奨 = should。義務（must）よりは弱い。",
  },

  // ====== 比較 (1 問) ======
  {
    id: "q-comparative-1",
    nodeId: "comparative",
    prompt: "「この本はあの本より面白い。」を英訳した文として正しいものを選びなさい。",
    choices: [
      "This book is interesting than that book.",
      "This book is more interesting than that book.",
      "This book is most interesting than that book.",
      "This book is interestinger than that book.",
    ],
    correctIndex: 1,
    explanation:
      "interesting のような長い形容詞は -er ではなく more で比較級。「〜より」は than。",
  },
];
