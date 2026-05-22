"use client";

/**
 * OverviewVideo - 「今日の範囲を AI 動画で見る」体験。
 *
 * NotebookLM 風: 音声ナレーション + マインドマップ同期アニメ。
 * MVP は SpeechSynthesis API（ブラウザ標準、無料）で読み上げ。
 * 後で OpenAI TTS の高品質音声に差し替え。
 *
 * 構成:
 *   - 上部: ヘッダー（タイトル + スキップボタン）
 *   - 中央: マインドマップ（音声に合わせて段階展開・フォーカス切替）
 *   - 下部: 字幕（現在の読み上げテキスト）+ 再生コントロール
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Pause, Play, SkipForward, Video } from "lucide-react";
import type { KnowledgeNode } from "@/lib/learn/types";
import { buildMindMapLayout } from "@/lib/learn/mindmap-layout";
import type { NarrationStep } from "@/lib/learn/overview-script";
import { cn } from "@/lib/utils";

type Props = {
  allNodes: KnowledgeNode[];
  script: NarrationStep[];
  onComplete: () => void;
  onSkip: () => void;
};

type CeremonyNodeData = {
  label: string;
  isCurrent: boolean;
  isFocus: boolean;
  depth: number;
};

function OverviewNode({ data }: NodeProps<Node<CeremonyNodeData>>) {
  const { label, isFocus, depth } = data;
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
          isFocus
            ? "scale-110 border-primary bg-primary text-primary-foreground"
            : depth === 0
              ? "border-foreground/40 bg-card font-medium text-foreground"
              : "border-border bg-card text-card-foreground",
        )}
      >
        <div className="flex items-center gap-1.5">
          {isFocus && <MapPin className="size-4 shrink-0" />}
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

const nodeTypes = { mindmap: OverviewNode };

function OverviewMap({
  allNodes,
  step,
}: {
  allNodes: KnowledgeNode[];
  step: NarrationStep;
}) {
  const { fitView } = useReactFlow();

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const visibleSet = new Set(step.visibleNodeIds);
    const filtered = allNodes.filter((n) => visibleSet.has(n.id));
    const layout = buildMindMapLayout(filtered, step.focusNodeId ?? "");
    const mappedNodes = layout.nodes.map((node) => ({
      ...node,
      data: {
        label: node.data.label,
        isCurrent: node.id === step.focusNodeId,
        isFocus: node.id === step.focusNodeId,
        depth: node.data.depth,
      },
    }));
    return { nodes: mappedNodes, edges: layout.edges };
  }, [allNodes, step]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (step.focusNodeId) {
        const focusChildren = allNodes
          .filter((n) => n.parentId === step.focusNodeId)
          .map((n) => n.id);
        const targets = [step.focusNodeId, ...focusChildren].filter((tid) =>
          step.visibleNodeIds.includes(tid),
        );
        fitView({
          nodes: targets.map((tid) => ({ id: tid })),
          padding: 0.25,
          duration: 800,
        });
      } else {
        fitView({ padding: 0.2, duration: 600 });
      }
    }, 60);
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

export function OverviewVideo({
  allNodes,
  script,
  onComplete,
  onSkip,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const step = script[stepIndex];
  const isLast = stepIndex === script.length - 1;
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // 初期化（クライアントのみ）
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  // step 切替時に発話
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth || !isPlaying) return;

    synth.cancel();
    const utt = new SpeechSynthesisUtterance(step.text);
    utt.lang = "ja-JP";
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.onend = () => {
      if (isLast) {
        setIsPlaying(false);
        // 自動で onComplete はせず、ユーザーに「学習を始める」を押させる
      } else {
        setStepIndex((i) => i + 1);
      }
    };
    synth.speak(utt);

    return () => {
      synth.cancel();
    };
  }, [stepIndex, isPlaying, step.text, isLast]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      synthRef.current?.cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    synthRef.current?.cancel();
    if (isLast) {
      setIsPlaying(false);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast]);

  const handleStartLearning = () => {
    synthRef.current?.cancel();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-background px-4 py-3">
        <Video className="size-5 text-primary" />
        <span className="text-sm font-medium text-foreground">
          今日の範囲を AI 動画で見る
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          ステップ {stepIndex + 1} / {script.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="ml-auto gap-2"
        >
          <SkipForward className="size-4" />
          <span>スキップ</span>
        </Button>
      </div>

      {/* 中央: マインドマップ */}
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <OverviewMap allNodes={allNodes} step={step} />
        </ReactFlowProvider>
      </div>

      {/* 下部: 字幕 + 再生コントロール */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <Card>
            <CardContent className="py-4">
              <p className="whitespace-pre-line text-base leading-relaxed text-card-foreground">
                {step.text}
              </p>
            </CardContent>
          </Card>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={togglePlay}
              className="gap-2"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-4" />
                  <span>一時停止</span>
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  <span>{stepIndex === 0 ? "再生する" : "続きから再生"}</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleNext}
              disabled={isLast}
              className="gap-2"
            >
              <SkipForward className="size-4" />
              <span>次へ</span>
            </Button>
            {isLast && (
              <Button
                size="lg"
                onClick={handleStartLearning}
                className="gap-2"
              >
                <span>学習を始める</span>
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            ※ 音声はブラウザ標準の読み上げを使用中。後で AI 高品質音声に差し替え予定。
          </p>
        </div>
      </div>
    </div>
  );
}
