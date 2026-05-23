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
import { formatElapsed } from "@/lib/learn/use-learning-session";
import { cn } from "@/lib/utils";

type Props = {
  subject: LearnSubject;
  breadcrumb: KnowledgeNode[]; // 現在ノードまでのパス（ルート → 現在）
  mindmapCollapsed: boolean;
  onToggleMindmap: () => void;
  /** 学習セッションが active か */
  sessionActive: boolean;
  /** 経過秒数 */
  elapsedSec: number;
};

export function LearnHeader({
  subject,
  breadcrumb,
  mindmapCollapsed,
  onToggleMindmap,
  sessionActive,
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
          学習タイマー: 進行中は緑（ping アニメ付きドット）、停止中は赤。
          進行/停止の状態を視覚的にハッキリ示す。
          終了ボタンは進行中の時のみ表示（停止中は再終了できない）。
        */}
        {(sessionActive || elapsedSec > 0) && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <div
              className="flex items-center gap-2 text-xs"
              aria-live="polite"
              aria-label={
                sessionActive
                  ? `学習中、${formatElapsed(elapsedSec)} 経過`
                  : `停止中、${formatElapsed(elapsedSec)} で停止`
              }
            >
              {/* 状態ドット (緑 + ping アニメ / 停止: 赤、静止) */}
              <span className="relative inline-flex size-2 shrink-0">
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    sessionActive ? "bg-emerald-500" : "bg-destructive",
                  )}
                />
                {sessionActive && (
                  <span
                    className="absolute inset-0 inline-flex size-2 animate-ping rounded-full bg-emerald-500 opacity-75"
                    aria-hidden="true"
                  />
                )}
              </span>
              <Clock
                className={cn(
                  "size-3.5",
                  sessionActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}
              />
              <span
                className={cn(
                  "font-medium",
                  sessionActive
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-destructive",
                )}
              >
                {sessionActive ? "学習中" : "停止中"}
              </span>
              <span
                className={cn(
                  "font-mono font-semibold tabular-nums",
                  sessionActive
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-destructive",
                )}
              >
                {formatElapsed(elapsedSec)}
              </span>
            </div>
            {/*
              「学習を終了」: 即終了ではなく、ゆい先生 chat に遷移して
              振り返り対話を経て終了する設計（2026-05-24 改訂）。
              /tutor?ending=1 で tutor-mock が ending モードで起動する。
              停止中（idle 自動終了済み）は再終了できないので非表示。
            */}
            {sessionActive && (
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
          </>
        )}
      </div>
    </header>
  );
}
