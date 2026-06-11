"use client";

/**
 * ScheduleMiniCalendar - 直近 2 週間の予定をミニカレンダーで。
 *
 * - 月曜始まり、2 週間分（14 日）固定でコンパクト
 * - 各日に type 別のドットを表示
 * - 「今日」「試験日」を強調
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import type { ExamPrep, ScheduleItem, StudyTaskType } from "@/lib/learn/types";
import { TASK_TYPE_TONE } from "./ScheduleTaskTypeIcon";

type Props = {
  items: ScheduleItem[];
  exams: ExamPrep[];
  /** 「今日」基準 */
  now?: Date;
  /**
   * true の時、外側の Card + ヘッダ ("今後 2 週間") を出さずに中身 (グリッド + 凡例)
   * だけを描画する。SchedulePanel が枠とトグルを提供する時に使う (2026-06-09)。
   */
  bare?: boolean;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 月曜始まりで「今日」を含む週の月曜を返す */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function ScheduleMiniCalendar({ items, exams, now, bare }: Props) {
  const today = now ?? new Date();
  const todayKey = ymd(today);
  const weekStart = startOfWeek(today);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return map;
  }, [items]);

  const examDateSet = useMemo(
    () => new Set(exams.map((e) => e.examDate)),
    [exams],
  );

  // 2 週間 = 14 マス
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

  const inner = (
    <>
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
            const stat = byDate.get(key) ?? [];
            const isToday = key === todayKey;
            const isExam = examDateSet.has(key);
            const past =
              key < todayKey && !isToday; // string compare safe for YYYY-MM-DD
            const types = new Set<StudyTaskType>(stat.map((s) => s.type));
            return (
              <div
                key={key}
                className={[
                  "flex min-h-[56px] flex-col gap-1 rounded-md border p-1.5 text-[10px]",
                  isExam
                    ? "border-violet-500/60 bg-violet-50/60 dark:border-violet-700/60 dark:bg-violet-950/30"
                    : isToday
                      ? "border-primary bg-primary/5"
                      : past
                        ? "border-border/40 bg-muted/30 text-muted-foreground"
                        : "border-border bg-card",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      isToday
                        ? "font-bold text-primary"
                        : isExam
                          ? "font-semibold text-violet-700"
                          : "text-foreground/80"
                    }
                  >
                    {d.getDate()}
                  </span>
                  {isExam && (
                    <span className="rounded bg-violet-500/15 px-1 text-[9px] font-bold text-violet-700">
                      試験
                    </span>
                  )}
                </div>
                {/* type 別ドット */}
                {types.size > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {Array.from(types).map((t) => (
                      <span
                        key={t}
                        className={`size-1.5 rounded-full ${dotClass(t)}`}
                        title={t}
                      />
                    ))}
                  </div>
                )}
                {stat.length > 0 && (
                  <span className="mt-auto text-[9px] font-medium text-foreground">
                    {stat.length} 件
                  </span>
                )}
              </div>
            );
          })}
        </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <DotLegend type="lesson-review" label="授業復習" />
        <DotLegend type="exam-prep" label="試験対策" />
        <DotLegend type="homework" label="宿題" />
        <DotLegend type="issue" label="課題" />
      </div>
    </>
  );

  // SchedulePanel から bare で呼ばれた時は中身だけ返す (枠は呼び出し側が持つ)
  if (bare) return inner;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarRange className="size-4 text-primary" />
          <span>今後 2 週間</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}

function dotClass(type: StudyTaskType): string {
  switch (type) {
    case "issue":
      return "bg-orange-500";
    case "lesson-review":
      return "bg-sky-500";
    case "exam-prep":
      return "bg-violet-500";
    case "homework":
      return "bg-emerald-500";
  }
}

function DotLegend({
  type,
  label,
}: {
  type: StudyTaskType;
  label: string;
}) {
  // TASK_TYPE_TONE への参照を踏ませて未使用 warning を抑制
  void TASK_TYPE_TONE;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${dotClass(type)}`} />
      <span>{label}</span>
    </span>
  );
}
