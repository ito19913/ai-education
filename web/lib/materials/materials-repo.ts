/**
 * materials リポジトリ (段階1-B、2026-06-05、client 用)
 *
 * Supabase の materials テーブルへの薄い CRUD。RLS が効くので browser client から
 * 直接呼んでよい (本人は自分の行、admin は全行)。DB 行 (snake_case) ⇔ Material 型
 * (camelCase) の変換も担う。
 *
 * - fetchMaterials        … 起動時に deleted_at is null の教材一覧を取得
 * - insertMaterial        … 登録 (id は DB 採番)、生成行を Material で返す
 * - updateMaterialPdfPath … PDF 裏アップロード完了時にパス/サイズを書く
 * - softDeleteMaterial    … 論理削除 (deleted_at = now())
 * - updateMaterialMeta    … 教材編集 (メタ patch)
 * - getCurrentUserId      … owner_id 供給用 (ログイン中ユーザー)
 */
import { createClient } from "@/lib/supabase/client";
import type {
  AiExtractedNode,
  ConceptSegment,
  Material,
  MaterialLabel,
} from "@/lib/learn/types";

/** materials テーブルの 1 行 (DB 形、snake_case)。 */
type MaterialRow = {
  id: string;
  owner_id: string;
  subject_id: string;
  name: string;
  label: string;
  grade_level: string | null;
  covered_node_ids: string[] | null;
  extracted_nodes: AiExtractedNode[] | null;
  concept_segments: ConceptSegment[] | null;
  pdf_path: string | null;
  pdf_size: number | null;
  deleted_at: string | null;
};

/** DB 行 → アプリの Material 型へ変換。 */
function rowToMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    label: row.label as MaterialLabel,
    gradeLevel: row.grade_level ?? undefined,
    coveredNodeIds: row.covered_node_ids ?? [],
    extractedNodes: row.extracted_nodes ?? undefined,
    conceptSegments:
      row.concept_segments && row.concept_segments.length > 0
        ? row.concept_segments
        : undefined,
    pdfPath: row.pdf_path ?? undefined,
    pdfSize: row.pdf_size ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

/** ログイン中ユーザーの id (owner_id 供給用)。未ログインなら例外。 */
export async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("未ログインのため教材を保存できません");
  }
  return user.id;
}

/** アクティブな (deleted_at is null) 教材一覧を取得。RLS で本人/admin 分のみ。 */
export async function fetchMaterials(): Promise<Material[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as MaterialRow[]).map(rowToMaterial);
}

/** 登録に必要な Material のフィールド (id/pdf 系は DB / 後続で埋める)。 */
export type NewMaterialInput = {
  subjectId: string;
  name: string;
  label: MaterialLabel;
  gradeLevel?: string;
  coveredNodeIds: string[];
  extractedNodes?: AiExtractedNode[];
};

/** 教材行を作成 (id は DB 採番)。生成された行を Material で返す。 */
export async function insertMaterial(
  input: NewMaterialInput,
  ownerId: string,
): Promise<Material> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({
      owner_id: ownerId,
      subject_id: input.subjectId,
      name: input.name,
      label: input.label,
      grade_level: input.gradeLevel ?? null,
      covered_node_ids: input.coveredNodeIds,
      extracted_nodes: input.extractedNodes ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMaterial(data as MaterialRow);
}

/** PDF 裏アップロード完了時にパス/サイズを記録。 */
export async function updateMaterialPdfPath(
  id: string,
  pdfPath: string,
  pdfSize: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ pdf_path: pdfPath, pdf_size: pdfSize })
    .eq("id", id);
  if (error) throw error;
}

/** まとまり区切り (ConceptSegment[]) を保存 (登録時バックグラウンド生成の完了時、M4)。 */
export async function updateMaterialSegments(
  id: string,
  segments: ConceptSegment[],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ concept_segments: segments })
    .eq("id", id);
  if (error) throw error;
}

/** 論理削除 (deleted_at = now())。PDF 実体の削除は呼び出し側で別途行う。 */
export async function softDeleteMaterial(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** 教材メタの部分更新 (編集ダイアログ用)。 */
export async function updateMaterialMeta(
  id: string,
  patch: Partial<Pick<Material, "name" | "subjectId" | "label" | "gradeLevel">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subjectId !== undefined) row.subject_id = patch.subjectId;
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.gradeLevel !== undefined) row.grade_level = patch.gradeLevel;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("materials").update(row).eq("id", id);
  if (error) throw error;
}
