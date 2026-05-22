"use client";

/**
 * ScheduleDashboard - /schedule のメインビュー。
 *
 * レイアウト（ito19 さん指定）:
 *   - 上ヘッダ: 試験まで / 未クリア課題 / 今週の予定
 *   - 中央 左: 今日のタスク（メイン）
 *   - 中央 右: 今後 2 週間のミニカレンダー
 *   - 下段: タスク登録パネル（試験対策 / 宿題 / 授業 / 課題）
 *
 * Phase 1 では state はローカルのみ。Phase 2 以降で chat 作成 UI と
 * Supabase 永続化を順次追加。
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarClock, Home } from "lucide-react";
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
};

export function ScheduleDashboard({
  subjects,
  initialTodayItems,
  upcomingItems,
  exams,
  homeworks,
  lessonReviews,
  issues,
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
        {/* 上ヘッダ */}
        <ScheduleHeader
          nearestExam={nearestExam}
          issues={issues}
          thisWeekItems={thisWeekItems}
        />

        {/* 中央: 今日のタスク + ミニカレンダー */}
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          <TodayTaskList
            items={todayItems}
            onToggleStatus={handleToggleStatus}
            onPlanWithAi={handlePlanWithAi}
          />
          <ScheduleMiniCalendar
            items={[...todayItems, ...upcomingItems]}
            exams={exams}
          />
        </div>

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
      </main>
    </div>
  );
}
