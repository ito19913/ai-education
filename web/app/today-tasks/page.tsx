/**
 * /today-tasks — 今日のタスク ダッシュボード (時間軸の集約画面)。
 * C22 (Phase 5 P5-Q7) で /schedule からリネーム。
 *
 * Phase 1 mock: ダッシュボード骨格 + 4 task type のサンプルデータ。
 * Phase 5 C23 で各 SI に [開始] /learn 遷移 + 進捗 N/M + 全 done CTA を追加。
 * Phase 2 以降で AI chat による作成 UI、Phase 7 で Supabase 永続化。
 */
import { TodayTaskDashboard } from "@/components/today-tasks/TodayTaskDashboard";
import {
  MOCK_EXAM_PREPS,
  MOCK_HOMEWORKS,
  MOCK_ISSUES,
  MOCK_LESSON_REVIEWS,
  MOCK_SCHEDULE_TODAY,
  MOCK_SCHEDULE_UPCOMING,
  MOCK_SUBJECTS,
} from "@/lib/learn/mock-data";

export const metadata = {
  title: "今日のタスク",
};

export default function TodayTasksPage() {
  return (
    <TodayTaskDashboard
      subjects={MOCK_SUBJECTS}
      initialTodayItems={MOCK_SCHEDULE_TODAY}
      upcomingItems={MOCK_SCHEDULE_UPCOMING}
      exams={MOCK_EXAM_PREPS}
      homeworks={MOCK_HOMEWORKS}
      lessonReviews={MOCK_LESSON_REVIEWS}
      issues={MOCK_ISSUES}
    />
  );
}
