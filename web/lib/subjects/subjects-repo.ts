/**
 * subjects リポジトリ (2026-06-07、client 用)
 *
 * Supabase の subjects テーブルへの薄い CRUD。RLS が効くので browser client から
 * 直接呼んでよい (本人は自分の行、admin は全行)。DB 行 (snake_case) ⇔ Subject 型
 * (camelCase) の変換も担う。
 *
 * 設計: ハードコード5教科 (英・数・国・理・社) はコード側 MOCK_SUBJECTS に残し、
 * 本テーブルには「ユーザーが手動追加したカスタム科目」のみ保存する。起動時に
 * fetchCustomSubjects() で取得し、5教科にマージする (TutorWorkspace 側)。
 *
 * - fetchCustomSubjects … 起動時に deleted_at is null のカスタム科目一覧を取得
 * - insertSubject       … 登録 (id は DB 採番)、生成行を Subject で返す
 * - softDeleteSubject   … 論理削除 (deleted_at = now())
 *
 * owner_id 供給 (getCurrentUserId) は materials-repo のものを再利用する。
 */
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/learn/types";

/** subjects テーブルの 1 行 (DB 形、snake_case)。 */
type SubjectRow = {
  id: string;
  owner_id: string;
  name: string;
  teacher_name: string;
  avatar_letter: string;
  deleted_at: string | null;
};

/** DB 行 → アプリの Subject 型へ変換 (teacher 表示用フィールドを再構築)。 */
function rowToSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    teacher: {
      name: row.teacher_name,
      displayName: `${row.teacher_name}先生`,
      avatarLetter: row.avatar_letter,
      subtitle: `${row.name}の先生`,
    },
  };
}

/** アクティブな (deleted_at is null) カスタム科目一覧を取得。RLS で本人/admin 分のみ。 */
export async function fetchCustomSubjects(): Promise<Subject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as SubjectRow[]).map(rowToSubject);
}

/** 登録に必要なカスタム科目のフィールド (id は DB 採番)。 */
export type NewSubjectInput = {
  name: string;
  teacherName: string;
  avatarLetter: string;
};

/** カスタム科目を作成 (id は DB 採番)。生成された行を Subject で返す。 */
export async function insertSubject(
  input: NewSubjectInput,
  ownerId: string,
): Promise<Subject> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      owner_id: ownerId,
      name: input.name,
      teacher_name: input.teacherName,
      avatar_letter: input.avatarLetter,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToSubject(data as SubjectRow);
}

/** 論理削除 (deleted_at = now())。紐づく教材は別途扱う。 */
export async function softDeleteSubject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("subjects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
