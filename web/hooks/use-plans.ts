"use client";

/**
 * usePlans — 新プラン (ザックリ・まとまりキュー型) ドメインフック
 * (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から新プラン (2026-06-10 grill 確定) を抽出したもの。
 * 挙動は移設前と同一:
 * - real は DB から復元。mock は in-memory (リロードで消える)
 * - 済みはレジュメ understood から導出 (プラン側に完了フラグを持たない)
 * - 失敗/mock は in-memory フォールバック (動線止めない)
 */

import { useCallback, useEffect, useState } from "react";
import type { Material, StudyPlan } from "@/lib/learn/types";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import {
  fetchPlans,
  insertPlan,
  updatePlanEndsAt,
  updatePlanStatus,
  updatePlanSkips,
  softDeletePlan,
} from "@/lib/plans/plans-repo";

export function usePlans(materials: Material[]) {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(!isSupabaseConfigured());
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchPlans()
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch((err) => console.error("[プラン] 一覧取得失敗:", err))
      .finally(() => {
        if (!cancelled) setPlansLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 「プランに組み込む」。countFrom 指定は 2 周目 (最初からやり直す) 用。 */
  const handleCreatePlan = useCallback(
    async (material: Material, endsAt: string, countFrom?: string) => {
      const input = {
        subjectId: material.subjectId,
        materialId: material.id,
        endsAt,
        countFrom,
      };
      if (isSupabaseConfigured()) {
        try {
          const ownerId = await getCurrentUserId();
          const created = await insertPlan(input, ownerId);
          setPlans((prev) => [...prev, created]);
          return;
        } catch (err) {
          console.error("[プラン] 作成失敗、in-memory にフォールバック:", err);
        }
      }
      setPlans((prev) => [
        ...prev,
        {
          id: `plan-local-${Date.now()}`,
          subjectId: material.subjectId,
          materialId: material.id,
          endsAt,
          status: "active",
          skippedSegmentIds: [],
          countFrom,
        },
      ]);
    },
    [],
  );

  const handleExtendPlan = useCallback((id: string, endsAt: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, endsAt } : p)));
    if (isSupabaseConfigured()) {
      void updatePlanEndsAt(id, endsAt).catch((err) =>
        console.error("[プラン] 延長失敗:", err),
      );
    }
  }, []);

  const handleCompletePlan = useCallback((id: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "completed" } : p)),
    );
    if (isSupabaseConfigured()) {
      void updatePlanStatus(id, "completed").catch((err) =>
        console.error("[プラン] 終了失敗:", err),
      );
    }
  }, []);

  /** 最初からやり直す (2周目): 旧プランを completed にし、countFrom=now の新プランを作る。 */
  const handleRestartPlan = useCallback(
    (plan: StudyPlan, endsAt: string) => {
      handleCompletePlan(plan.id);
      const material = materials.find((m) => m.id === plan.materialId);
      if (material) {
        void handleCreatePlan(material, endsAt, new Date().toISOString());
      }
    },
    [handleCompletePlan, handleCreatePlan, materials],
  );

  const handleTogglePlanSkip = useCallback(
    (planId: string, segmentId: string) => {
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          const has = p.skippedSegmentIds.includes(segmentId);
          const next = has
            ? p.skippedSegmentIds.filter((s) => s !== segmentId)
            : [...p.skippedSegmentIds, segmentId];
          if (isSupabaseConfigured()) {
            void updatePlanSkips(planId, next).catch((err) =>
              console.error("[プラン] スキップ更新失敗:", err),
            );
          }
          return { ...p, skippedSegmentIds: next };
        }),
      );
    },
    [],
  );

  const handleDeletePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured()) {
      void softDeletePlan(id).catch((err) =>
        console.error("[プラン] 削除失敗:", err),
      );
    }
  }, []);

  /**
   * 教材削除時の連鎖掃除 (2026-06-12 レビュー指摘): 教材は論理削除なので DB の
   * on delete cascade は永久に発火しない。掃除しないと、この教材のプランが
   * 「教材なしのゾンビカード」として残る。プランは論理削除で外す。
   * 戻り値 = 掃除したプラン数 (削除時のゆい発話の文言に使う)。
   */
  const removePlansForMaterial = useCallback(
    (materialId: string): number => {
      const orphanPlans = plans.filter(
        (p) => p.materialId === materialId && !p.deletedAt,
      );
      if (orphanPlans.length === 0) return 0;
      setPlans((prev) => prev.filter((p) => p.materialId !== materialId));
      if (isSupabaseConfigured()) {
        for (const p of orphanPlans) {
          if (p.id.startsWith("plan-local-")) continue;
          void softDeletePlan(p.id).catch((err) =>
            console.error("[教材] 関連プランの削除失敗:", err),
          );
        }
      }
      return orphanPlans.length;
    },
    [plans],
  );

  return {
    plans,
    plansLoaded,
    handleCreatePlan,
    handleExtendPlan,
    handleCompletePlan,
    handleRestartPlan,
    handleTogglePlanSkip,
    handleDeletePlan,
    removePlansForMaterial,
  };
}
