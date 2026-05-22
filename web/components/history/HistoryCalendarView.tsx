"use client";

/**
 * HistoryCalendarView - 月単位のカレンダー表示。
 * - 日付セルに「学習時間 + セッション数」を表示
 * - クリックでその日の最初のセッションへスクロール（簡易実装: 親が refs を持つ複雑さを避け、anchor リンクで日付 ID へ飛ぶ）
 * - 前/次の月で月送り
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LearningSession } from "@/lib/learn/types";
import { formatElapsed } from "@/lib/learn/use-learning-session";

type Props = {
  sessions: LearningSession[];
  /** カレンダー初期表示月。デフォルトは「今日」 */
  initialMonth?: Date;
};

function sessionElapsedSec(s: LearningSession): number {
  if (!s.endedAt) return 0;
  return Math.max(
    0,
    Math.floor(
      (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000,
    ),
  );
}

/** 'YYYY-MM-DD' をローカルタイムで返す */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HistoryCalendarView({ sessions, initialMonth }: Props) {
  const [cursor, setCursor] = useState(() => {
    const base = initialMonth ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // 日付ごとの集計
  const byDate = useMemo(() => {
    const map = new Map<string, { sec: number; count: number }>();
    for (const s of sessions) {
      const key = ymd(new Date(s.startedAt));
      const prev = map.get(key) ?? { sec: 0, count: 0 };
      prev.sec += sessionElapsedSec(s);
      prev.count += 1;
      map.set(key, prev);
    }
    return map;
  }, [sessions]);

  // カレンダーグリッド: 月曜始まり、6 週固定
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7; // Mon=0
    const gridStart = new Date(year, month, 1 - firstDow);
    const cs: Date[] = [];
    for (let i = 0; i < 42; i++) {
      cs.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    return cs;
  }, [cursor]);

  const todayKey = ymd(new Date());

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
              )
            }
            aria-label="前の月"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
              )
            }
            aria-label="次の月"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

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
            const inMonth = d.getMonth() === cursor.getMonth();
            const stat = byDate.get(key);
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={[
                  "flex min-h-[64px] flex-col gap-0.5 rounded-md border p-1.5 text-[11px]",
                  inMonth
                    ? "border-border bg-card"
                    : "border-border/50 bg-muted/30 text-muted-foreground",
                  isToday ? "ring-1 ring-primary" : "",
                ].join(" ")}
              >
                <span
                  className={
                    isToday ? "font-semibold text-primary" : "text-foreground/80"
                  }
                >
                  {d.getDate()}
                </span>
                {stat && (
                  <div className="mt-auto flex flex-col gap-0.5">
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-center font-mono text-[10px] font-medium text-primary tabular-nums">
                      {formatElapsed(stat.sec)}
                    </span>
                    {stat.count > 1 && (
                      <span className="text-center text-[9px] text-muted-foreground">
                        {stat.count} セッション
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          学習時間が記録されている日にバッジが表示されます。
        </p>
      </CardContent>
    </Card>
  );
}
