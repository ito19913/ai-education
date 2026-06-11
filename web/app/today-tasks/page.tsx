/**
 * /today-tasks — 旧「今日のタスク」ダッシュボード (C22 で /schedule からリネーム)。
 *
 * ★2026-06-11 廃止★:
 * 今日のタスクは新ダッシュボード (/tutor トップの DashboardPane、プラン先頭 +
 * 「きょう決めたこと」の 2 層) に集約された。mock データ専用の旧画面は役目を
 * 終えたため /tutor (司令室) へリダイレクトする。/learn と同じ扱い。
 */
import { redirect } from "next/navigation";

export default function TodayTasksPage() {
  redirect("/tutor");
}
