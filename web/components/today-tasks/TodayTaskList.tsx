"use client";

/**
 * TodayTaskList - 今日のタスクのチェックリスト。
 *
 * Phase 1 では mock データを表示するだけ。Phase 2 以降:
 * - 朝の AI 提案 → 本人編集 → 確定の儀式
 * - 各タスクをクリックで /learn or 専用 chat へ遷移
 * - チェックでステータス遷移、AI が見てる
 */
import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Clock,
  MessageSquare,
  Play,
  Sparkles,
  Sunrise,
} from "lucide-react";
import type { ScheduleItem } from "@/lib/learn/types";
import {
  TASK_TYPE_LABEL,
  TASK_TYPE_TONE,
  TaskTypeIcon,
} from "./ScheduleTaskTypeIcon";
import { cn } from "@/lib/utils";

type Props = {
  items: ScheduleItem[];
  onToggleStatus: (id: string) => void;
  /** 「AI と相談する（朝の儀式）」ボタンの押下 */
  onPlanWithAi: () => void;
  /**
   * issue 型タスクの「始める」リンクで通常リンク (/issues) の代わりに呼ぶ。
   * Phase 3 で /tutor?view=issue&id=xxx 遷移用に使う。
   */
  onSelectIssueItem?: (issueId: string) => void;
};

export function TodayTaskList({
  items,
  onToggleStatus,
  onPlanWithAi,
  onSelectIssueItem,
}: Props) {
  const doneCount = items.filter((i) => i.status === "done").length;
  const totalEstimate = items
    .filter((i) => i.status !== "skipped")
    .reduce((a, i) => a + (i.estimateMinutes ?? 0), 0);

  // タスクは type 優先度でソート: lesson-review → exam-prep → homework → issue
  const sorted = useMemo(() => {
    const order: Record<ScheduleItem["type"], number> = {
      "lesson-review": 0,
      "exam-prep": 1,
      homework: 2,
      issue: 3,
    };
    return [...items].sort((a, b) => order[a.type] - order[b.type]);
  }, [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sunrise className="size-4 text-primary" />
          <span className="flex-1">今日のタスク</span>
          <Badge variant="outline" className="text-[10px]">
            {doneCount} / {items.length} 完了
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Clock className="mr-0.5 size-2.5" />
            約 {totalEstimate} 分
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between text-xs">
          <p className="text-muted-foreground">
            AI が提案 → 本人が編集して確定したリストです。
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={onPlanWithAi}
          >
            <Sparkles className="size-3.5" />
            <span>AI と相談する</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            今日のタスクはまだ立てられていません。
            <br />
            「AI と相談する」で朝の儀式を始めましょう。
          </p>
        )}
        {sorted.map((item) => (
          <TaskRow
            key={item.id}
            item={item}
            onToggleStatus={() => onToggleStatus(item.id)}
            onSelectIssueItem={onSelectIssueItem}
          />
        ))}

        {sorted.length > 0 && (
          <Link href="/learn?startDay=1" className="mt-2">
            <Button
              size="lg"
              className="w-full justify-center gap-2 font-semibold"
            >
              <Play className="size-4 fill-current" />
              <span>今日の学習を始める</span>
              <span className="text-[11px] font-normal opacity-80">
                （体系図 復元テスト → 最初のタスク）
              </span>
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({
  item,
  onToggleStatus,
  onSelectIssueItem,
}: {
  item: ScheduleItem;
  onToggleStatus: () => void;
  onSelectIssueItem?: (issueId: string) => void;
}) {
  const isDone = item.status === "done";
  const tone = TASK_TYPE_TONE[item.type];

  // クリック遷移先（Phase 3）:
  //   - issue: /tutor?view=issue&id=xxx（ゆい先生司令室の右ペインで開く）
  //   - それ以外: /learn?node=xxx
  const href =
    item.type === "issue"
      ? `/tutor?view=issue&id=${encodeURIComponent(item.sourceId)}`
      : item.nodeId
        ? `/learn?node=${encodeURIComponent(item.nodeId)}`
        : "/learn";

  const handleClick = (e: React.MouseEvent) => {
    // /tutor 内（onSelectIssueItem 提供時）なら router.push を親に委ねる
    if (item.type === "issue" && onSelectIssueItem) {
      e.preventDefault();
      onSelectIssueItem(item.sourceId);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border p-3",
        isDone ? "opacity-60" : tone.bg,
      )}
    >
      <button
        type="button"
        onClick={onToggleStatus}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isDone
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:border-primary",
        )}
        aria-label={isDone ? "未完了に戻す" : "完了にする"}
      >
        {isDone && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "h-4 shrink-0 gap-0.5 px-1.5 text-[9px] font-medium",
              tone.badge,
            )}
          >
            <TaskTypeIcon type={item.type} className="size-2.5" />
            {TASK_TYPE_LABEL[item.type]}
          </Badge>
          <p
            className={cn(
              "flex-1 truncate text-sm font-medium",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </p>
          {item.estimateMinutes !== undefined && (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {item.estimateMinutes}分
            </span>
          )}
        </div>
        {item.detail && !isDone && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {item.detail}
          </p>
        )}
        {item.aiRationale && !isDone && (
          <p className="flex items-start gap-1 text-[10px] leading-snug text-primary">
            <Sparkles className="mt-0.5 size-2.5 shrink-0" />
            <span>{item.aiRationale}</span>
          </p>
        )}
        {!isDone && (
          <div className="mt-1 flex items-center gap-2">
            <Link
              href={href}
              onClick={handleClick}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <MessageSquare className="size-2.5" />
              <span>始める</span>
              <ChevronRight className="size-2.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
