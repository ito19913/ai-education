"use client";

/**
 * useDailyPicks — 「その日決める枠」(きょう決めたこと) ドメインフック
 * (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から Phase B (2026-06-11 grill B-1〜B-8) の daily picks を
 * 抽出したもの。挙動は移設前と同一:
 * - real は DB から (完了→翌日の自動掃除も fetch 内)。mock は in-memory
 * - 完了フラグは導出が真実、completedAt は「✓ を完了当日だけ見せる」ための観測キャッシュ
 * - 失敗/mock は in-memory フォールバック (動線止めない)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyPick } from "@/lib/learn/types";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import {
  fetchDailyPicks,
  insertDailyPick,
  removeDailyPick,
  markDailyPickCompleted,
  clearDailyPickCompleted,
} from "@/lib/today/daily-picks-repo";

export function useDailyPicks() {
  const [dayPicks, setDayPicks] = useState<DailyPick[]>([]);
  const [dayPicksLoaded, setDayPicksLoaded] = useState(!isSupabaseConfigured());
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchDailyPicks()
      .then((rows) => {
        if (!cancelled) setDayPicks(rows);
      })
      .catch((err) => console.error("[今日の枠] 一覧取得失敗:", err))
      .finally(() => {
        if (!cancelled) setDayPicksLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // pick の完了観測 (B-4/B-5): 完了フラグは導出が真実だが、「✓ を完了当日だけ見せて
  // 翌日消す」ために観測時刻 (completedAt) をキャッシュする。learning_logs と同じく
  // 実アクション (宿題トグル / レジュメ understood) へのフックで記録する。
  const observeDayPickDone = useCallback(
    (materialId: string, segmentId?: string) => {
      const target = dayPicks.find(
        (p) =>
          p.materialId === materialId &&
          (p.segmentId ?? undefined) === (segmentId ?? undefined) &&
          !p.completedAt,
      );
      if (!target) return;
      setDayPicks((prev) =>
        prev.map((p) =>
          p.id === target.id
            ? { ...p, completedAt: new Date().toISOString() }
            : p,
        ),
      );
      if (isSupabaseConfigured() && !target.id.startsWith("pick-local-")) {
        void markDailyPickCompleted(target.id).catch((err) =>
          console.error("[今日の枠] 完了記録失敗:", err),
        );
      }
    },
    [dayPicks],
  );

  // 宿題の「やった」を「まだ」に戻した時の取り消し (翌日に消えてしまわないように)
  const observeDayPickUndone = useCallback(
    (materialId: string) => {
      const target = dayPicks.find(
        (p) => p.materialId === materialId && !p.segmentId && p.completedAt,
      );
      if (!target) return;
      setDayPicks((prev) =>
        prev.map((p) =>
          p.id === target.id ? { ...p, completedAt: undefined } : p,
        ),
      );
      if (isSupabaseConfigured() && !target.id.startsWith("pick-local-")) {
        void clearDailyPickCompleted(target.id).catch((err) =>
          console.error("[今日の枠] 完了取消失敗:", err),
        );
      }
    },
    [dayPicks],
  );

  // 既に今日の枠に入っている対象のキー (宿題 = materialId、まとまり = mat:seg)
  const dayPickedKeys = useMemo(
    () =>
      new Set(
        dayPicks.map((p) =>
          p.segmentId ? `${p.materialId}:${p.segmentId}` : p.materialId,
        ),
      ),
    [dayPicks],
  );

  /** pick を追加 (real は DB、失敗/mock は in-memory)。 */
  const addDayPick = useCallback(
    async (materialId: string, segmentId?: string) => {
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertDailyPick(materialId, segmentId, ownerId);
          setDayPicks((prev) => [...prev, created]);
          return;
        } catch (err) {
          console.error("[今日の枠] 追加失敗、in-memory にフォールバック:", err);
        }
      }
      setDayPicks((prev) => [
        ...prev,
        {
          id: `pick-local-${Date.now()}`,
          materialId,
          segmentId,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [],
  );

  /** pick を外す (「やめとく」、B-5)。 */
  const handleRemoveDayPick = useCallback((id: string) => {
    setDayPicks((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured() && !id.startsWith("pick-local-")) {
      void removeDailyPick(id).catch((err) =>
        console.error("[今日の枠] 削除失敗:", err),
      );
    }
  }, []);

  /**
   * 教材削除時の連鎖掃除 (Phase 1、2026-06-12): 論理削除なので FK cascade は発火しない。
   * この教材の pick を「やめとく」と同じ扱いで外す (DB に永久残留させない)。
   */
  const removePicksForMaterial = useCallback(
    (materialId: string) => {
      const orphanPicks = dayPicks.filter((p) => p.materialId === materialId);
      if (orphanPicks.length === 0) return;
      setDayPicks((prev) => prev.filter((p) => p.materialId !== materialId));
      if (isSupabaseConfigured()) {
        for (const p of orphanPicks) {
          if (p.id.startsWith("pick-local-")) continue;
          void removeDailyPick(p.id).catch((err) =>
            console.error("[教材] 関連 pick の削除失敗:", err),
          );
        }
      }
    },
    [dayPicks],
  );

  return {
    dayPicks,
    dayPicksLoaded,
    dayPickedKeys,
    addDayPick,
    handleRemoveDayPick,
    observeDayPickDone,
    observeDayPickUndone,
    removePicksForMaterial,
  };
}
