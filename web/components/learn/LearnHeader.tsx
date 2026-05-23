"use client";

/**
 * LearnHeader - GlobalHeader 相当。
 * 教科 + 単元 + 現在ノードのパンくず + ページ範囲を表示。
 * 左端に SidebarTrigger を置いて Pane 1 を畳めるようにする。
 */

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  GraduationCap,
  Network,
} from "lucide-react";
import type { KnowledgeNode, LearnSubject } from "@/lib/learn/types";
import {
  formatElapsed,
  type SessionStatus,
} from "@/lib/learn/use-learning-session";
import { cn } from "@/lib/utils";

type Props = {
  subject: LearnSubject;
  breadcrumb: KnowledgeNode[]; // 現在ノードまでのパス（ルート → 現在）
  mindmapCollapsed: boolean;
  onToggleMindmap: () => void;
  /** 学習セッションの状態 (active / paused / ended) */
  sessionStatus: SessionStatus;
  /** 経過秒数 */
  elapsedSec: number;
};

export function LearnHeader({
  subject,
  breadcrumb,
  mindmapCollapsed,
  onToggleMindmap,
  sessionStatus,
  elapsedSec,
}: Props) {
  const lastId = breadcrumb[breadcrumb.length - 1]?.id;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <SidebarTrigger className="size-7" />
      <Button
        variant={mindmapCollapsed ? "outline" : "secondary"}
        size="icon"
        className="size-7"
        onClick={onToggleMindmap}
        aria-label={
          mindmapCollapsed ? "体系の地図を表示" : "体系の地図を隠す"
        }
        title={
          mindmapCollapsed ? "体系の地図を表示" : "体系の地図を隠す"
        }
      >
        <Network className="size-4" />
      </Button>
      <Separator orientation="vertical" className="h-5" />

      <div className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{subject.name}</span>
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className="text-muted-foreground">{subject.unitName}</span>
        {breadcrumb.map((node) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground" />
            <span
              className={
                node.id === lastId
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {node.name}
            </span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {subject.pageRange}
        </span>
        {/*
          学習タイマー: 3 状態カラー
          - active: 緑 + ping アニメ ドット、"学習中"
          - paused: 黄 (amber) 静止ドット、"離席中…" (タイマー停止)
          - ended:  赤 静止ドット、"停止中" (終了済み)

          終了ボタンは active / paused の時に表示（ended は再終了不可で非表示）。
          paused 中は任意の操作（mouse / keyboard / click 等）で自動再開する。
        */}
        <Separator orientation="vertical" className="h-5" />
        <div
          className="flex items-center gap-2 text-xs"
          aria-live="polite"
          aria-label={statusAriaLabel(sessionStatus, elapsedSec)}
        >
          {/* 状態ドット */}
          <span className="relative inline-flex size-2 shrink-0">
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                sessionStatus === "active" && "bg-emerald-500",
                sessionStatus === "paused" && "bg-amber-500",
                sessionStatus === "ended" && "bg-destructive",
              )}
            />
            {sessionStatus === "active" && (
              <span
                className="absolute inset-0 inline-flex size-2 animate-ping rounded-full bg-emerald-500 opacity-75"
                aria-hidden="true"
              />
            )}
          </span>
          <Clock
            className={cn(
              "size-3.5",
              sessionStatus === "active" &&
                "text-emerald-600 dark:text-emerald-400",
              sessionStatus === "paused" &&
                "text-amber-600 dark:text-amber-400",
              sessionStatus === "ended" && "text-destructive",
            )}
          />
          <span
            className={cn(
              "font-medium",
              sessionStatus === "active" &&
                "text-emerald-700 dark:text-emerald-300",
              sessionStatus === "paused" &&
                "text-amber-700 dark:text-amber-300",
              sessionStatus === "ended" && "text-destructive",
            )}
          >
            {statusLabel(sessionStatus)}
          </span>
          <span
            className={cn(
              "font-mono font-semibold tabular-nums",
              sessionStatus === "active" &&
                "text-emerald-700 dark:text-emerald-300",
              sessionStatus === "paused" &&
                "text-amber-700 dark:text-amber-300",
              sessionStatus === "ended" && "text-destructive",
            )}
          >
            {formatElapsed(elapsedSec)}
          </span>
        </div>
        {/*
          「学習を終了」: 即終了ではなく、ゆい先生 chat に遷移して
          振り返り対話を経て終了する設計。/tutor?ending=1 で
          tutor-mock が ending モードで起動する。
          ended (既終了) の時のみ非表示。paused 中は表示（離席後に「もう終わる」可）。
        */}
        {sessionStatus !== "ended" && (
          <Link
            href="/tutor?ending=1"
            title="ゆい先生に報告して学習を終了"
          >
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              aria-label="ゆい先生に報告して学習を終了"
            >
              <GraduationCap className="size-3.5" />
              <span>学習を終了</span>
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "active":
      return "学習中";
    case "paused":
      return "離席中…";
    case "ended":
      return "停止中";
  }
}

function statusAriaLabel(status: SessionStatus, elapsedSec: number): string {
  const time = formatElapsed(elapsedSec);
  switch (status) {
    case "active":
      return `学習中、${time} 経過`;
    case "paused":
      return `離席中、${time} で一時停止 (操作で再開)`;
    case "ended":
      return `停止中、${time} で終了`;
  }
}
