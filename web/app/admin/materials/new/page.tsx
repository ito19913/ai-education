/**
 * /admin/materials/new — 新規教材登録ウィザード。
 * MVP モック: AI 処理は固定 mock データ、保存は state のみ。
 */
import { MaterialEditWizard } from "@/components/admin/MaterialEditWizard";
import { MOCK_SUBJECTS, MOCK_TREE } from "@/lib/learn/mock-data";

export default function NewMaterialPage() {
  return (
    <div className="min-h-screen bg-background">
      <MaterialEditWizard subjects={MOCK_SUBJECTS} existingNodes={MOCK_TREE} />
    </div>
  );
}
