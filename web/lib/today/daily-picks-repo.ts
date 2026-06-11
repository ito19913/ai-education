/**
 * daily_picks リポジトリ (「その日決める枠」Phase B、2026-06-11、client 用)
 *
 * pick = 「おかえり、今日なにやる?」儀式で子が選んだ 1 件
 * (宿題・テスト = segmentId なし / プラン外の本のまとまり = segmentId あり)。
 *
 * 完了フラグは持たない (B-4、プランと同じ「導出」規律):
 *   宿題 → materials.assignmentStatus === "done"
 *   まとまり → そのまとまりのレジュメ (note_entries) が understood
 * completedAt は「完了を観測した時刻」のキャッシュ。✓ を完了当日だけ見せて
 * 翌日消すための表示用で、真実の情報源はあくまで宿題 status / レジュメ。
 *
 * 持ち越し (B-5): 完了するか、子が「やめとく」(removed_at) で外すまで残る。
 * fetch 時に「昨日以前に完了した pick」へ removed_at を入れて自動掃除する。
 */
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import type { DailyPick } from "@/lib/learn/types";

export { getCurrentUserId };

/** daily_picks テーブルの 1 行 (DB 形、snake_case)。 */
type DailyPickRow = {
  id: string;
  owner_id: string;
  material_id: string;
  segment_id: string | null;
  completed_at: string | null;
  removed_at: string | null;
  created_at: string;
};

function rowToPick(row: DailyPickRow): DailyPick {
  return {
    id: row.id,
    materialId: row.material_id,
    segmentId: row.segment_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** 今日の 0:00 (local) の ISO。 */
function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * アクティブな pick 一覧。
 * 「昨日以前に完了した pick」はここで removed_at を入れて自動掃除する
 * (完了当日は ✓ で残し、翌日から消える = B-5)。
 */
export async function fetchDailyPicks(): Promise<DailyPick[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_picks")
    .select("*")
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data as DailyPickRow[];

  const start = todayStartIso();
  const stale = rows.filter(
    (r) => r.completed_at !== null && r.completed_at < start,
  );
  if (stale.length > 0) {
    // 掃除は表示をブロックしない (失敗しても次回 fetch で再試行される)
    void supabase
      .from("daily_picks")
      .update({ removed_at: new Date().toISOString() })
      .in(
        "id",
        stale.map((r) => r.id),
      )
      .then(({ error: err }) => {
        if (err) console.error("[今日の枠] 完了済み pick の掃除失敗:", err);
      });
  }
  return rows
    .filter((r) => !(r.completed_at !== null && r.completed_at < start))
    .map(rowToPick);
}

/** pick を追加 (儀式で選んだ)。 */
export async function insertDailyPick(
  materialId: string,
  segmentId: string | undefined,
  ownerId: string,
): Promise<DailyPick> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_picks")
    .insert({
      owner_id: ownerId,
      material_id: materialId,
      segment_id: segmentId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToPick(data as DailyPickRow);
}

/** pick を外す (「やめとく」、論理削除)。 */
export async function removeDailyPick(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_picks")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** 完了を観測した時刻を記録 (✓ 表示 → 翌日消えるための表示用キャッシュ)。 */
export async function markDailyPickCompleted(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_picks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** 完了観測を取り消す (宿題の「やった」を「まだ」に戻した時)。 */
export async function clearDailyPickCompleted(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_picks")
    .update({ completed_at: null })
    .eq("id", id);
  if (error) throw error;
}
