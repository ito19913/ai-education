/**
 * /tutor — ゆい先生司令室（Phase 3 で 2 ペイン化）。
 *
 * 左ペイン: ゆい先生 chat、右ペイン: 動的に切替（issues / issue chat / schedule / history）。
 * URL ?view= で右ペイン状態を保持。
 *
 * Phase 6 で Claude API + 履歴 / 課題 / スケジュールのコンテキスト注入を追加予定。
 */
import { Suspense } from "react";
import { TutorWorkspace } from "@/components/tutor/TutorWorkspace";
import {
  MOCK_EXAM_PREPS,
  MOCK_HOMEWORKS,
  MOCK_ISSUES,
  MOCK_LESSON_REVIEWS,
  MOCK_MESSAGES,
  MOCK_SCHEDULE_TODAY,
  MOCK_SCHEDULE_UPCOMING,
  MOCK_SESSIONS,
  MOCK_SUBJECTS,
  MOCK_TREE,
} from "@/lib/learn/mock-data";

export const metadata = {
  title: "ゆい先生（司令室）",
};

export default function TutorPage() {
  return (
    <Suspense fallback={null}>
      <TutorWorkspace
        nodes={MOCK_TREE}
        initialIssues={MOCK_ISSUES}
        initialScheduleToday={MOCK_SCHEDULE_TODAY}
        scheduleUpcoming={MOCK_SCHEDULE_UPCOMING}
        exams={MOCK_EXAM_PREPS}
        homeworks={MOCK_HOMEWORKS}
        lessonReviews={MOCK_LESSON_REVIEWS}
        subjects={MOCK_SUBJECTS}
        sessions={MOCK_SESSIONS}
        chatMessages={MOCK_MESSAGES}
      />
    </Suspense>
  );
}
