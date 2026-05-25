"use client";

/**
 * TodayTaskDashboard - /today-tasks のメインビュー (C22 で /schedule からリネーム)。
 *
 * レイアウト（ito19 さん指定）:
 *   - 上ヘッダ: 試験まで / 未クリア課題 / 今週の予定
 *   - 中央 左: 今日のタスク（メイン）
 *   - 中央 右: 今後 2 週間のミニカレンダー
 *   - 下段: タスク登録パネル（試験対策 / 宿題 / 授業 / 課題）
 *
 * Phase 1 では state はローカルのみ、Phase 2 以降で chat 作成 UI、
 * C23 (Phase 5) で進捗 N/M + 全 done CTA + 各 SI [開始] /learn 遷移 を追加。
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarClock, CheckCircle2, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ExamPrep,
  Homework,
  Issue,
  LessonReview,
  ScheduleItem,
  Subject,
} from "@/lib/learn/types";
import { ScheduleHeader } from "./ScheduleHeader";
import { TodayTaskList } from "./TodayTaskList";
import { ScheduleMiniCalendar } from "./ScheduleMiniCalendar";
import { TaskSourcesPanel } from "./TaskSourcesPanel";

type Props = {
  subjects: Subject[];
  initialTodayItems: ScheduleItem[];
  upcomingItems: ScheduleItem[];
  exams: ExamPrep[];
  homeworks: Homework[];
  lessonReviews: LessonReview[];
  issues: Issue[];
  /**
   * true の時、ヘッダと min-h-screen を出さずに右ペイン埋め込み用の表示にする。
   * Phase 3 で /tutor 右ペイン (?view=today-tasks、C22 でリネーム) で使う。
   */
  embedded?: boolean;
  /**
   * ScheduleItem (type:"issue") のクリックハンドラ。
   * 指定時は TodayTaskList の issue タスクから呼ばれる（/tutor?view=issue&id=xxx 遷移用）。
   */
  onSelectIssueItem?: (issueId: string) => void;
};

export function TodayTaskDashboard({
  subjects,
  initialTodayItems,
  upcomingItems,
  exams,
  homeworks,
  lessonReviews,
  issues,
  embedded = false,
  onSelectIssueItem,
}: Props) {
  const [todayItems, setTodayItems] =
    useState<ScheduleItem[]>(initialTodayItems);

  const handleToggleStatus = (id: string) => {
    setTodayItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "done" ? "todo" : "done",
              doneAt: item.status === "done" ? undefined : new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  // 今週 = 月曜～日曜の予定（簡易: 直近 7 日）
  const thisWeekItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return [...todayItems, ...upcomingItems].filter((i) => {
      const d = new Date(i.date);
      return d >= today && d < weekEnd;
    });
  }, [todayItems, upcomingItems]);

  // 直近の試験
  const nearestExam = useMemo(() => {
    const future = exams
      .filter((e) => new Date(e.examDate) >= new Date(new Date().toDateString()))
      .sort((a, b) => a.examDate.localeCompare(b.examDate));
    return future[0] ?? null;
  }, [exams]);

  // Phase 1: 追加ボタンは Phase 2/3/4 へのスタブ
  const handlePlanWithAi = () => {
    alert(
      "Phase 2 で実装予定：AI と「今日のタスクをどう組み立てるか」を相談する朝の儀式 chat",
    );
  };
  const handleAddExamPrep = () => {
    alert(
      "Phase 2 で実装予定：試験対策を AI 壁打ち chat で作成する画面",
    );
  };
  const handleAddHomework = () => {
    alert("Phase 4 で実装予定：宿題を登録 → AI と一緒に解く伴走 chat");
  };
  const handleAddLessonReview = () => {
    alert(
      "Phase 5 で実装予定：今日の授業内容を本人入力 → 復習タスクが自動生成",
    );
  };

  // C23 Phase 5 P5-Q7: 進捗 N/M done と 全 done 判定
  const doneCount = todayItems.filter((i) => i.status === "done").length;
  const totalCount = todayItems.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const body = (
    <>
      {/* 上ヘッダ */}
      <ScheduleHeader
        nearestExam={nearestExam}
        issues={issues}
        thisWeekItems={thisWeekItems}
      />

      {/* C23 Phase 5: 進捗バー (上部、メイン view 直前) */}
      {totalCount > 0 && (
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-card-foreground">今日の進捗</span>
            <span className="font-semibold tabular-nums">
              {doneCount} / {totalCount} done ({progressPct}%)
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                allDone ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* 中央: 今日のタスク + ミニカレンダー */}
      <div className="grid gap-4 md:grid-cols-[1fr_360px]">
        <TodayTaskList
          items={todayItems}
          onToggleStatus={handleToggleStatus}
          onPlanWithAi={handlePlanWithAi}
          onSelectIssueItem={onSelectIssueItem}
        />
        <ScheduleMiniCalendar
          items={[...todayItems, ...upcomingItems]}
          exams={exams}
        />
      </div>

      {/* C23 Phase 5: 全 done CTA (お疲れさま、振り返ろう) */}
      {allDone && (
        <div className="rounded-md border border-emerald-300/60 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-200">
                <Sparkles className="mr-1 inline size-3.5 text-emerald-600 dark:text-emerald-400" />
                今日のタスク、全部終わったよ! お疲れさま。
              </p>
              <p className="text-[11px] text-muted-foreground">
                今日の学びを軽く振り返ろう。明日にちゃんと繋がる。
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Link href="/tutor?ending=1">
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-emerald-600 px-3 text-[11px] hover:bg-emerald-700"
                  >
                    <Sparkles className="size-3" />
                    <span>ゆいと振り返る</span>
                  </Button>
                </Link>
                <Link href="/learn">
                  <Button size="sm" variant="outline" className="h-7 px-3 text-[11px]">
                    学習画面に戻る
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 下段: タスク登録パネル */}
      <div className="flex items-center gap-2 pt-2">
        <h2 className="text-sm font-semibold text-foreground">
          タスクを追加・管理
        </h2>
        <span className="text-[11px] text-muted-foreground">
          ここから新しい試験対策・宿題・授業復習を登録できます
        </span>
      </div>
      <TaskSourcesPanel
        subjects={subjects}
        exams={exams}
        homeworks={homeworks}
        lessonReviews={lessonReviews}
        issues={issues}
        onAddExamPrep={handleAddExamPrep}
        onAddHomework={handleAddHomework}
        onAddLessonReview={handleAddLessonReview}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
        {body}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <CalendarClock className="size-5 text-primary" />
          <div className="flex-1">
            <h1 className="text-base font-semibold">学習スケジュール</h1>
            <p className="text-xs text-muted-foreground">
              今日 {new Date().toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </p>
          </div>
          <Link href="/learn">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="size-4" />
              <span>学習画面へ</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        {body}
      </main>
    </div>
  );
}
