"use client";

/**
 * ScheduleTaskTypeIcon - タスク種別に応じたアイコン + ラベル + 配色。
 * 全画面で一貫して使うため共通化。
 */
import {
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  Target,
} from "lucide-react";
import type { StudyTaskType } from "@/lib/learn/types";

export const TASK_TYPE_LABEL: Record<StudyTaskType, string> = {
  issue: "課題",
  "lesson-review": "授業復習",
  "exam-prep": "試験対策",
  homework: "宿題",
};

type ToneClasses = {
  badge: string;
  ring: string;
  bg: string;
};

export const TASK_TYPE_TONE: Record<StudyTaskType, ToneClasses> = {
  issue: {
    badge:
      "border-orange-300/60 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
    ring: "ring-orange-300/60",
    bg: "bg-orange-50/40 dark:bg-orange-950/20",
  },
  "lesson-review": {
    badge:
      "border-sky-300/60 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
    ring: "ring-sky-300/60",
    bg: "bg-sky-50/40 dark:bg-sky-950/20",
  },
  "exam-prep": {
    badge:
      "border-violet-300/60 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300",
    ring: "ring-violet-300/60",
    bg: "bg-violet-50/40 dark:bg-violet-950/20",
  },
  homework: {
    badge:
      "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    ring: "ring-emerald-300/60",
    bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
};

export function TaskTypeIcon({
  type,
  className,
}: {
  type: StudyTaskType;
  className?: string;
}) {
  const cls = className ?? "size-3.5";
  if (type === "issue") return <Target className={cls} />;
  if (type === "lesson-review") return <BookOpenCheck className={cls} />;
  if (type === "exam-prep") return <GraduationCap className={cls} />;
  return <ClipboardList className={cls} />;
}
