"use client";

/**
 * LearnHeader - GlobalHeader 相当。
 * 教科 + 単元 + 現在ノードのパンくず + ページ範囲を表示。
 * 左端に SidebarTrigger を置いて Pane 1 を畳めるようにする。
 */

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ChevronRight, Network } from "lucide-react";
import type { KnowledgeNode, LearnSubject } from "@/lib/learn/types";

type Props = {
  subject: LearnSubject;
  breadcrumb: KnowledgeNode[]; // 現在ノードまでのパス（ルート → 現在）
  mindmapCollapsed: boolean;
  onToggleMindmap: () => void;
};

export function LearnHeader({
  subject,
  breadcrumb,
  mindmapCollapsed,
  onToggleMindmap,
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

      <span className="ml-auto text-xs text-muted-foreground">
        {subject.pageRange}
      </span>
    </header>
  );
}
