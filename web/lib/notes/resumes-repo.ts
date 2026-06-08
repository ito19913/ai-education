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
import type { Resume } from "@/lib/learn/types";

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
