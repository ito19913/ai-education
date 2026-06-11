/**
 * event_labels リポジトリ (予定ラベル、2026-06-09、client 用)
 *
 * Supabase の event_labels への薄い CRUD。RLS が効くので browser client から直接呼ぶ。
 * DB 行 (snake_case) ⇔ EventLabel 型 (camelCase) の変換も担う。
 *
 * 設計 (grill 確定):
 *   - デフォルト5つ (勉強/試験/締切・提出/遊び・予定/習い事) はオンデマンドでシードする
 *     (ensureDefaultEventLabels: 起動時にラベルが 0 件なら作る)。
 *   - kind="study" のラベル (勉強) は削除保護 (呼び出し側でガード)。改名・色変更は可。
 *
 * owner_id 供給 (getCurrentUserId) は materials-repo のものを再利用する。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import { DEFAULT_EVENT_LABELS } from "@/lib/learn/event-colors";
import type { EventLabel, EventLabelColor, EventLabelKind } from "@/lib/learn/types";

type EventLabelRow = {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  kind: string;
  deleted_at: string | null;
};

function rowToLabel(row: EventLabelRow): EventLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color as EventLabelColor,
    kind: (["study", "exam", "normal"].includes(row.kind)
      ? row.kind
      : "normal") as EventLabelKind,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** アクティブな (deleted_at is null) ラベル一覧。 */
export async function fetchEventLabels(): Promise<EventLabel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_labels")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as EventLabelRow[]).map(rowToLabel);
}

/**
 * ラベルを確保する。1 件もなければデフォルト5つをシードして返す。
 * 既にあればそのまま返す (二重シード防止のため先に件数確認)。
 */
export async function ensureDefaultEventLabels(
  ownerId: string,
): Promise<EventLabel[]> {
  const supabase = createClient();
  const existing = await fetchEventLabels();
  if (existing.length > 0) return existing;

  const rows = DEFAULT_EVENT_LABELS.map((d) => ({
    owner_id: ownerId,
    name: d.name,
    color: d.color,
    kind: d.kind,
  }));
  const { data, error } = await supabase
    .from("event_labels")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return (data as EventLabelRow[]).map(rowToLabel);
}

/** 新しいラベルを作成 (自作ラベルは kind="normal")。 */
export async function insertEventLabel(
  name: string,
  color: EventLabelColor,
  ownerId: string,
): Promise<EventLabel> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_labels")
    .insert({ owner_id: ownerId, name, color, kind: "normal" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToLabel(data as EventLabelRow);
}

/** ラベルの改名・色変更 (kind は変えない)。 */
export async function updateEventLabel(
  id: string,
  patch: { name?: string; color?: EventLabelColor },
): Promise<void> {
  const supabase = createClient();
  const update: Record<string, string> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.color !== undefined) update.color = patch.color;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from("event_labels")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

/**
 * ラベルを論理削除する。kind="study" (勉強) は呼び出し側でガードする想定。
 * このラベルを使っていた予定は label_id がそのまま残る (表示はフォールバック色)。
 */
export async function softDeleteEventLabel(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_labels")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export { getCurrentUserId };
