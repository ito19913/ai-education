/**
 * learning_logs / study_minutes リポジトリ (学習履歴、2026-06-10、client 用)
 *
 * 履歴は「自動・必須」。実アクション (レジュメ保存・仕上げ・宿題チェック・読書開始) への
 * フックから insert される。learning_logs は不変ログ (insert + select のみ)。
 * study_minutes は読書ビューのアクティブ 1 分ごとに +1 するハートビート方式。
 *
 * owner_id 供給 (getCurrentUserId) は materials-repo のものを再利用する。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type {
  LearningLog,
  LearningLogKind,
  StudyMinutesBucket,
} from "@/lib/learn/types";

export { getCurrentUserId };

// ----------------------------------------------------------------------------
// learning_logs
// ----------------------------------------------------------------------------

type LearningLogRow = {
  id: string;
  owner_id: string;
  kind: string;
  subject_id: string;
  material_id: string | null;
  segment_id: string | null;
  title: string;
  created_at: string;
};

function rowToLog(row: LearningLogRow): LearningLog {
  return {
    id: row.id,
    kind: row.kind as LearningLogKind,
    subjectId: row.subject_id,
    materialId: row.material_id ?? undefined,
    segmentId: row.segment_id ?? undefined,
    title: row.title,
    createdAt: row.created_at,
  };
}

/** 履歴一覧 (新しい順、直近 500 件)。 */
export async function fetchLearningLogs(): Promise<LearningLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as LearningLogRow[]).map(rowToLog);
}

export type NewLearningLogInput = {
  kind: LearningLogKind;
  subjectId: string;
  materialId?: string;
  segmentId?: string;
  title: string;
};

/** 出来事を 1 件記録。 */
export async function insertLearningLog(
  input: NewLearningLogInput,
  ownerId: string,
): Promise<LearningLog> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_logs")
    .insert({
      owner_id: ownerId,
      kind: input.kind,
      subject_id: input.subjectId,
      material_id: input.materialId ?? null,
      segment_id: input.segmentId ?? null,
      title: input.title,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToLog(data as LearningLogRow);
}

// ----------------------------------------------------------------------------
// study_minutes
// ----------------------------------------------------------------------------

type StudyMinutesRow = {
  id: string;
  owner_id: string;
  day: string;
  subject_id: string;
  material_id: string | null;
  minutes: number;
};

function rowToBucket(row: StudyMinutesRow): StudyMinutesBucket {
  return {
    id: row.id,
    day: row.day,
    subjectId: row.subject_id,
    materialId: row.material_id ?? undefined,
    minutes: row.minutes,
  };
}

/** 学習時間バケット一覧 (直近 ~90 日分で十分なので 500 行)。 */
export async function fetchStudyMinutes(): Promise<StudyMinutesBucket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("study_minutes")
    .select("*")
    .order("day", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as StudyMinutesRow[]).map(rowToBucket);
}

/**
 * 学習時間を 1 分加算する (ハートビート)。日 × 教材のバケットを upsert。
 * 単一ユーザー前提なので select → update/insert の素朴な実装で十分。
 * 返り値は加算後のバケット (state 同期用)。
 */
export async function incrementStudyMinute(
  day: string,
  subjectId: string,
  materialId: string,
  ownerId: string,
): Promise<StudyMinutesBucket> {
  const supabase = createClient();
  const { data: existing, error: selErr } = await supabase
    .from("study_minutes")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("day", day)
    .eq("material_id", materialId)
    .limit(1);
  if (selErr) throw selErr;

  if (existing && existing.length > 0) {
    const row = existing[0] as StudyMinutesRow;
    const { data: updated, error: upErr } = await supabase
      .from("study_minutes")
      .update({ minutes: row.minutes + 1 })
      .eq("id", row.id)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return rowToBucket(updated as StudyMinutesRow);
  }

  const { data: created, error: insErr } = await supabase
    .from("study_minutes")
    .insert({
      owner_id: ownerId,
      day,
      subject_id: subjectId,
      material_id: materialId,
      minutes: 1,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return rowToBucket(created as StudyMinutesRow);
}
