/**
 * /issues — 課題一覧（イシュードリブン思考の本丸）。
 *
 * 本人発（旧メモ）と AI 発（会話の中で AI が「理解に達してない」と検知）
 * を 1 つのリストで管理。本人手動 + AI 提案 でクリアまで監視する。
 *
 * MVP は mock データ。後で Supabase に置き換え。
 */
import { IssuesClient } from "./IssuesClient";
import { MOCK_ISSUES, MOCK_TREE } from "@/lib/learn/mock-data";

export const metadata = {
  title: "課題一覧",
};

export default function IssuesPage() {
  return <IssuesClient initialIssues={MOCK_ISSUES} nodes={MOCK_TREE} />;
}
