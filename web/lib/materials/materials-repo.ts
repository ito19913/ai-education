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
  AssignmentStatus,
  AssignmentType,
  ConceptSegment,
  GuidedBlock,
  Material,
  MaterialKind,
  MaterialLabel,
} from "@/lib/learn/types";

/** materials テーブルの 1 行 (DB 形、snake_case)。 */
type MaterialRow = {
  id: string;
  owner_id: string;
  subject_id: string;
  name: string;
  label: string;
  publisher: string | null;
  author: string | null;
  cover_thumb: string | null;
  grade_level: string | null;
  covered_node_ids: string[] | null;
  extracted_nodes: AiExtractedNode[] | null;
  concept_segments: ConceptSegment[] | null;
  guided_plans: Record<string, GuidedBlock[]> | null;
  pdf_path: string | null;
  pdf_size: number | null;
  kind: string | null;
  assignment_type: string | null;
  due_date: string | null;
  assignment_status: string | null;
  segment_status: string | null;
  deleted_at: string | null;
};

/** DB 行 → アプリの Material 型へ変換。 */
function rowToMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    label: row.label as MaterialLabel,
    publisher: row.publisher ?? undefined,
    author: row.author ?? undefined,
    coverThumb: row.cover_thumb ?? undefined,
    gradeLevel: row.grade_level ?? undefined,
    kind: (row.kind === "assignment" ? "assignment" : "book") as MaterialKind,
    assignmentType: (row.assignment_type ?? undefined) as
      | AssignmentType
      | undefined,
    dueDate: row.due_date ?? undefined,
    assignmentStatus: (row.assignment_status ?? undefined) as
      | AssignmentStatus
      | undefined,
    coveredNodeIds: row.covered_node_ids ?? [],
    extractedNodes: row.extracted_nodes ?? undefined,
    conceptSegments:
      row.concept_segments && row.concept_segments.length > 0
        ? row.concept_segments
        : undefined,
    guidedPlans:
      row.guided_plans && Object.keys(row.guided_plans).length > 0
        ? row.guided_plans
        : undefined,
    pdfPath: row.pdf_path ?? undefined,
    pdfSize: row.pdf_size ?? undefined,
    segmentStatus: (row.segment_status ?? undefined) as
      | Material["segmentStatus"]
      | undefined,
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
  publisher?: string;
  author?: string;
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
      publisher: input.publisher?.trim() ? input.publisher.trim() : null,
      author: input.author?.trim() ? input.author.trim() : null,
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

/** まとまり生成のサーバー側ジョブ状態を更新 (enqueue / 区切り直す時、2026-06-13)。 */
export async function updateMaterialSegmentStatus(
  id: string,
  status: NonNullable<Material["segmentStatus"]>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ segment_status: status })
    .eq("id", id);
  if (error) throw error;
}

/**
 * ガイド読書のブロックプラン {segmentId: GuidedBlock[]} を保存 (G-A 永続化、2026-06-07)。
 * プラン生成完了時と、子が青枠 bbox を手で動かした時 (pointerUp) に呼ぶ。
 * 全体を上書きするので、呼び出し側は現在の全プランを渡す。
 */
export async function updateMaterialGuidedPlans(
  id: string,
  guidedPlans: Record<string, GuidedBlock[]>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ guided_plans: guidedPlans })
    .eq("id", id);
  if (error) throw error;
}

/** 表紙サムネ (data URL) を保存 (PDF を読んだ時に 1 回、2026-06-08)。 */
export async function updateMaterialCoverThumb(
  id: string,
  coverThumb: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ cover_thumb: coverThumb })
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
  patch: Partial<
    Pick<
      Material,
      "name" | "subjectId" | "label" | "publisher" | "author" | "gradeLevel"
    >
  >,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subjectId !== undefined) row.subject_id = patch.subjectId;
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.publisher !== undefined)
    row.publisher = patch.publisher?.trim() ? patch.publisher.trim() : null;
  if (patch.author !== undefined)
    row.author = patch.author?.trim() ? patch.author.trim() : null;
  if (patch.gradeLevel !== undefined) row.grade_level = patch.gradeLevel;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("materials").update(row).eq("id", id);
  if (error) throw error;
}

// ============================================================================
// 宿題・テスト (kind="assignment"、2026-06-09)。本と同じ materials テーブルに、
// 重い処理 (PDF/まとまり/体系図) なしの軽い行として入れる。
// ============================================================================

export type NewAssignmentInput = {
  subjectId: string;
  name: string;
  assignmentType: AssignmentType;
  /** 提出日 / テスト日 (YYYY-MM-DD、任意) */
  dueDate?: string;
};

/**
 * 宿題・テストを登録 (kind="assignment")。label は NOT NULL なので表示に使わない
 * プレースホルダ ("テキスト") を入れる。状態は todo (=まだ) で開始。
 */
export async function insertAssignment(
  input: NewAssignmentInput,
  ownerId: string,
): Promise<Material> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({
      owner_id: ownerId,
      subject_id: input.subjectId,
      name: input.name,
      // assignment では未使用だが label は NOT NULL のためプレースホルダ。
      label: "テキスト",
      covered_node_ids: [],
      extracted_nodes: [],
      kind: "assignment",
      assignment_type: input.assignmentType,
      due_date: input.dueDate ?? null,
      assignment_status: "todo",
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMaterial(data as MaterialRow);
}

/** 宿題・テストの状態を更新 (まだ ⇔ やった)。 */
export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("materials")
    .update({ assignment_status: status })
    .eq("id", id);
  if (error) throw error;
}

/** 宿題・テストのメタ編集 (名前 / 種類 / 科目 / 提出日)。 */
export async function updateAssignment(
  id: string,
  patch: Partial<NewAssignmentInput>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subjectId !== undefined) row.subject_id = patch.subjectId;
  if (patch.assignmentType !== undefined)
    row.assignment_type = patch.assignmentType;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("materials").update(row).eq("id", id);
  if (error) throw error;
}
