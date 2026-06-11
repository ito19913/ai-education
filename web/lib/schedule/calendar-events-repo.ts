/**
 * calendar_events リポジトリ (手動の予定イベント、2026-06-09、client 用)
 *
 * Supabase の calendar_events への薄い CRUD。RLS が効くので browser client から直接呼ぶ。
 * 子が自分で入れる「遊び」「試験」「締切」などの予定。勉強タスク (モック) とマージ表示する。
 *
 * owner_id 供給 (getCurrentUserId) は materials-repo のものを再利用する。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type { CalendarEvent } from "@/lib/learn/types";

type CalendarEventRow = {
  id: string;
  owner_id: string;
  title: string;
  event_date: string;
  label_id: string | null;
  start_time: string | null;
  memo: string | null;
  deleted_at: string | null;
};

function rowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    labelId: row.label_id ?? "",
    time: row.start_time ?? undefined,
    memo: row.memo ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** アクティブな (deleted_at is null) 予定一覧。日付昇順。 */
export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .is("deleted_at", null)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data as CalendarEventRow[]).map(rowToEvent);
}

export type CalendarEventInput = {
  title: string;
  date: string;
  labelId: string;
  time?: string;
  memo?: string;
};

/** 予定を追加。 */
export async function insertCalendarEvent(
  input: CalendarEventInput,
  ownerId: string,
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      owner_id: ownerId,
      title: input.title,
      event_date: input.date,
      label_id: input.labelId || null,
      start_time: input.time ?? null,
      memo: input.memo ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToEvent(data as CalendarEventRow);
}

/** 予定を編集 (渡したフィールドだけ更新)。 */
export async function updateCalendarEvent(
  id: string,
  patch: Partial<CalendarEventInput>,
): Promise<void> {
  const supabase = createClient();
  const update: Record<string, string | null> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.date !== undefined) update.event_date = patch.date;
  if (patch.labelId !== undefined) update.label_id = patch.labelId || null;
  if (patch.time !== undefined) update.start_time = patch.time ?? null;
  if (patch.memo !== undefined) update.memo = patch.memo ?? null;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("calendar_events")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

/** 予定を論理削除。 */
export async function softDeleteCalendarEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export { getCurrentUserId };
