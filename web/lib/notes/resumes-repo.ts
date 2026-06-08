/**
 * resumes リポジトリ (レジュメ冊管理 R10 Phase 1、2026-06-08、client 用)
 *
 * Supabase の resumes テーブルへの薄い CRUD。RLS が効くので browser client から
 * 直接呼んでよい (本人は自分の行、admin は全行)。DB 行 (snake_case) ⇔ Resume 型
 * (camelCase) の変換も担う。notes-repo / subjects-repo と同型。
 *
 * 設計 (R10 grill 確定):
 *   - 1 科目 1 冊が原則。デフォルト冊は「オンデマンド」で作る (起動時一括ではない)。
 *     ResumePane が保存する直前に ensureDefaultResume を呼ぶ。
 *   - ensureDefaultResume は ①その科目のデフォルト冊を探し ②無ければ作り
 *     ③その科目の resume_id 未設定ピースをその冊へ backfill して ④冊を返す。
 *
 * - fetchResumes        … 起動時に deleted_at is null の冊一覧を取得
 * - ensureDefaultResume … 科目のデフォルト冊を確保 (無ければ作成 + backfill) して返す
 *
 * owner_id 供給 (getCurrentUserId) は materials-repo のものを再利用する。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type { NoteEntry, Resume } from "@/lib/learn/types";

export { getCurrentUserId };

/** resumes テーブルの 1 行 (DB 形、snake_case)。 */
type ResumeRow = {
  id: string;
  owner_id: string;
  subject_id: string;
  name: string;
  is_default: boolean;
  deleted_at: string | null;
};

function rowToResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    isDefault: row.is_default,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** アクティブな (deleted_at is null) 冊一覧。RLS で本人/admin 分のみ。 */
export async function fetchResumes(): Promise<Resume[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ResumeRow[]).map(rowToResume);
}

/** 冊の自動命名 (R10: 「科目名 + レジュメ」)。 */
export function defaultResumeName(subjectName: string): string {
  return `${subjectName}レジュメ`;
}

/**
 * 科目のデフォルト冊を確保して返す (オンデマンド)。
 * 既にあればそれを返し、無ければ作成 → 同科目の resume_id 未設定ピースを backfill。
 *
 * @param subjectId   科目 id (ハードコード "subj-english" もカスタム uuid も可)
 * @param subjectName 冊名生成用の科目名 (例 "英語")
 * @param ownerId     持ち主 (getCurrentUserId() の結果)
 */
