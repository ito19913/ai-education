"use client";

/**
 * MindMapReconstructionTest - 体系図の「思い出す訓練」。
 *
 * - 体系図のノードを空欄カードで表示（構造線は見える）
 * - 画面下部にノード名のラベル候補がランダム順で並ぶ
 * - ドラッグ&ドロップで空欄にラベルを配置
 * - **正解した瞬間にカードが緑で確定、間違えた瞬間に赤 × でフィードバック
 *   して 1 秒後にラベルが下に戻る**（一括 答え合わせ方式は廃止）
 * - スキップ可
 *
 * ito19 さんの哲学:
 *   「勉強は記憶だけじゃなく、思い出す練習が重要」
 *   「体系図を能動的に組み立て直すことで、知識の整理が訓練される」
 *   「ミスは学びが起きた瞬間」→ 即時フィードバックで気づきを早める
 */

import { useEffect, useMemo, useRef, useState } from "react";
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

// placements: 正解として配置された labelId（= slotId）のみが入る。
// 不正解は記録されず、ラベルは下のトレイに戻る。
type Placements = Record<string, string>;

/** スロットを赤 × でフラッシュさせる時のデータ */
type WrongFlash = { slotId: string; labelName: string };

type NodeData = {
  nodeId: string;
  /** 正解として配置されているか */
  isPlaced: boolean;
  /** 配置済みなら正解ラベル名（= ノード名そのもの）*/
  placedName: string | null;
  /** 赤 × フラッシュ中なら、その間違ったラベル名 */
  wrongFlashLabel: string | null;
};

function DroppableMindMapNode({ data, id }: NodeProps<Node<NodeData>>) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { isPlaced, placedName, wrongFlashLabel } = data;

  const isWrongFlash = !!wrongFlashLabel;

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
          isWrongFlash
            ? "animate-pulse border-destructive bg-destructive/15 text-destructive"
            : isPlaced
              ? "border-primary bg-primary/10 text-primary"
              : isOver
                ? "border-primary border-dashed bg-primary/5"
                : "border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground",
        )}
      >
        <div className="flex items-center justify-center gap-1">
          {isWrongFlash ? (
            <>
              <X className="size-4 shrink-0" strokeWidth={3} />
              <span className="font-medium leading-tight line-through">
                {wrongFlashLabel}
              </span>
            </>
          ) : isPlaced ? (
            <>
              <Check className="size-3.5 shrink-0" strokeWidth={3} />
              <span className="font-medium leading-tight">{placedName}</span>
            </>
          ) : (
            <span className="font-medium leading-tight">?</span>
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
  // useState の lazy initializer は mount 時に 1 回だけ実行されるので
  // 不純な Math.random をそこに閉じ込めて純粋性を保つ。
  // 一度マウントされた後 scope を切り替える用途は今のところないので、
  // 再シャッフルは不要。
  const [shuffledLabels] = useState<KnowledgeNode[]>(() => {
    const arr = [...targetNodes];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  // 正解として配置済みのもの
  const [placements, setPlacements] = useState<Placements>({});
  // 赤 × フラッシュの transient state
  const [wrongFlash, setWrongFlash] = useState<WrongFlash | null>(null);
  // ミス回数（学習の振り返り用）
  const [wrongAttempts, setWrongAttempts] = useState(0);
  // ドラッグ中のラベル ID（DragOverlay 用）
  const [draggingLabelId, setDraggingLabelId] = useState<string | null>(null);

  const wrongFlashTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (wrongFlashTimerRef.current !== null) {
        window.clearTimeout(wrongFlashTimerRef.current);
      }
    };
  }, []);

  const placedLabelIds = useMemo(
    () => new Set(Object.values(placements)),
    [placements],
  );

  const allPlaced = placedLabelIds.size === targetNodes.length;

  const nameOf = (id: string | null) =>
    id ? (targetNodes.find((n) => n.id === id)?.name ?? null) : null;

  // React Flow に渡すノード
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const layout = buildMindMapLayout(targetNodes, "");
    const mapped = layout.nodes.map((node) => {
      const isPlaced = !!placements[node.id];
      const placedName = isPlaced ? node.data.label : null;
      const wrongFlashLabel =
        wrongFlash && wrongFlash.slotId === node.id
          ? wrongFlash.labelName
          : null;
      return {
        ...node,
        data: {
          nodeId: node.id,
          isPlaced,
          placedName,
          wrongFlashLabel,
        },
      };
    });
    return { nodes: mapped, edges: layout.edges };
  }, [targetNodes, placements, wrongFlash]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingLabelId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingLabelId(null);
    const { active, over } = event;
    if (!over) return;
    const slotId = over.id as string;
    const labelId = active.id as string;

    if (labelId === slotId) {
      // 正解 → 永続配置
      setPlacements((prev) => ({ ...prev, [slotId]: labelId }));
      // 赤フラッシュ中だったら消す（同スロットで再挑戦して正解した場合）
      if (wrongFlash && wrongFlash.slotId === slotId) {
        setWrongFlash(null);
        if (wrongFlashTimerRef.current !== null) {
          window.clearTimeout(wrongFlashTimerRef.current);
          wrongFlashTimerRef.current = null;
        }
      }
    } else {
      // 不正解 → 即フラッシュ、ラベルは置かれず下に戻る
      const wrongLabelName = nameOf(labelId);
      if (!wrongLabelName) return;
      setWrongFlash({ slotId, labelName: wrongLabelName });
      setWrongAttempts((n) => n + 1);
      if (wrongFlashTimerRef.current !== null) {
        window.clearTimeout(wrongFlashTimerRef.current);
      }
      wrongFlashTimerRef.current = window.setTimeout(() => {
        setWrongFlash(null);
        wrongFlashTimerRef.current = null;
      }, 1000);
    }
  };

  const handleReset = () => {
    setPlacements({});
    setWrongFlash(null);
    setWrongAttempts(0);
    if (wrongFlashTimerRef.current !== null) {
      window.clearTimeout(wrongFlashTimerRef.current);
      wrongFlashTimerRef.current = null;
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
          <span className="text-sm font-medium">
            体系の地図 — 復元テスト
          </span>
          <span className="text-xs text-muted-foreground">
            配置:{" "}
            <span className="font-semibold text-primary">
              {placedLabelIds.size}
            </span>{" "}
            / {targetNodes.length}
          </span>
          {wrongAttempts > 0 && (
            <span className="text-xs text-muted-foreground">
              ミス:{" "}
              <span className="font-semibold text-destructive">
                {wrongAttempts}
              </span>{" "}
              回
            </span>
          )}
          {allPlaced && (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              <Check className="size-3" strokeWidth={3} />
              全部正解！
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
              disabled={placedLabelIds.size === 0 && wrongAttempts === 0}
            >
              <RotateCcw className="size-3" />
              <span>リセット</span>
            </Button>
            <Button
              size="sm"
              onClick={onComplete}
              className="gap-1.5"
              variant={allPlaced ? "default" : "outline"}
            >
              <Check className="size-3" />
              <span>学習を始める</span>
            </Button>
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
            <span className="ml-2 text-muted-foreground/70">
              （正解は <Check className="inline size-3 text-primary" strokeWidth={3} /> で確定、間違いは <X className="inline size-3 text-destructive" strokeWidth={3} /> が出てラベルが戻ります）
            </span>
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
            {allPlaced && (
              <p className="text-sm text-primary">
                全てのラベルを正解で配置できました！「学習を始める」をどうぞ。
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
