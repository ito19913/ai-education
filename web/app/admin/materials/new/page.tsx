/**
 * /admin/materials/new — 新規教材登録ウィザード。
 * MVP モック: AI 処理は固定 mock データ、保存は state のみ。
 */
import { MaterialEditWizard } from "@/components/admin/MaterialEditWizard";
import { MOCK_SUBJECTS, MOCK_TREE } from "@/lib/learn/mock-data";

type Props = {
  searchParams: Promise<{ subjectId?: string }>;
};

export default async function NewMaterialPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialSubjectId =
    params.subjectId && MOCK_SUBJECTS.some((s) => s.id === params.subjectId)
      ? params.subjectId
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      <MaterialEditWizard
        subjects={MOCK_SUBJECTS}
        existingNodes={MOCK_TREE}
        initialSubjectId={initialSubjectId}
      />
    </div>
  );
}
