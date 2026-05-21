"use client";

/**
 * LocationCeremony - 学習セッション開始時の「位置確認の儀式」。
 *
 * ito19 さんの哲学:
 *   「最初から何回も何回も『文法のスタートはここだよ』というように
 *    こう展開していって『こういう風なところで今ここをやるんだよ』ということやらないと絶対ダメ」
 *   「アニメーションで動かして、解説をつけて、なぜこの順序で学ぶかも軽く説明」
 *
 * 構成:
 *   step 0: フィロソフィー確認（勉強 = 知識の整理）
 *   step 1: 中2 英語文法のルート + 第1階層（大カテゴリ7つ）を一気に展開。学習順序の意味を解説。
 *   step 2..N-1: パスを辿る中間ノードで子グループを展開。「今日はこの中の◯◯」と絞り込む。
 *   step N: 「今ここ」をハイライト。「学習を始める」ボタン。
 *
 * 表示は React Flow ベースで、各 step で visibleNodeIds と fitView の対象を切替。
 */

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpenCheck, MapPin } from "lucide-react";
import type { KnowledgeNode, LearnSubject } from "@/lib/learn/types";
import { buildMindMapLayout } from "@/lib/learn/mindmap-layout";
import { cn } from "@/lib/utils";

type Props = {
  subject: LearnSubject;
  allNodes: KnowledgeNode[];
  pathToCurrent: KnowledgeNode[]; // ルート → 現在
  onComplete: () => void;
};

type CeremonyStep = {
  id: string;
  narration: string;
  visibleNodeIds: Set<string>;
  focusNodeId: string | null; // 強調するノード（target にズーム）
  highlightCurrent: boolean; // 「今ここ」を最強調するか
};

/** step を組み立て: フィロソフィー → ルート+大カテゴリ → パスを辿って中間展開 → 今ここ */
function buildSteps(
  allNodes: KnowledgeNode[],
  pathToCurrent: KnowledgeNode[],
): CeremonyStep[] {
  const nameOf = (id: string) =>
    allNodes.find((n) => n.id === id)?.name ?? id;
  const childrenIdsOf = (parentId: string | null) =>
    allNodes.filter((n) => n.parentId === parentId).map((n) => n.id);

  const steps: CeremonyStep[] = [];

  // ---- step 0: フィロソフィー ----
  steps.push({
    id: "philosophy",
    narration:
      "勉強って何だっけ？ 思い出そう。\n勉強は、**知識を整理して、使えるようにする** ことだよ。\n暗記して思い出すことじゃない。整理されているから、いつでも引き出せるんだ。",
    visibleNodeIds: new Set(),
    focusNodeId: null,
    highlightCurrent: false,
  });

  if (pathToCurrent.length === 0) return steps;

  // ---- step 1: ルート + 第1階層（大カテゴリ全部展開） ----
  const root = pathToCurrent[0];
  const topCategories = childrenIdsOf(root.id);
  const orderRationale =
    "なぜこの順序かというと、まず動詞の時制で文の核を作って、動詞の派生形・助動詞・受動態でその動詞の周辺を広げ、比較・接続詞で文と文の関係を、文型で文全体の骨格を学ぶ流れだから。動詞の世界が少しずつ広がっていくイメージ。";
  steps.push({
    id: `level-0`,
    narration: `まずは「${root.name}」の全体を見よう。中2 では、こういうグループを学んでいきます: ${topCategories.map((id) => nameOf(id)).join("、")}。${orderRationale}`,
    visibleNodeIds: new Set([root.id, ...topCategories]),
    focusNodeId: root.id,
    highlightCurrent: false,
  });

  // ---- step 2..N-1: パスの中間ノード（root と current 除く）を辿る ----
  // pathToCurrent: [root, ..., current]
  // 中間: pathToCurrent[1] 〜 pathToCurrent[length-2]
  let visible = new Set<string>([root.id, ...topCategories]);
  for (let i = 1; i < pathToCurrent.length - 1; i++) {
    const focusNode = pathToCurrent[i];
    const focusChildren = childrenIdsOf(focusNode.id);
    visible = new Set([...visible, ...focusChildren]);

    const parentName = nameOf(pathToCurrent[i - 1].id);
    const nextName = nameOf(pathToCurrent[i + 1].id);
    const childrenStr = focusChildren.map((id) => nameOf(id)).join("、");
    const narration =
      i === pathToCurrent.length - 2
        ? `「${parentName}」の中で、今日は「${focusNode.name}」のグループ。「${focusNode.name}」には ${focusChildren.length} つ: ${childrenStr}。今日はこの中の「${nextName}」をやるよ。`
        : `「${parentName}」の中の「${focusNode.name}」。中身は ${childrenStr}。さらにこの中の「${nextName}」へ降りていくよ。`;

    steps.push({
      id: `path-${i}`,
      narration,
      visibleNodeIds: visible,
      focusNodeId: focusNode.id,
      highlightCurrent: false,
    });
  }

  // ---- 最終 step: 「今ここ」ハイライト ----
  const current = pathToCurrent[pathToCurrent.length - 1];
  steps.push({
    id: "current",
    narration: `そして、今日のところは、ここ。「${current.name}」だよ。さあ、始めよう。`,
    visibleNodeIds: visible,
    focusNodeId: current.id,
    highlightCurrent: true,
  });

  return steps;
}

