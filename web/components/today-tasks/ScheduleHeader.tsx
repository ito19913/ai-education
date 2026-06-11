"use client";

/**
 * ScheduleHeader - /today-tasks (標準ページ) のサマリーヘッダ。
 * 試験までのカウントダウン / 未クリア課題 / 今週の予定数 を一目で。
 *
 * 2026-06-09: ダッシュボード (DashboardPane) は独自の 2 枚サマリー (レジュメ/教材) に
 * 移行したため、本コンポーネントは標準の today-tasks ページ専用 (3 枚) に戻した。
 */
import { Card, CardContent } from "@/components/ui/card";
import { CalendarRange, Flame, GraduationCap, Target } from "lucide-react";
import type { ExamPrep, Issue, ScheduleItem } from "@/lib/learn/types";

type Props = {
  /** 直近の試験対策（複数あれば一番早いのを使う） */
  nearestExam: ExamPrep | null;
  issues: Issue[];
  thisWeekItems: ScheduleItem[];
  /** 「今日」基準。 */
  now?: Date;
};

function daysUntil(dateStr: string, now: Date): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function ScheduleHeader({
  nearestExam,
  issues,
  thisWeekItems,
  now,
}: Props) {
  const today = now ?? new Date();
  const openIssueCount = issues.filter((i) => i.status === "open").length;
  const examDays = nearestExam ? daysUntil(nearestExam.examDate, today) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card
        className={
          examDays !== null && examDays <= 14
            ? "border-violet-300/60 bg-violet-50/50 dark:border-violet-900/60 dark:bg-violet-950/20"
            : ""
        }
      >
        <CardContent className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="size-4 text-violet-600" />
            <span className="text-xs text-muted-foreground">
              次の試験まで
            </span>
          </div>
          {nearestExam ? (
            <>
              <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                {examDays !== null && examDays >= 0 ? (
                  <>
                    {examDays}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      日
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    試験は過ぎました
                  </span>
                )}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {nearestExam.name}（
                {new Date(nearestExam.examDate).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                })}
                ）
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-2xl text-muted-foreground">—</span>
              <span className="text-[11px] text-muted-foreground">
                試験対策タスクなし
              </span>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center gap-1.5">
            <Target className="size-4 text-orange-600" />
            <span className="text-xs text-muted-foreground">未クリア課題</span>
          </div>
          <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
            {openIssueCount}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              件
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            掘る対象の論点
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center gap-1.5">
            <CalendarRange className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">今週の予定</span>
          </div>
          <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
            {thisWeekItems.length}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              件
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Flame className="size-3 text-orange-500" />
            <span>合計 {sumMinutes(thisWeekItems)} 分</span>
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function sumMinutes(items: ScheduleItem[]): number {
  return items.reduce((acc, i) => acc + (i.estimateMinutes ?? 0), 0);
}
