"use client";

/**
 * HistorySummary - 履歴ページ上部の集計サマリー。
 * - 今週・今月の合計学習時間
 * - 科目別学習時間バー
 * mock データなので集計はクライアントでざっくり行う。
 */
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, CalendarRange, Layers } from "lucide-react";
import type { LearningSession, Subject } from "@/lib/learn/types";
import { formatElapsed } from "@/lib/learn/use-learning-session";

type Props = {
  sessions: LearningSession[];
  subjects: Subject[];
  /** 「今日」基準。テスト/SSR ずれを避けるため呼び出し側から渡せる。 */
  now?: Date;
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

/** 月曜始まり。今週の月曜 0:00 を返す。 */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day + 6) % 7; // Mon を 0 に
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

export function HistorySummary({ sessions, subjects, now }: Props) {
  const today = now ?? new Date();
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  let weekSec = 0;
  let monthSec = 0;
  const bySubject = new Map<string, number>();
  let unknownSec = 0;

  for (const s of sessions) {
    const elapsed = sessionElapsedSec(s);
    const start = new Date(s.startedAt);
    if (start >= weekStart) weekSec += elapsed;
    if (start >= monthStart) monthSec += elapsed;
    if (s.subjectId) {
      bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + elapsed);
    } else {
      unknownSec += elapsed;
    }
  }

  const totalAllSec =
    Array.from(bySubject.values()).reduce((a, b) => a + b, 0) + unknownSec;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={<CalendarRange className="size-4 text-primary" />}
        label="今週の学習時間"
        sub={`${weekStart.getMonth() + 1}/${weekStart.getDate()} 月曜〜`}
        value={formatElapsed(weekSec)}
      />
      <SummaryCard
        icon={<CalendarDays className="size-4 text-primary" />}
        label="今月の学習時間"
        sub={`${monthStart.getFullYear()} 年 ${monthStart.getMonth() + 1} 月`}
        value={formatElapsed(monthSec)}
      />
      <Card className="sm:col-span-1">
        <CardContent className="flex flex-col gap-2 py-3">
          <div className="flex items-center gap-1.5">
            <Layers className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">科目別の内訳</span>
          </div>
          {totalAllSec === 0 ? (
            <p className="text-xs text-muted-foreground">まだデータがありません</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {subjects.map((subj) => {
                const sec = bySubject.get(subj.id) ?? 0;
                if (sec === 0) return null;
                const pct = Math.round((sec / totalAllSec) * 100);
                return (
                  <SubjectBar
                    key={subj.id}
                    name={subj.name}
                    pct={pct}
                    elapsedLabel={formatElapsed(sec)}
                  />
                );
              })}
              {unknownSec > 0 && (
                <SubjectBar
                  name="（科目未設定）"
                  pct={Math.round((unknownSec / totalAllSec) * 100)}
                  elapsedLabel={formatElapsed(unknownSec)}
                  muted
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  sub,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-3">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="font-mono text-xl font-semibold text-foreground tabular-nums">
          {value}
        </span>
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      </CardContent>
    </Card>
  );
}

function SubjectBar({
  name,
  pct,
  elapsedLabel,
  muted,
}: {
  name: string;
  pct: number;
  elapsedLabel: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className={muted ? "text-muted-foreground" : "text-foreground"}>
          {name}
        </span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {elapsedLabel} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            muted
              ? "h-full rounded-full bg-muted-foreground/40"
              : "h-full rounded-full bg-primary"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