// ---- カスタムノード（儀式用、色トークン使用） ----
type CeremonyNodeData = {
  label: string;
  isCurrent: boolean;
  isOnPath: boolean;
  isFocus: boolean;
  depth: number;
  highlightCurrent: boolean;
};

function CeremonyNode({ data }: NodeProps<Node<CeremonyNodeData>>) {
  const { label, isCurrent, isOnPath, isFocus, depth, highlightCurrent } =
    data;
  const isHighlighted = highlightCurrent && isCurrent;

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
          "rounded-lg border-2 px-4 py-2.5 text-sm shadow-sm transition-all duration-500",
          "min-w-[160px] max-w-[220px]",
          isHighlighted
            ? "border-primary bg-primary text-primary-foreground scale-110"
            : isOnPath
              ? "border-primary bg-primary/10 text-primary"
              : isFocus
                ? "border-foreground bg-card font-medium"
                : depth === 0
                  ? "border-foreground/40 bg-card font-medium"
                  : "border-border bg-card text-card-foreground",
        )}
      >
        <div className="flex items-center gap-1.5">
          {isHighlighted && <MapPin className="size-4 shrink-0" />}
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

const nodeTypes = { mindmap: CeremonyNode };

function CeremonyMap({
  allNodes,
  pathToCurrent,
  step,
}: {
  allNodes: KnowledgeNode[];
  pathToCurrent: KnowledgeNode[];
  step: CeremonyStep;
}) {
  const { fitView } = useReactFlow();
  const currentId = pathToCurrent[pathToCurrent.length - 1]?.id;
  const pathSet = useMemo(
    () => new Set(pathToCurrent.map((n) => n.id)),
    [pathToCurrent],
  );

  // 表示対象を visibleNodeIds で絞り込み、各ノードに儀式用 data を載せる
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const filtered = allNodes.filter((n) => step.visibleNodeIds.has(n.id));
    const layout = buildMindMapLayout(filtered, currentId ?? "");
    const mappedNodes = layout.nodes.map((node) => ({
      ...node,
      data: {
        label: node.data.label,
        isCurrent: node.id === currentId,
        isOnPath: pathSet.has(node.id),
        isFocus: node.id === step.focusNodeId,
        depth: node.data.depth,
        highlightCurrent: step.highlightCurrent,
      },
    }));
    return { nodes: mappedNodes, edges: layout.edges };
  }, [allNodes, currentId, pathSet, step]);

  // step 変更時に focus 領域へズーム
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (step.focusNodeId) {
        // focus ノードとその子を含めて fit
        const focusChildren = allNodes
          .filter((n) => n.parentId === step.focusNodeId)
          .map((n) => n.id);
        const targets = [step.focusNodeId, ...focusChildren].filter((tid) =>
          step.visibleNodeIds.has(tid),
        );
        fitView({
          nodes: targets.map((tid) => ({ id: tid })),
          padding: 0.25,
          duration: 600,
        });
      } else {
        fitView({ padding: 0.2, duration: 600 });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [step, fitView, allNodes]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
    >
      <Background gap={24} size={1} />
    </ReactFlow>
  );
}

export function LocationCeremony({
  subject,
  allNodes,
  pathToCurrent,
  onComplete,
}: Props) {
  const steps = useMemo(
    () => buildSteps(allNodes, pathToCurrent),
    [allNodes, pathToCurrent],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isPhilosophy = step.id === "philosophy";
  const isLast = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-background px-4 py-3">
        <BookOpenCheck className="size-5 text-primary" />
        <span className="text-sm font-medium text-foreground">
          学習を始める前に
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          ステップ {stepIndex + 1} / {steps.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
        {/* 左 (or 上): ナレーション */}
        <div className="flex shrink-0 flex-col gap-4 border-b border-border bg-background p-6 lg:w-[420px] lg:border-b-0 lg:border-r">
          <div className="flex-1 rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="whitespace-pre-line text-base leading-relaxed text-card-foreground">
              {step.narration}
            </p>
          </div>
          <Button size="lg" onClick={handleNext} className="w-full gap-2">
            <span>{isLast ? "学習を始める" : "次へ"}</span>
            <ArrowRight />
          </Button>
        </div>

        {/* 右 (or 下): マインドマップ */}
        <div className="min-h-0 flex-1">
          {isPhilosophy ? (
            <div className="flex h-full items-center justify-center p-12">
              <div className="text-center">
                <BookOpenCheck className="mx-auto size-16 text-primary/30" />
                <p className="mt-4 text-sm text-muted-foreground">
                  まずは「勉強とは何か」を確認しよう。
                </p>
              </div>
            </div>
          ) : (
            <ReactFlowProvider>
              <CeremonyMap
                allNodes={allNodes}
                pathToCurrent={pathToCurrent}
                step={step}
              />
            </ReactFlowProvider>
          )}
        </div>
      </div>
    </div>
  );
}
