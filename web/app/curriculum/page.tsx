import type { Metadata } from "next";
import { CurriculumMatrixView } from "@/components/curriculum/CurriculumMatrixView";

export const metadata: Metadata = {
  title: "カリキュラム - AI-Education",
  description: "英語の中1〜高3 体系図 (仮、C66 2026-05-28)",
};

/**
 * /curriculum?subject=english
 *
 * カリキュラム DB 仮実装 (C66、2026-05-28)。
 * 英語の中1〜高3 体系図を 6 分野 × 6 学年マトリックスで全体俯瞰表示。
 * AI つまずき認定 (黄) / 戻り誘導候補 (赤) で色分け可視化。
 *
 * 設計詳細: ARCHITECTURE「## カリキュラム DB 仮実装 (2026-05-28)」セクション参照。
 */
export default function CurriculumPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <CurriculumMatrixView />
    </main>
  );
}
