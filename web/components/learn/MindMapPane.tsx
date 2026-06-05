"use client";

/**
 * MindMapPane - Pane 2 の新実装。React Flow + dagre で本格マインドマップ。
 *
 * - 左→右の階層図（dagre LR レイアウト）
 * - ノードは shadcn の色トークンで描画（生の色クラス禁止）
 * - 「今ここ」は primary 塗り、祖先パスは primary 薄塗り
 * - ズーム・パン・フィットビュー可
 * - ノードクリックで onSelectNode（Pane 3 が切り替わる）
 */

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { MapPin, Network } from "lucide-react";
import type { KnowledgeNode } from "@/lib/learn/types";
import {
  buildMindMapLayout,
  type MindMapNodeData,
} from "@/lib/learn/mindmap-layout";
import { cn } from "@/lib/utils";

type Props = {
  nodes: KnowledgeNode[];
  currentNodeId: string;
  onSelectNode: (id: string) => void;
  /** ビューのタイトル（全体ビュー or 教材名） */
  viewTitle: string;
  /** 表示中のノード数（ヘッダー表示用） */
  visibleNodeCount: number;
  /** まとめノート N9②: ノードごとの理解ステータス (渡した時のみ色分け、opt-in) */
  statusById?: Record<string, "understood" | "open">;
};

function MindMapNode({ data }: NodeProps<Node<MindMapNodeData>>) {
  const { label, isCurrent, isOnPath, depth, status } = data;
  // まとめノート N9②: status が渡された時は理解済み=緑/open=黄 で色分け (最優先)。
  const statusClass =
    status === "understood"
      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
      : status === "open"
        ? "border-amber-400 bg-amber-50 text-amber-900"
        : null;
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0"
        isConnectable={false}
      />
      <div
        className={cn(
          "rounded-lg border-2 px-4 py-2.5 text-sm shadow-sm transition-colors",
          "min-w-[160px] max-w-[220px] cursor-pointer",
          statusClass
            ? statusClass
            : isCurrent
              ? "border-primary bg-primary text-primary-foreground"
              : isOnPath
                ? "border-primary bg-primary/10 text-primary"
                : depth === 0
                  ? "border-foreground/40 bg-card font-medium text-foreground"
                  : "border-border bg-card text-card-foreground hover:border-foreground/40",
        )}
      >
        <div className="flex items-center gap-1.5">
          {isCurrent && <MapPin className="size-4 shrink-0" />}
          <span className="font-medium leading-tight">{label}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!opacity-0"
        isConnectable={false}
      />
    </>
  );
}

const nodeTypes = { mindmap: MindMapNode };

function MindMapInner({
  nodes,
  currentNodeId,
  onSelectNode,
  statusById,
}: Pick<Props, "nodes" | "currentNodeId" | "onSelectNode" | "statusById">) {
  const { fitView } = useReactFlow();

  const { nodes: rfNodes, edges: rfEdges } = useMemo(
    () => buildMindMapLayout(nodes, currentNodeId, statusById),
    [nodes, currentNodeId, statusById],
  );

  // 初期表示で全体に fit（path の周辺にズームしすぎないよう余白広め）
  useEffect(() => {
    const id = window.setTimeout(() => fitView({ padding: 0.15 }), 0);
    return () => window.clearTimeout(id);
  }, [fitView, rfNodes]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      fitView
      fitViewOptions={{ padding: 0.15 }}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function MindMapPane({
  nodes,
  currentNodeId,
  onSelectNode,
  viewTitle,
  visibleNodeCount,
  statusById,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Network className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">体系の地図</h2>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {viewTitle} ({visibleNodeCount} ノード)
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <MindMapInner
            nodes={nodes}
            currentNodeId={currentNodeId}
            onSelectNode={onSelectNode}
            statusById={statusById}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
