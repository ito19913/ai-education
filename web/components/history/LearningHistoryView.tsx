"use client";

/**
 * LearningHistoryView - 学習の履歴 (出来事ログ + 学習時間、2026-06-10 grill 確定)。
 *
 * 履歴は「自動・必須」: タスクを作らず学習しても、実アクションへのフックで勝手に
 * 記録されたものをここで見る。旧セッション型 HistoryView (モック) を司令室では置換。
 *
 * - 上部: 今日 / 今週 の学習時間 + 件数 (モチベーション用の正直な数字)
 * - 本体: 日別グルーピング (日付見出し + その日の分数 + 出来事の行)
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  History,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LearningLog,
  LearningLogKind,
  StudyMinutesBucket,
  Subject,
} from "@/lib/learn/types";

type Props = {
  logs: LearningLog[];
  studyMinutes: StudyMinutesBucket[];
  subjects: Subject[];
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const KIND_META: Record<
  LearningLogKind,
  { label: string; icon: typeof BookOpen; tone: string }
> = {
  read: { label: "読んだ", icon: BookOpen, tone: "text-sky-600" },
  "resume-draft": {
    label: "レジュメを書いた (途中)",
    icon: PencilLine,
    tone: "text-amber-600",
  },
  "resume-done": {
    label: "レジュメを仕上げた",
    icon: CheckCircle2,
    tone: "text-emerald-600",
  },
  "review-promote": {
    label: "振り返りで理解済みに",
    icon: RotateCcw,
    tone: "text-violet-600",
  },
  "assignment-done": {
    label: "宿題・テストをやった",
    icon: ClipboardCheck,
    tone: "text-emerald-600",
  },
};

function fmtMinutes(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  }
  return `${min}分`;
}

export function LearningHistoryView({ logs, studyMinutes, subjects }: Props) {
  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? "";

  // 日別の学習分数
  const minutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of studyMinutes) {
      map.set(b.day, (map.get(b.day) ?? 0) + b.minutes);
    }
    return map;
  }, [studyMinutes]);

  // 日別グルーピング (新しい日が上)
  const groups = useMemo(() => {
    const map = new Map<string, LearningLog[]>();
    for (const log of logs) {
      const day = ymd(new Date(log.createdAt));
      const arr = map.get(day) ?? [];
      arr.push(log);
      map.set(day, arr);
    }
    // 時間だけ付いてログが無い日も出す (読んだだけで何も確定しなかった日)
    for (const day of minutesByDay.keys()) {
      if (!map.has(day)) map.set(day, []);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, list]) => ({
        day,
        list: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));
  }, [logs, minutesByDay]);

  // 今日 / 今週 (直近7日) のサマリー
  const summary = useMemo(() => {
    const todayKey = ymd(new Date());
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    let todayMin = 0;
    let weekMin = 0;
    for (const b of studyMinutes) {
      if (b.day === todayKey) todayMin += b.minutes;
      if (new Date(b.day) >= weekStart) weekMin += b.minutes;
    }
    const todayCount = logs.filter(
      (l) => ymd(new Date(l.createdAt)) === todayKey,
    ).length;
    return { todayMin, weekMin, todayCount };
  }, [studyMinutes, logs]);

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5">
          <header className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <History className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">学習の履歴</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                やったことは自動で残るよ。タスクを作らなくても、足あとはぜんぶここに。
              </p>
            </div>
          </header>

          {/* サマリー (今日 / 今週) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-1 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-primary" />
                  今日
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {fmtMinutes(summary.todayMin)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  できごと {summary.todayCount} 件
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-primary" />
                  この 7 日間
                </span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {fmtMinutes(summary.weekMin)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  読書ビューで学習した時間
                </span>
              </CardContent>
            </Card>
          </div>

          {/* 日別の足あと */}
          {groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <History className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  まだ履歴がないよ。教材を読んだりレジュメを書いたりすると、自動でここに残るよ。
                </p>
              </CardContent>
            </Card>
          ) : (
            groups.map(({ day, list }) => {
              const d = new Date(day);
              const isToday = day === ymd(new Date());
              const min = minutesByDay.get(day) ?? 0;
              return (
                <div key={day} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isToday ? "text-primary" : "text-foreground",
                      )}
                    >
                      {isToday
                        ? "今日"
                        : `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY[d.getDay()]}）`}
                    </span>
                    {min > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {fmtMinutes(min)}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {list.length} 件
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                      読んで過ごした日（{fmtMinutes(min)}）
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {list.map((log) => {
                        const meta = KIND_META[log.kind];
                        const Icon = meta.icon;
                        const time = new Date(log.createdAt);
                        const hh = String(time.getHours()).padStart(2, "0");
                        const mm = String(time.getMinutes()).padStart(2, "0");
                        return (
                          <li
                            key={log.id}
                            className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 text-sm"
                          >
                            <Icon className={cn("size-4 shrink-0", meta.tone)} />
                            <span className="inline-flex w-14 shrink-0 items-center justify-center truncate rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                              {subjectName(log.subjectId) || "—"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-foreground">
                              {log.title}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {meta.label}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {hh}:{mm}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
