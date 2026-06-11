/**
 * 予定のマージ (2026-06-09)。
 *
 * 勉強タスク (ScheduleItem、当面モック) と 手動イベント (CalendarEvent、実DB) を、
 * ラベル色つきの「1 本のカレンダー項目 (CalendarEntry)」に正規化してまとめる。
 *
 * - 勉強タスクは kind="study" のラベル (勉強) に自動で紐づく (色・名前はそのラベルから)。
 * - 手動イベントは labelId のラベルから色・名前・試験フラグ (kind="exam") を引く。
 * - 並びは 日付昇順 → 終日(時刻なし)を先 → 時刻昇順。
 */
import type {
  CalendarEvent,
  EventLabel,
  EventLabelColor,
  ScheduleItem,
} from "@/lib/learn/types";

export type CalendarEntry = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  time?: string;
  color: EventLabelColor;
  labelName: string;
  /** 試験ラベル (kind="exam") か。リストで「あと◯日」を出す。 */
  isExam: boolean;
  source: "study" | "event";
  /** 勉強タスクの所要分 (あれば) */
  estimateMinutes?: number;
  /** 勉強タスクの完了状態 (done なら淡く表示) */
  done?: boolean;
  /** source="event" のとき、編集用の元データ */
  event?: CalendarEvent;
};

export function findStudyLabel(labels: EventLabel[]): EventLabel | null {
  return labels.find((l) => l.kind === "study" && !l.deletedAt) ?? null;
}

export function mergeCalendarEntries(
  studyItems: ScheduleItem[],
  events: CalendarEvent[],
  labels: EventLabel[],
): CalendarEntry[] {
  const studyLabel = findStudyLabel(labels);
  const studyColor: EventLabelColor = studyLabel?.color ?? "blue";
  const studyName = studyLabel?.name ?? "勉強";

  const labelById = new Map(labels.map((l) => [l.id, l]));

  const studyEntries: CalendarEntry[] = studyItems.map((it) => ({
    id: `study-${it.id}`,
    title: it.title,
    date: it.date,
    color: studyColor,
    labelName: studyName,
    isExam: false,
    source: "study",
    estimateMinutes: it.estimateMinutes,
    done: it.status === "done",
  }));

  const eventEntries: CalendarEntry[] = events
    .filter((e) => !e.deletedAt)
    .map((e) => {
      const label = labelById.get(e.labelId);
      return {
        id: `event-${e.id}`,
        title: e.title,
        date: e.date,
        time: e.time,
        color: (label?.color ?? "slate") as EventLabelColor,
        labelName: label?.name ?? "予定",
        isExam: label?.kind === "exam",
        source: "event" as const,
        event: e,
      };
    });

  return [...studyEntries, ...eventEntries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // 終日 (時刻なし) を先に、時刻ありは時刻昇順
    const at = a.time ?? "";
    const bt = b.time ?? "";
    if (!at && bt) return -1;
    if (at && !bt) return 1;
    return at.localeCompare(bt);
  });
}
