/**
 * Subject resolver - ノード ID から所属 subject を引く utility（Phase 3 追加）。
 *
 * `KnowledgeNode` は `parentId` だけ持ち `subjectId` は直接持たないため、
 * root まで親階層を辿って root ノードを subject に紐付ける。
 *
 * MVP は MOCK_TREE の root が "grammar" 1 本で、それが "subj-english" に対応する。
 * 将来 subjects が複数化されても対応できるよう、root nodeId → subjectId のマップを引数で取る。
 */
import type { KnowledgeNode } from "./types";

/**
 * 指定ノードの所属 subject ID を解決する。
 * 親階層を root まで辿り、root nodeId が rootToSubject に含まれていればその値を返す。
 * 解決できなければ undefined。
 */
export function resolveSubjectIdForNode(
  nodeId: string,
  nodes: KnowledgeNode[],
  rootToSubject: Record<string, string>,
): string | undefined {
  const map = new Map(nodes.map((n) => [n.id, n]));
  let cursor: KnowledgeNode | undefined = map.get(nodeId);
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor.id)) return undefined; // 循環防止
    visited.add(cursor.id);
    if (cursor.parentId === null) {
      return rootToSubject[cursor.id];
    }
    cursor = map.get(cursor.parentId) ?? undefined;
  }
  return undefined;
}

/**
 * 指定 subject に属する全ノード ID の集合を返す。
 * 履歴集約や教材フィルタなどで利用想定。
 */
export function getNodeIdsForSubject(
  subjectId: string,
  nodes: KnowledgeNode[],
  rootToSubject: Record<string, string>,
): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (resolveSubjectIdForNode(node.id, nodes, rootToSubject) === subjectId) {
      ids.add(node.id);
    }
  }
  return ids;
}