export async function ensureDefaultResume(
  subjectId: string,
  subjectName: string,
  ownerId: string,
): Promise<Resume> {
  const supabase = createClient();

  // ① 既存のデフォルト冊を探す
  const { data: existing, error: selErr } = await supabase
    .from("resumes")
    .select("*")
    .eq("subject_id", subjectId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length > 0) {
    return rowToResume(existing[0] as ResumeRow);
  }

  // ② 無ければ作成
  const { data: created, error: insErr } = await supabase
    .from("resumes")
    .insert({
      owner_id: ownerId,
      subject_id: subjectId,
      name: defaultResumeName(subjectName),
      is_default: true,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  const resume = rowToResume(created as ResumeRow);

  // ③ 既存ピースの backfill: この科目で resume_id 未設定の note を新デフォルト冊へ。
  //    失敗しても冊作成自体は成功扱い (次回 ensure で再試行される)。
  const { error: backfillErr } = await supabase
    .from("note_entries")
    .update({ resume_id: resume.id })
    .eq("owner_id", ownerId)
    .eq("subject_id", subjectId)
    .is("resume_id", null);
  if (backfillErr) {
    console.error("[レジュメ冊] backfill 失敗:", backfillErr);
  }

  return resume;
}

// ============================================================================
// Phase 2: 冊の追加 / リネーム / デフォルト変更 / 削除 + ピースの別冊振り分け
// ============================================================================

/** 新しい冊を作成 (Phase 2「＋冊を追加」/「新しい冊を作って移す」)。is_default=false。 */
export async function insertResume(
  subjectId: string,
  name: string,
  ownerId: string,
): Promise<Resume> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resumes")
    .insert({
      owner_id: ownerId,
      subject_id: subjectId,
      name,
      is_default: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToResume(data as ResumeRow);
}

/** 冊名のリネーム。 */
export async function renameResume(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("resumes")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

/**
 * デフォルト冊を変更する。同科目の既存デフォルトを false にしてから対象を true に。
 * 「科目に常に最低1冊+デフォルト1つ」を保つ (対象を true にしてから旧を false にする
 * 順だと一瞬 2 つになるが論理削除しないので実害なし、ここは旧→新の順で 0 を作らない)。
 */
export async function setDefaultResume(
  id: string,
  subjectId: string,
  ownerId: string,
): Promise<void> {
  const supabase = createClient();
  // 対象を true (先に立てて「デフォルト0」状態を作らない)
  const { error: upErr } = await supabase
    .from("resumes")
    .update({ is_default: true })
    .eq("id", id);
  if (upErr) throw upErr;
  // 同科目の他の冊を false に
  const { error: downErr } = await supabase
    .from("resumes")
    .update({ is_default: false })
    .eq("owner_id", ownerId)
    .eq("subject_id", subjectId)
    .neq("id", id);
  if (downErr) throw downErr;
}

/**
 * 冊を論理削除する (Phase 2)。★中のピースは先にデフォルト冊へ移してから削除し、
 * 子の本文を絶対に失わせない。デフォルト冊自体は呼び出し側でガードする (削除不可)。
 *
 * @param id               削除する冊
 * @param defaultResumeId  ピースの移動先 (その科目のデフォルト冊)
 */
export async function softDeleteResume(
  id: string,
  defaultResumeId: string,
  ownerId: string,
): Promise<void> {
  const supabase = createClient();
  // ① 中のピースをデフォルト冊へ移す
  const { error: moveErr } = await supabase
    .from("note_entries")
    .update({ resume_id: defaultResumeId })
    .eq("owner_id", ownerId)
    .eq("resume_id", id);
  if (moveErr) throw moveErr;
  // ② 冊を論理削除
  const { error: delErr } = await supabase
    .from("resumes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (delErr) throw delErr;
}

/** ピースを別の冊へ振り分ける (Phase 2、同一科目内、R5)。 */
export async function moveEntryToResume(
  entryId: string,
  resumeId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("note_entries")
    .update({ resume_id: resumeId })
    .eq("id", entryId);
  if (error) throw error;
}

/**
 * 冊をコピーする (Phase 3)。同科目に新しい冊 (is_default=false) を作り、元の冊の
 * 全ピース (deleted_at null) を新 id で複製して新冊へ入れる。出典等はそのまま。
 * 作成した冊と複製エントリを返す (state 反映用)。
 */
export async function copyResume(
  sourceResumeId: string,
  sourceSubjectId: string,
  newName: string,
  ownerId: string,
): Promise<{ resume: Resume; entries: NoteEntry[] }> {
  const supabase = createClient();

  // ① 新しい冊を作成
  const { data: createdResume, error: insResErr } = await supabase
    .from("resumes")
    .insert({
      owner_id: ownerId,
      subject_id: sourceSubjectId,
      name: newName,
      is_default: false,
    })
    .select("*")
    .single();
  if (insResErr) throw insResErr;
  const resume = rowToResume(createdResume as ResumeRow);

  // ② 元の冊のピースを取得
  const { data: srcRows, error: selErr } = await supabase
    .from("note_entries")
    .select("*")
    .eq("resume_id", sourceResumeId)
    .is("deleted_at", null);
  if (selErr) throw selErr;

  const sources = (srcRows ?? []) as Record<string, unknown>[];
  if (sources.length === 0) return { resume, entries: [] };

  // ③ 複製行を作成 (id/created_at は DB 採番、resume_id だけ新冊に差し替え)
  const dupRows = sources.map((r) => ({
    owner_id: ownerId,
    subject_id: r.subject_id,
    concept_name: r.concept_name,
    ai_summary: r.ai_summary,
    status: r.status,
    source_material_id: r.source_material_id ?? null,
    source_page_range: r.source_page_range ?? null,
    source_segment_id: r.source_segment_id ?? null,
    parent_ref: r.parent_ref ?? null,
    user_note: r.user_note ?? null,
    resume_id: resume.id,
  }));
  const { data: insRows, error: insErr } = await supabase
    .from("note_entries")
    .insert(dupRows)
    .select("*");
  if (insErr) throw insErr;

  const entries: NoteEntry[] = (insRows as Record<string, unknown>[]).map(
    (row) => ({
      id: row.id as string,
      subjectId: row.subject_id as string,
      conceptName: row.concept_name as string,
      aiSummary: row.ai_summary as string,
      status: row.status === "open" ? "open" : "understood",
      sourceMaterialId: (row.source_material_id as string) ?? undefined,
      sourcePageRange: (row.source_page_range as string) ?? undefined,
      sourceSegmentId: (row.source_segment_id as string) ?? undefined,
      parentRef: (row.parent_ref as string) ?? undefined,
      resumeId: (row.resume_id as string) ?? undefined,
      userNote: (row.user_note as string) ?? undefined,
    }),
  );
  return { resume, entries };
}

/**
 * 科目付け間違いの修正: ピースを別の科目へ移す (subject_id + resume_id を更新)。
 * 着地先は移動先科目のデフォルト冊 (呼び出し側で ensureDefaultResume 済みの id を渡す)。
 * 出典 (source_material_id 等) はそのまま。
 */
export async function moveEntryToSubject(
  entryId: string,
  subjectId: string,
  resumeId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("note_entries")
    .update({ subject_id: subjectId, resume_id: resumeId })
    .eq("id", entryId);
  if (error) throw error;
}
