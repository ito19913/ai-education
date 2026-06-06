/**
 * note_entries リポジトリ (まとめノート N9① MVP、2026-06-05、client 用)
 *
 * Supabase の note_entries テーブルへの薄い CRUD。RLS が効くので browser client から
 * 直接呼んでよい (本人は自分の行、admin は全行)。1-B materials-repo.ts と同型。
 *
 * - fetchNoteEntries     … deleted_at is null のエントリ一覧 (科目で絞れる)
 * - insertNoteEntry      … 能動ゲート通過時に 1 件作成 (id は DB 採番)
 * - updateNoteEntry      … 自分メモ / ステータス更新
 * - softDeleteNoteEntry  … 論理削除 (deleted_at = now())
 *
 * owner_id 供給は materials-repo の getCurrentUserId を再利用。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type { NoteEntry } from "@/lib/learn/types";

export { getCurrentUserId };

/** note_entries テーブルの 1 行 (DB 形、snake_case)。 */
type NoteEntryRow = {
  id: string;
  owner_id: string;
  subject_id: string;
  concept_name: string;
  ai_summary: string;
  status: string;
  source_material_id: string | null;
  source_page_range: string | null;
  source_segment_id: string | null;
  parent_ref: string | null;
  user_note: string | null;
  deleted_at: string | null;
};

function rowToNoteEntry(row: NoteEntryRow): NoteEntry {
  return {
    id: row.id,
    subjectId: row.subject_id,
    conceptName: row.concept_name,
    aiSummary: row.ai_summary,
    status: row.status === "open" ? "open" : "understood",
    sourceMaterialId: row.source_material_id ?? undefined,
    sourcePageRange: row.source_page_range ?? undefined,
    sourceSegmentId: row.source_segment_id ?? undefined,
    parentRef: row.parent_ref ?? undefined,
    userNote: row.user_note ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** アクティブな (deleted_at is null) ノートエントリ一覧。RLS で本人/admin 分のみ。 */
export async function fetchNoteEntries(subjectId?: string): Promise<NoteEntry[]> {
  const supabase = createClient();
  let query = supabase
    .from("note_entries")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as NoteEntryRow[]).map(rowToNoteEntry);
}

/** 能動ゲート通過時に作成する 1 エントリの入力。 */
export type NewNoteEntryInput = {
  subjectId: string;
  conceptName: string;
  aiSummary: string;
  status?: "understood" | "open";
  sourceMaterialId?: string;
  sourcePageRange?: string;
  /** 刻んだ まとまり ConceptSegment.id (M1)。スライダーの緑チェック判定に使う。 */
  sourceSegmentId?: string;
  parentRef?: string;
  /** まとめ時に取り込んだ子のメモ (N7、grill Q2) */
  userNote?: string;
};

/** ノートエントリを作成 (id は DB 採番)。生成行を返す。 */
export async function insertNoteEntry(
  input: NewNoteEntryInput,
  ownerId: string,
): Promise<NoteEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("note_entries")
    .insert({
      owner_id: ownerId,
      subject_id: input.subjectId,
      concept_name: input.conceptName,
      ai_summary: input.aiSummary,
      status: input.status ?? "understood",
      source_material_id: input.sourceMaterialId ?? null,
      source_page_range: input.sourcePageRange ?? null,
      source_segment_id: input.sourceSegmentId ?? null,
      parent_ref: input.parentRef ?? null,
      user_note: input.userNote ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToNoteEntry(data as NoteEntryRow);
}

/** 自分メモ / ステータスの更新。 */
export async function updateNoteEntry(
  id: string,
  patch: Partial<Pick<NoteEntry, "userNote" | "status">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.userNote !== undefined) row.user_note = patch.userNote;
  if (patch.status !== undefined) row.status = patch.status;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("note_entries").update(row).eq("id", id);
  if (error) throw error;
}

/** 論理削除 (deleted_at = now())。 */
export async function softDeleteNoteEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("note_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
