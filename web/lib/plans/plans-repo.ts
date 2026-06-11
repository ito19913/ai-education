/**
 * plans リポジトリ (新プラン: ザックリ・まとまりキュー型、2026-06-10、client 用)
 *
 * Supabase の plans テーブルへの薄い CRUD。RLS が効くので browser client から直接呼ぶ。
 * DB 行 (snake_case) ⇔ StudyPlan 型 (camelCase) の変換も担う。他 repo と同型。
 *
 * 進捗 (済み/先頭まとまり) はここでは扱わない。レジュメ (note_entries) から
 * lib/plans/plan-progress.ts で導出する (プランは状態を持たない、grill 確定)。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type { StudyPlan } from "@/lib/learn/types";

export { getCurrentUserId };

/** plans テーブルの 1 行 (DB 形、snake_case)。 */
type PlanRow = {
  id: string;
  owner_id: string;
  subject_id: string;
  material_id: string;
  ends_at: string;
  status: string;
  skipped_segment_ids: string[] | null;
  count_from: string | null;
  created_at: string;
  deleted_at: string | null;
};

function rowToPlan(row: PlanRow): StudyPlan {
  return {
    id: row.id,
    subjectId: row.subject_id,
    materialId: row.material_id,
    endsAt: row.ends_at,
    status: row.status === "completed" ? "completed" : "active",
    skippedSegmentIds: row.skipped_segment_ids ?? [],
    countFrom: row.count_from ?? undefined,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** アクティブな (deleted_at is null) プラン一覧。completed も含む (表示側で出し分け)。 */
export async function fetchPlans(): Promise<StudyPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as PlanRow[]).map(rowToPlan);
}

export type NewPlanInput = {
  subjectId: string;
  materialId: string;
  /** チェックポイント日 (YYYY-MM-DD) */
  endsAt: string;
  /** 2周目 (最初からやり直す) なら ISO を渡す。通常作成は undefined。 */
  countFrom?: string;
};

/** プランを作成 (「プランに組み込む」)。 */
export async function insertPlan(
  input: NewPlanInput,
  ownerId: string,
): Promise<StudyPlan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({
      owner_id: ownerId,
      subject_id: input.subjectId,
      material_id: input.materialId,
      ends_at: input.endsAt,
      status: "active",
      skipped_segment_ids: [],
      count_from: input.countFrom ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToPlan(data as PlanRow);
}

/** 期限を変更 (チェックポイントの「延長する」)。 */
export async function updatePlanEndsAt(id: string, endsAt: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("plans")
    .update({ ends_at: endsAt })
    .eq("id", id);
  if (error) throw error;
}

/** ステータス変更 (チェックポイントの「ここで終了」= completed)。 */
export async function updatePlanStatus(
  id: string,
  status: "active" | "completed",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("plans")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

/** スキップした まとまり id 群を上書き保存 (トグルのたびに全量)。 */
export async function updatePlanSkips(
  id: string,
  skippedSegmentIds: string[],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("plans")
    .update({ skipped_segment_ids: skippedSegmentIds })
    .eq("id", id);
  if (error) throw error;
}

/** プランを論理削除 (やめる。レジュメ・教材には触らない)。 */
export async function softDeletePlan(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
