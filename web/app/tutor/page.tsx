/**
 * /tutor — 担任「ゆい」さんとの chat（ログイン後の最初）。
 *
 * Phase 2 mock。ログイン → このページに着地 → 担任との会話 →
 * リッチカード（教科 / 教材 / 体系図プレビュー / 開始）→ 学習画面 という流れ。
 *
 * Phase 3 で Claude API + 履歴 / 課題 / スケジュールのコンテキスト注入を追加予定。
 */
import { TutorClient } from "./TutorClient";
import { MOCK_TREE } from "@/lib/learn/mock-data";

export const metadata = {
  title: "ゆい先生（担任）",
};

export default function TutorPage() {
  return <TutorClient nodes={MOCK_TREE} />;
}
