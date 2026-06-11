"use client";

/**
 * ScheduleCalendar - 直近 2 週間を統合カレンダー (ラベル色ドット) で。
 *
 * 2026-06-09: 勉強タスク + 手動イベントをマージした CalendarEntry を、月曜始まり 2 週間
 * (14 マス) のミニカレンダーにラベル色ドットで並べる。SchedulePanel の「カレンダー」表示。
 * (旧 ScheduleMiniCalendar は標準 today-tasks ページ用に残置)
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/learn/event-colors";
import type { EventLabelColor } from "@/lib/learn/types";
import type { CalendarEntry } from "@/lib/schedule/merge";

type Props = {
  entries: CalendarEntry[];
  now?: Date;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 月曜始まりで「今日」を含む週の月曜 */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function ScheduleCalendar({ entries, now }: Props) {
  const today = now ?? new Date();
  const todayKey = ymd(today);
  const weekStart = startOfWeek(today);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    const cs: Date[] = [];
    for (let i = 0; i < 14; i++) {
      cs.push(
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + i,
        ),
      );
    }
    return cs;
  }, [weekStart]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
        <div
          key={w}
          className="py-1 text-center text-[10px] font-medium text-muted-foreground"
        >
          {w}
        </div>
      ))}
      {cells.map((d) => {
        const key = ymd(d);
        const list = byDate.get(key) ?? [];
        const isToday = key === todayKey;
        const past = key < todayKey && !isToday;
        const hasExam = list.some((e) => e.isExam);
        // 重複色を畳んでドット数を抑える
        const colors = Array.from(
          new Set(list.map((e) => e.color)),
        ) as EventLabelColor[];
        return (
          <div
            key={key}
            className={cn(
              "flex min-h-[56px] flex-col gap-1 rounded-md border p-1.5 text-[10px]",
              hasExam
                ? "border-violet-500/60 bg-violet-50/60 dark:border-violet-700/60 dark:bg-violet-950/30"
                : isToday
                  ? "border-primary bg-primary/5"
                  : past
                    ? "border-border/40 bg-muted/30 text-muted-foreground"
                    : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  isToday
                    ? "font-bold text-primary"
                    : hasExam
                      ? "font-semibold text-violet-700"
                      : "text-foreground/80",
                )}
              >
                {d.getDate()}
              </span>
              {hasExam && (
                <span className="rounded bg-violet-500/15 px-1 text-[9px] font-bold text-violet-700">
                  試験
                </span>
              )}
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {colors.map((c) => (
                  <span
                    key={c}
                    className={cn(
                      "size-1.5 rounded-full",
                      colorClasses(c).dot,
                    )}
                  />
                ))}
              </div>
            )}
            {list.length > 0 && (
              <span className="mt-auto text-[9px] font-medium text-foreground">
                {list.length} 件
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
