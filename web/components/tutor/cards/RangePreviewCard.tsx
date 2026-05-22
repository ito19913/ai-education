"use client";

/**
 * RangePreviewCard - 担任 chat 内で「今日のところはここ」を体系図プレビューで示すカード。
 *
 * Phase 2 mock では React Flow は重いので、ノード名の一覧をコンパクトに表示する
 * 簡易プレビューにする（後で実体系図に置換可能）。
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, Target } from "lucide-react";
import type { KnowledgeNode, TutorCard } from "@/lib/learn/types";

type Props = {
  card: Extract<TutorCard, { kind: "range-preview" }>;
  /** ノード名解決用 */
  nodes: KnowledgeNode[];
};

export function RangePreviewCard({ card, nodes }: Props) {
  const nameOf = (id: string) =>
    nodes.find((n) => n.id === id)?.name ?? id;

  // 入口ノード + ハイライト範囲
  const entryName = nameOf(card.entryNodeId);
  const highlights = card.highlightNodeIds.map((id) => ({
    id,
    name: nameOf(id),
    isEntry: id === card.entryNodeId,
  }));

  return (
    <Card className="my-2 border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-primary">
        <Map className="size-3.5" />
        <span className="font-medium">今日の学習範囲</span>
      </div>
      <p className="mb-2 text-sm leading-snug text-foreground">
        {card.humanLabel}
      </p>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/40 bg-card p-2.5">
        <Target className="size-3.5 shrink-0 text-primary" />
        <div className="flex flex-1 flex-col">
          <span className="text-[10px] text-muted-foreground">入口</span>
          <span className="text-sm font-semibold text-foreground">
            {entryName}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {highlights.map((h) => (
          <Badge
            key={h.id}
            variant="outline"
            className={
              h.isEntry
                ? "border-primary bg-primary text-primary-foreground text-[10px]"
                : "border-primary/50 bg-card text-foreground text-[10px]"
            }
          >
            {h.name}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
