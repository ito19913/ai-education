/**
 * 単元完了テスト用のヘルパー関数。
 * - 対象ノードとその子孫の問題を集める
 * - 合格判定
 * - 遡及（親ノードの取得）
 */
import type { KnowledgeNode, Question } from "./types";

/**
 * 対象ノードとその全子孫の問題を集める。
 * leaf ノード（inf-noun 等）→ そのノードの問題のみ。
 * 中間 / ルート（inf, grammar 等）→ 自分 + すべての子孫の問題。
 */
export function getQuestionsForNode(
  nodeId: string,
  allNodes: KnowledgeNode[],
  allQuestions: Question[],
): Question[] {
  const descendants = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of allNodes) {
      if (n.parentId === cur && !descendants.has(n.id)) {
        descendants.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return allQuestions.filter((q) => descendants.has(q.nodeId));
}

/** ノードの親 id を返す（ルートなら null） */
export function getParentNodeId(
  nodeId: string,
  allNodes: KnowledgeNode[],
): string | null {
  return allNodes.find((n) => n.id === nodeId)?.parentId ?? null;
}

/** 合格判定: 正解数 / 出題数 が 2/3 (66%) 以上で合格 */
export function isPassing(correct: number, total: number): boolean {
  if (total === 0) return false;
  return correct / total >= 2 / 3;
}

/** ランダムに最大 N 問を選ぶ（決定論的シード、MVP はシンプルに先頭から） */
export function pickQuestions(
  pool: Question[],
  max: number,
): Question[] {
  return pool.slice(0, max);
}
