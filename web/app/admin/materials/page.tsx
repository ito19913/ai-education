/**
 * /admin/materials — 教材の一覧 + 新規追加導線。
 * MVP は mock データから読む。後で Supabase クエリに置き換え。
 */
import { MaterialListView } from "@/components/admin/MaterialListView";
import { MOCK_MATERIALS, MOCK_SUBJECTS } from "@/lib/learn/mock-data";

export default function AdminMaterialsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MaterialListView subjects={MOCK_SUBJECTS} materials={MOCK_MATERIALS} />
    </div>
  );
}
