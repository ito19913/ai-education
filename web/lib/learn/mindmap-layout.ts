/**
 * dagre で knowledge_nodes を自動レイアウトする。
 * 左→右 (LR) の階層図として配置する。
 *
 * React Flow に渡す nodes / edges の position を計算する純粋関数。
 */
import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { KnowledgeNode } from "./types";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 56;

export type MindMapNodeData = {
  label: string;
  isCurrent: boolean;
  isOnPath: boolean;
  depth: number;
  /** まとめノート N9②: 理解ステータス色分け (渡された時のみ)。 */
  status?: "understood" | "open";
};

export function buildMindMapLayout(
  knowledgeNodes: KnowledgeNode[],
  currentNodeId: string,
  statusById?: Record<string, "understood" | "open">,
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  // 現在ノードから親を辿り、ハイライト対象の祖先パスを構築
  const byId = new Map(knowledgeNodes.map((n) => [n.id, n]));
  const pathSet = new Set<string>();
  let cursor = byId.get(currentNodeId);
  while (cursor) {
    pathSet.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  // 各ノードの深さ
  const depthOf = (id: string): number => {
    let d = 0;
    let c = byId.get(id);
    while (c?.parentId) {
      d++;
      c = byId.get(c.parentId);
    }
    return d;
  };

  // dagre グラフ構築
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR", // 左→右
    nodesep: 16, // ノード間（縦方向の隙間）
    ranksep: 80, // ランク間（横方向の隙間）
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of knowledgeNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const node of knowledgeNodes) {
    if (node.parentId) {
      g.setEdge(node.parentId, node.id);
    }
  }

  dagre.layout(g);

  const rfNodes: Node<MindMapNodeData>[] = knowledgeNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "mindmap",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: n.name,
        isCurrent: n.id === currentNodeId,
        isOnPath: pathSet.has(n.id),
        depth: depthOf(n.id),
        status: statusById?.[n.id],
      },
    };
  });

  const rfEdges: Edge[] = knowledgeNodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      id: `${n.parentId}->${n.id}`,
      source: n.parentId!,
      target: n.id,
      type: "smoothstep",
      animated: false,
      style: pathSet.has(n.id)
        ? { stroke: "var(--color-primary)", strokeWidth: 2 }
        : { stroke: "var(--color-border)", strokeWidth: 1 },
    }));

  return { nodes: rfNodes, edges: rfEdges };
}
