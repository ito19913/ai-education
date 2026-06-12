/**
 * 教材登録の AI 抽出 mock。
 *
 * 本来は PDF を Claude に投げて structured output で得るが、MVP mock では
 * 「中2 英語 教科書」を再アップロードしたシナリオ想定の固定データを返す。
 *
 * 後で Claude API に置き換える時は、この関数の中身を入れ替えるだけで済む。
 */
import type { AiExtractedNode, KnowledgeNode } from "@/lib/learn/types";

/** 中2 英語 教科書を mock 抽出した想定の結果（既存ノードに合致） */
const MOCK_EXTRACTION_TEMPLATE: Omit<AiExtractedNode, "matchedNodeId">[] = [
  {
    tempId: "ai-1",
    name: "中2 英語文法",
    parentRef: null,
    description: "教科書の全体構造。動詞・助動詞・受動態・比較・接続詞・文型。",
    pageRange: "p.1-200",
    confidence: 0.99,
  },
  {
    tempId: "ai-2",
    name: "動詞の時制と相",
    parentRef: "ai-1",
    description: "be 動詞の過去形、一般動詞の過去形、過去進行形、未来表現。",
    pageRange: "p.4-32",
    confidence: 0.96,
  },
  {
    tempId: "ai-3",
    name: "動詞の派生形",
    parentRef: "ai-1",
    description: "不定詞と動名詞、動詞を別の品詞のように使うツール群。",
    pageRange: "p.34-72",
    confidence: 0.98,
  },
  {
    tempId: "ai-4",
    name: "不定詞 (to + 動詞)",
    parentRef: "ai-3",
    description: "動詞の前に to を置く形。3 つの用法。",
    pageRange: "p.42-58",
    confidence: 0.99,
  },
  {
    tempId: "ai-5",
    name: "名詞的用法",
    parentRef: "ai-4",
    description: "「〜すること」を意味して、主語・目的語・補語になる。",
    pageRange: "p.42-48",
    confidence: 0.97,
  },
  {
    tempId: "ai-6",
    name: "形容詞的用法",
    parentRef: "ai-4",
    description: "前の名詞を後ろから説明する。",
    pageRange: "p.49-53",
    confidence: 0.95,
  },
  {
    tempId: "ai-7",
    name: "副詞的用法",
    parentRef: "ai-4",
    description: "動詞や形容詞を後ろから飾る。目的・結果・感情の原因の 3 種。",
    pageRange: "p.54-58",
    confidence: 0.94,
  },
  {
    tempId: "ai-8",
    name: "動名詞 (-ing)",
    parentRef: "ai-3",
    description: "動詞 + ing で「〜すること」を意味、名詞のように使う。",
    pageRange: "p.60-72",
    confidence: 0.96,
  },
  {
    tempId: "ai-9",
    name: "助動詞",
    parentRef: "ai-1",
    description: "動詞に意味（義務・可能・推量）を足す。must / should / may。",
    pageRange: "p.74-100",
    confidence: 0.97,
  },
  {
    tempId: "ai-10",
    name: "受動態",
    parentRef: "ai-1",
    description: "「〜される」。be + 過去分詞。",
    pageRange: "p.102-128",
    confidence: 0.98,
  },
  {
    tempId: "ai-11",
    name: "比較",
    parentRef: "ai-1",
    description: "比較級・最上級・同等比較で物を比べる。",
    pageRange: "p.130-156",
    confidence: 0.97,
  },
  {
    tempId: "ai-12",
    name: "接続詞",
    parentRef: "ai-1",
    description: "and / but / when / if などで語や文をつなぐ。",
    pageRange: "p.158-180",
    confidence: 0.96,
  },
];

/**
 * mock 抽出: 既存体系図と照合して matchedNodeId をセット。
 * 名前一致 (前方一致を含む) で合致判定するシンプルロジック。
 */
export function mockExtractNodes(
  existingNodes: KnowledgeNode[],
): AiExtractedNode[] {
  return matchToExistingNodes(MOCK_EXTRACTION_TEMPLATE, existingNodes);
}

/**
 * AI 抽出ノード (matchedNodeId なし) を既存体系図と照合して
 * matchedNodeId を付与する汎用関数。
 *
 * C70 (extract-claude.ts) からの戻り値 (Claude 抽出) と
 * MOCK_EXTRACTION_TEMPLATE (mock 抽出) の両方で再利用するため切り出し。
 *
 * 照合ルール: 名前一致 (完全一致 + 前方一致 / 後方一致を含む)
 */
export function matchToExistingNodes(
  extracted: Array<Omit<AiExtractedNode, "matchedNodeId">>,
  existingNodes: KnowledgeNode[],
): AiExtractedNode[] {
  return extracted.map((node) => {
    const matched = existingNodes.find(
      (n) =>
        n.name === node.name ||
        n.name.startsWith(node.name) ||
        node.name.startsWith(n.name),
    );
    return {
      ...node,
      matchedNodeId: matched?.id ?? null,
    };
  });
}

/** 抽出処理のステップ表示用ステージ */
export type ExtractionStage =
  | "uploading"
  | "ocr"
  | "outline"
  | "matching"
  | "done";

export const EXTRACTION_STAGE_LABELS: Record<ExtractionStage, string> = {
  uploading: "PDF をアップロード中",
  ocr: "テキストを認識中（OCR）",
  outline: "AI が章節構造を抽出中",
  matching: "既存の体系図と照合中",
  done: "完了",
};
