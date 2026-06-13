/**
 * segmentation-jobs リポジトリ (client 用、2026-06-13、まとまり生成ジョブ化)
 *
 * ブラウザは「ジョブ行を 1 つ積む」だけ (瞬時)。実際の生成は Cron ワーカーが行う。
 * RLS の insert ポリシーで本人/admin のみ自分のジョブを積める。claim/処理/完了は
 * service-role ワーカー専用 (このリポジトリからは触らない)。
 */
import { createClient } from "@/lib/supabase/client";

/**
 * まとまり生成ジョブを enqueue する。同教材で走行中ジョブがあれば
 * 走行中ユニーク部分インデックス違反になるので「既にキュー済み」として握り潰す
 * (= 重複キューしない)。
 */
export async function enqueueSegmentationJob(
  materialId: string,
  ownerId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("segmentation_jobs")
    .insert({ material_id: materialId, owner_id: ownerId });
  if (error) {
    // 23505 = unique_violation (走行中ジョブが既にある) は正常系として無視。
    if (error.code === "23505") return;
    throw error;
  }
}
