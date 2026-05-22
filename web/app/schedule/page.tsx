/**
 * /schedule — 学習スケジュールのダッシュボード（時間軸の集約画面）。
 *
 * Phase 1 mock: ダッシュボード骨格 + 4 task type のサンプルデータ。
 * Phase 2 以降で AI chat による作成 UI と Supabase 永続化を順次追加。
 */
import { ScheduleDashboard } from "@/components/schedule/ScheduleDashboard";
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
  title: "学習スケジュール",
};

export default function SchedulePage() {
  return (
    <ScheduleDashboard
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
