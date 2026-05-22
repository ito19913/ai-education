/**
 * 「今日の範囲を AI 動画で見る」のナレーションスクリプト (mock)。
 *
 * 後で Claude API でノードのパスから動的生成する。
 * mock 段階では「不定詞の名詞的用法」を学ぶ前提のスクリプトを固定で持つ。
 */

export type NarrationStep = {
  id: string;
  /** 読み上げるテキスト */
  text: string;
  /** ハイライトしたいノード */
  focusNodeId: string | null;
  /** その時点で表示しているノード群 */
  visibleNodeIds: string[];
};

/** 不定詞の名詞的用法 (inf-noun) を target にした mock スクリプト */
export const MOCK_OVERVIEW_SCRIPT: NarrationStep[] = [
  {
    id: "intro",
    text: "こんにちは。今日は中2英語の文法の中で、不定詞の名詞的用法を学びます。まず全体の地図を見てみよう。",
    focusNodeId: "grammar",
    visibleNodeIds: ["grammar"],
  },
  {
    id: "top-level",
    text: "中2の英語文法には、大きく7つのグループがあります。動詞の時制と相、動詞の派生形、助動詞、受動態、比較、接続詞、文型。今日はこの中の動詞の派生形を見ていきます。",
    focusNodeId: "grammar",
    visibleNodeIds: [
      "grammar",
      "verb-tense",
      "verb-form",
      "modal",
      "passive",
      "comparison",
      "conjunction",
      "sentence-pattern",
    ],
  },
  {
    id: "verb-form",
    text: "動詞の派生形は、動詞を別の品詞のように使うツール群です。中2では2つを学びます。不定詞と動名詞。",
    focusNodeId: "verb-form",
    visibleNodeIds: [
      "grammar",
      "verb-tense",
      "verb-form",
      "modal",
      "passive",
      "comparison",
      "conjunction",
      "sentence-pattern",
      "inf",
      "gerund",
    ],
  },
  {
    id: "inf",
    text: "今日は不定詞をやります。不定詞には3つの用法があります。名詞的用法、形容詞的用法、副詞的用法。",
    focusNodeId: "inf",
    visibleNodeIds: [
      "grammar",
      "verb-tense",
      "verb-form",
      "modal",
      "passive",
      "comparison",
      "conjunction",
      "sentence-pattern",
      "inf",
      "gerund",
      "inf-noun",
      "inf-adj",
      "inf-adv",
    ],
  },
  {
    id: "target",
    text: "そして今日のテーマは名詞的用法。動詞を名詞のように使うツールです。例えば、サッカーをすること、本を読むこと、と言いたい時に使います。",
    focusNodeId: "inf-noun",
    visibleNodeIds: [
      "grammar",
      "verb-tense",
      "verb-form",
      "modal",
      "passive",
      "comparison",
      "conjunction",
      "sentence-pattern",
      "inf",
      "gerund",
      "inf-noun",
      "inf-adj",
      "inf-adv",
    ],
  },
  {
    id: "outro",
    text: "それじゃあ、始めよう。",
    focusNodeId: "inf-noun",
    visibleNodeIds: [
      "grammar",
      "verb-tense",
      "verb-form",
      "modal",
      "passive",
      "comparison",
      "conjunction",
      "sentence-pattern",
      "inf",
      "gerund",
      "inf-noun",
      "inf-adj",
      "inf-adv",
    ],
  },
];
