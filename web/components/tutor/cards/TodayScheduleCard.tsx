"use client";

/**
 * TodayScheduleCard - ゆい chat 内で今日のタスクを簡易リスト表示するカード（Phase 3）。
 *
 * 各 task 行クリックで:
 *   - issue 型 → onSelectIssueItem(sourceId) → 右ペインに IssueChat
 *   - それ以外 → /learn?node=xxx に直接遷移
 * 「全部見る」で右ペインに ScheduleDashboard を展開する。
 */
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronRight, Clock } from "lucide-react";
import type { ScheduleItem, TutorCard } from "@/lib/learn/types";
import {
  TASK_TYPE_LABEL,
  TASK_TYPE_TONE,
  TaskTypeIcon,
} from "@/components/today-tasks/ScheduleTaskTypeIcon";
import { cn } from "@/lib/utils";

type Props = {
  card: Extract<TutorCard, { kind: "today-schedule" }>;
  /** 全 ScheduleItem（card.scheduleItemIds で絞り込む）*/
  items: ScheduleItem[];
  onSelectIssueItem: (issueId: string) => void;
  onSeeAll: () => void;
};

export function TodayScheduleCard({
  card,
  items,
  onSelectIssueItem,
  onSeeAll,
}: Props) {
  const targets = card.scheduleItemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ScheduleItem => !!i);

  if (targets.length === 0) {
    return (
      <Card className="my-1 border-primary/30 bg-primary/5">
        <CardContent className="py-3 text-center text-xs text-muted-foreground">
          今日のタスクはまだ立てられていません
        </CardContent>
      </Card>
    );
  }

  const totalMin = targets.reduce(
    (acc, i) => acc + (i.estimateMinutes ?? 0),
    0,
  );

  return (
    <Card className="my-1 border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-1.5 py-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-primary">
          <CalendarClock className="size-3.5" />
          <span className="font-medium">今日のタスク {targets.length} 件</span>
          <span className="ml-1 text-muted-foreground">
            <Clock className="mr-0.5 inline size-2.5" />
            約 {totalMin} 分
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {targets.map((item) => {
            const tone = TASK_TYPE_TONE[item.type];
            const isIssue = item.type === "issue";
            const fallbackHref = isIssue
              ? `/tutor?view=issue&id=${encodeURIComponent(item.sourceId)}`
              : "/tutor?view=materials";

            const inner = (
              <div className="flex w-full items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5">
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-0.5 h-4 shrink-0 gap-0.5 px-1 text-[9px]",
                    tone.badge,
                  )}
                >
                  <TaskTypeIcon type={item.type} className="size-2.5" />
                  {TASK_TYPE_LABEL[item.type]}
                </Badge>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.estimateMinutes !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      約 {item.estimateMinutes} 分
                    </p>
                  )}
                </div>
                <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
              </div>
            );

            return isIssue ? (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectIssueItem(item.sourceId)}
                className="text-left"
              >
                {inner}
              </button>
            ) : (
              <Link key={item.id} href={fallbackHref}>
                {inner}
              </Link>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-full gap-1.5"
          onClick={onSeeAll}
        >
          <span>{card.seeAllLabel}</span>
          <ChevronRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
