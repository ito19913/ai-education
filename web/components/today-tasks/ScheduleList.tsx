"use client";

/**
 * ScheduleList - 直近 2 週間の予定をリスト形式で。
 *
 * 2026-06-09: 「予定」を勉強専用から「何でも入る1本のカレンダー」に拡張 (grill 確定)。
 * 勉強タスク + 手動イベントをマージした CalendarEntry を受け取り、ラベル色で見分ける。
 *
 * - 「今日」起点で 2 週間 (14 日)、日付ごとにグルーピング (予定ゼロの日は出さない)
 * - 各行: ラベル色ドット + タイトル + 所要分/時刻、試験は「あと◯日」
 * - 手動イベントの行はクリックで編集 (onEditEvent)、勉強タスクはクリック無効
 *
 * Card 枠は持たない (SchedulePanel が枠とトグルを提供する)。
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/learn/event-colors";
import type { CalendarEvent } from "@/lib/learn/types";
import type { CalendarEntry } from "@/lib/schedule/merge";

type Props = {
  entries: CalendarEntry[];
  /** 「今日」基準 */
  now?: Date;
  /** 手動イベント行のクリック (編集) */
  onEditEvent?: (event: CalendarEvent) => void;
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(fromKey);
  const b = new Date(toKey);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function ScheduleList({ entries, now, onEditEvent }: Props) {
  const today = useMemo(() => {
    const d = now ? new Date(now) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const todayKey = ymd(today);
  const tomorrowKey = ymd(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  );

  // 今日 〜 +13 日を日付ごとにまとめる。予定ゼロの日は作らない。
  const groups = useMemo(() => {
    const weekEndKey = ymd(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14),
    );
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      if (e.date < todayKey || e.date >= weekEndKey) continue;
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, list]) => ({ date, list }));
  }, [entries, today, todayKey]);

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        この 2 週間の予定はまだありません。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map(({ date, list }) => {
        const d = new Date(date);
        const isToday = date === todayKey;
        const isTomorrow = date === tomorrowKey;
        const heading = isToday
          ? "今日"
          : isTomorrow
            ? "明日"
            : `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）`;
        return (
          <li key={date} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {heading}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {list.length} 件
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {list.map((e) => {
                const clickable = e.source === "event" && !!onEditEvent;
                const examDays = e.isExam ? daysBetween(todayKey, e.date) : null;
                const right =
                  examDays !== null ? (
                    <span className="shrink-0 rounded bg-violet-500/15 px-1.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      {examDays <= 0 ? "今日" : `あと${examDays}日`}
                    </span>
                  ) : e.time ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {e.time}
                    </span>
                  ) : e.estimateMinutes != null ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {e.estimateMinutes}分
                    </span>
                  ) : null;
                return (
                  <div
                    key={e.id}
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={
                      clickable && e.event
                        ? () => onEditEvent?.(e.event!)
                        : undefined
                    }
                    onKeyDown={
                      clickable && e.event
                        ? (ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              onEditEvent?.(e.event!);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs",
                      clickable &&
                        "cursor-pointer transition-colors hover:border-primary hover:bg-primary/5",
                      e.done && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        colorClasses(e.color).dot,
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-foreground",
                        e.done && "line-through",
                      )}
                    >
                      {e.title}
                    </span>
                    {right}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
