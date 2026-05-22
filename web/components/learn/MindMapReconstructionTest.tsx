"use client";

/**
 * MindMapReconstructionTest - 体系図の「思い出す訓練」。
 *
 * - 体系図のノードを空欄カードで表示（構造線は見える）
 * - 画面下部にノード名のラベル候補がランダム順で並ぶ
 * - ドラッグ&ドロップで空欄にラベルを配置
 * - 「答え合わせ」で正誤一括判定、不正解は赤で示す
 * - スキップ可
 *
 * ito19 さんの哲学:
 *   「勉強は記憶だけじゃなく、思い出す練習が重要」
 *   「体系図を能動的に組み立て直すことで、知識の整理が訓練される」
 */

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, SkipForward, X } from "lucide-react";
import type { KnowledgeNode } from "@/lib/learn/types";
import { buildMindMapLayout } from "@/lib/learn/mindmap-layout";
import { cn } from "@/lib/utils";

type Props = {
  allNodes: KnowledgeNode[];
  /** 対象ノード ID（教材ビュー連動）。null/undefined = 全ノード */
  scopeNodeIds?: string[];
  onComplete: () => void;
  onSkip: () => void;
};

// placements: ノード ID → そこに配置されたラベル（= 正解のノード ID）
// 正解時は placements[nodeId] === nodeId
type Placements = Record<string, string | null>;

type NodeData = {
  nodeId: string;
  placedLabelId: string | null;
  showResults: boolean;
  isCorrect: boolean;
  correctName: string;
  labelName: string | null;
};

function DroppableMindMapNode({ data, id }: NodeProps<Node<NodeData>>) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { placedLabelId, showResults, isCorrect, correctName, labelName } =
    data;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0"
        isConnectable={false}
      />
      <div
        ref={setNodeRef}
        className={cn(
          "min-w-[160px] max-w-[220px] rounded-lg border-2 px-4 py-2.5 text-sm shadow-sm transition-all",
          // 状態ごとの色
          showResults
            ? isCorrect
              ? "border-primary bg-primary/10 text-primary"
              : "border-destructive bg-destructive/10 text-destructive"
            : placedLabelId
              ? "border-foreground bg-card text-card-foreground"
              : isOver
                ? "border-primary border-dashed bg-primary/5"
                : "border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground",
        )}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-medium leading-tight">
            {labelName ?? "?"}
          </span>
          {showResults && !isCorrect && (
            <span className="text-[10px] text-muted-foreground">
              正解: {correctName}
            </span>
          )}
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

const nodeTypes = { mindmap: DroppableMindMapNode };

function DraggableLabel({
  nodeId,
  name,
  placed,
}: {
  nodeId: string;
  name: string;
  placed: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: nodeId,
    disabled: placed,
  });
  if (placed) return null;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={cn(
        "cursor-grab rounded-md border-2 border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground shadow-sm transition-all",
        "hover:border-primary hover:bg-primary/5",
        isDragging && "opacity-40",
      )}
    >
      {name}
    </button>
  );
}

export function MindMapReconstructionTest({
  allNodes,
  scopeNodeIds,
  onComplete,
  onSkip,
}: Props) {
  const targetNodes = useMemo(() => {
    if (!scopeNodeIds || scopeNodeIds.length === 0) return allNodes;
    const set = new Set(scopeNodeIds);
    return allNodes.filter((n) => set.has(n.id));
  }, [allNodes, scopeNodeIds]);

  // ラベル候補（シャッフル）
  const shuffledLabels = useMemo(() => {
    const arr = [...targetNodes];
    // 決定論的シャッフル（mount 時 1 回）
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [targetNodes]);

  const [placements, setPlacements] = useState<Placements>({});
  const [showResults, setShowResults] = useState(false);
  const [draggingLabelId, setDraggingLabelId] = useState<string | null>(null);

  // 配置済みラベル ID 集合
  const placedLabelIds = useMemo(
    () => new Set(Object.values(placements).filter((v): v is string => !!v)),
    [placements],
  );

  // 全配置済み
  const allPlaced =
    Object.keys(placements).length === targetNodes.length &&
    Object.values(placements).every((v) => v !== null);

  const nameOf = (id: string | null) =>
    id ? (targetNodes.find((n) => n.id === id)?.name ?? null) : null;

  // React Flow に渡すノード
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const layout = buildMindMapLayout(targetNodes, "");
    const mapped = layout.nodes.map((node) => {
      const placedLabelId = placements[node.id] ?? null;
      const isCorrect = placedLabelId === node.id;
      return {
        ...node,
        data: {
          nodeId: node.id,
          placedLabelId,
          showResults,
          isCorrect,
          correctName: node.data.label,
          labelName: nameOf(placedLabelId),
        },
      };
    });
    return { nodes: mapped, edges: layout.edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNodes, placements, showResults]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingLabelId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingLabelId(null);
    const { active, over } = event;
    if (!over) return;
    const targetNodeId = over.id as string;
    const labelId = active.id as string;
    setPlacements((prev) => {
      const next: Placements = { ...prev };
      // この labelId が既に別ノードに配置されていたら外す
      for (const k of Object.keys(next)) {
        if (next[k] === labelId) next[k] = null;
      }
      next[targetNodeId] = labelId;
      return next;
    });
    setShowResults(false);
  };

  const handleReset = () => {
    setPlacements({});
    setShowResults(false);
  };

  const correctCount = Object.entries(placements).filter(
    ([nodeId, labelId]) => nodeId === labelId,
  ).length;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
          <span className="text-sm font-medium">
            体系の地図 — 復元テスト
          </span>
          <span className="text-xs text-muted-foreground">
            配置: {placedLabelIds.size} / {targetNodes.length}
          </span>
          {showResults && (
            <span className="text-xs">
              <span className="font-semibold text-primary">
                正解 {correctCount}
              </span>{" "}
              /{" "}
              <span className="text-destructive">
                不正解 {targetNodes.length - correctCount}
              </span>
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="size-3" />
              <span>リセット</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowResults(true)}
              disabled={!allPlaced}
              className="gap-1.5"
            >
              <Check className="size-3" />
              <span>答え合わせ</span>
            </Button>
            {showResults && (
              <Button size="sm" variant="default" onClick={onComplete}>
                学習を始める
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="gap-1.5"
            >
              <SkipForward className="size-3" />
              <span>スキップ</span>
            </Button>
          </div>
        </div>

        {/* 中央: マインドマップ */}
        <div className="min-h-0 flex-1">
          <ReactFlowProvider>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              proOptions={{ hideAttribution: true }}
              minZoom={0.2}
              maxZoom={2}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.15 }}
            >
              <Background gap={24} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* 下部: ラベル候補 */}
        <div className="shrink-0 border-t border-border bg-background p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            下のラベルをドラッグして、上の空欄カードに配置してください
          </p>
          <div className="flex flex-wrap gap-2">
            {shuffledLabels.map((node) => (
              <DraggableLabel
                key={node.id}
                nodeId={node.id}
                name={node.name}
                placed={placedLabelIds.has(node.id)}
              />
            ))}
            {placedLabelIds.size === shuffledLabels.length && (
              <p className="text-sm text-muted-foreground">
                全てのラベルが配置されました。「答え合わせ」を押してください。
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ドラッグ中のオーバーレイ */}
      <DragOverlay>
        {draggingLabelId && (
          <div className="rounded-md border-2 border-primary bg-card px-3 py-1.5 text-sm font-medium shadow-lg">
            {nameOf(draggingLabelId)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
