/**
 * 予定のマージ (2026-06-09)。
 *
 * 勉強タスク (ScheduleItem、当面モック) と 手動イベント (CalendarEvent、実DB) を、
 * ラベル色つきの「1 本のカレンダー項目 (CalendarEntry)」に正規化してまとめる。
 *
 * - 勉強タスクは kind="study" のラベル (勉強) に自動で紐づく (色・名前はそのラベルから)。
 * - 手動イベントは labelId のラベルから色・名前・試験フラグ (kind="exam") を引く。
 * - 並びは 日付昇順 → 終日(時刻なし)を先 → 時刻昇順。
 *
 * 2026-06-11 追加: 宿題・テストの提出日マーカー (AssignmentMarker) を自動マージ。
 * 教材側 (materials.due_date) が真実の情報源で、カレンダーには行を作らない (導出のみ、
 * 二重管理しない)。テスト = kind="exam" ラベルの色 (「あと◯日」付き)、宿題 = 名前に
 * 締切/提出を含む normal ラベルの色。リスト/カレンダーでは編集不可 (編集は宿題側で)。
 */
import type {
  CalendarEvent,
  EventLabel,
  EventLabelColor,
  ScheduleItem,
} from "@/lib/learn/types";

/** 宿題・テスト由来の自動マーカー (DashboardPane が materials から導出して渡す)。 */
export type AssignmentMarker = {
  /** Material.id */
  id: string;
  name: string;
  /** YYYY-MM-DD (提出日 / テスト日) */
  dueDate: string;
  isTest: boolean;
};

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
  source: "study" | "event" | "assignment";
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
  /** 宿題・テストの提出日マーカー (2026-06-11、導出のみ・行は作らない) */
  assignments: AssignmentMarker[] = [],
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

  // 宿題・テストの提出日マーカー (テスト = exam ラベル色 + あと◯日 / 宿題 = 締切・提出ラベル色)。
  // ラベルは改名されうるので kind / 名前キーワードで引き、無ければ固定色フォールバック。
  const examLabel =
    labels.find((l) => l.kind === "exam" && !l.deletedAt) ?? null;
  const dueLabel =
    labels.find(
      (l) => l.kind === "normal" && !l.deletedAt && /締切|提出/.test(l.name),
    ) ?? null;
  const assignmentEntries: CalendarEntry[] = assignments.map((a) => ({
    id: `assignment-${a.id}`,
    title: a.isTest ? a.name : `${a.name}（提出）`,
    date: a.dueDate,
    color: a.isTest
      ? (examLabel?.color ?? "violet")
      : (dueLabel?.color ?? "orange"),
    labelName: a.isTest
      ? (examLabel?.name ?? "試験")
      : (dueLabel?.name ?? "締切・提出"),
    isExam: a.isTest,
    source: "assignment" as const,
  }));

  return [...studyEntries, ...eventEntries, ...assignmentEntries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // 終日 (時刻なし) を先に、時刻ありは時刻昇順
    const at = a.time ?? "";
    const bt = b.time ?? "";
    if (!at && bt) return -1;
    if (at && !bt) return 1;
    return at.localeCompare(bt);
  });
}
