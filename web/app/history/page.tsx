/**
 * /history — 学習履歴の一覧。
 * MVP モックでは mock セッションを表示。後で Supabase クエリに置き換え。
 */
import { HistoryView } from "@/components/history/HistoryView";
import {
  MOCK_SESSIONS,
  MOCK_SUBJECTS,
  MOCK_TREE,
} from "@/lib/learn/mock-data";

export const metadata = {
  title: "学習履歴",
};

export default function HistoryPage() {
  return (
    <HistoryView
      sessions={MOCK_SESSIONS}
      nodes={MOCK_TREE}
      subjects={MOCK_SUBJECTS}
    />
  );
}
