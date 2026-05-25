/**
 * Plan Type × Learning Mode の配分マトリクス (Phase 5 P5-Q5 確定)。
 *
 * Plan Engine が GT 生成時にこのテーブルを参照して、PlanType ごとに
 * どの Mode をどの程度入れるかを決める。
 *
 * - "primary":   主に使うモード (Plan Engine の GT 数を多めに割く)
 * - "secondary": 補助で使うモード (少なめに割く)
 * - "none":      使わないモード (生成しない)
 *
 * 数値配分 (パーセンテージ) は本実装で `getModeWeights()` ヘルパーで
 * 計算するが、ここでは「使う / 使わない」の意図のみテーブル化する。
 * 後日の調整は本ファイルだけで完結する設計。
 *
 * grill 確定時の推奨マトリクス (ARCHITECTURE.md「Phase 5 P5-Q5」参照):
 *
 *                | input | output | review | drill | test
 *  regular-study |  ✓    |  ✓    |  ◯    |  ◯   |  ◯
 *  exam-prep     |  ◯    |  ✓    |  ✓    |  ✓   |  ✓
 *  weakness-grind|       |  ✓    |  ✓    |  ✓   |  ◯
 *  review        |       |  ◯    |  ✓    |  ◯   |  ◯
 *  long-term-mem |       |       |  ✓    |  ✓   |  ◯
 *
 * (✓ = primary, ◯ = secondary, 空欄 = none)
 */

import type { LearningMode, PlanType } from "./types";

/** 1 つの Mode に対する配分強度 */
export type ModeWeight = "primary" | "secondary" | "none";

/**
 * Plan Type × Learning Mode の配分定数。
 *
 * Plan Engine の GT 生成ロジックはこのテーブルを見て、
 * primary モードを多め (例: 50%)、secondary を少なめ (例: 25%)、
 * none を 0% で割り振る。
 */
export const PLAN_MODE_DISTRIBUTION: Record<
  PlanType,
  Record<LearningMode, ModeWeight>
> = {
  "regular-study": {
    input: "primary",
    output: "primary",
    review: "secondary",
    drill: "secondary",
    test: "secondary",
  },
  "exam-prep": {
    input: "secondary",
    output: "primary",
    review: "primary",
    drill: "primary",
    test: "primary",
  },
  "weakness-grind": {
    input: "none",
    output: "primary",
    review: "primary",
    drill: "primary",
    test: "secondary",
  },
  review: {
    input: "none",
    output: "secondary",
    review: "primary",
    drill: "secondary",
    test: "secondary",
  },
  "long-term-memory": {
    input: "none",
    output: "none",
    review: "primary",
    drill: "primary",
    test: "secondary",
  },
};

/**
 * Plan Engine が GT 生成時に参照する数値の重み変換。
 * primary = 2, secondary = 1, none = 0 で集計、正規化して割合に。
 *
 * 例: regular-study の primary 2 + primary 2 + secondary 1 + secondary 1 + secondary 1 = 7
 *     input: 2/7 ≈ 29%, output: 2/7 ≈ 29%, review: 1/7 ≈ 14%, drill: 1/7, test: 1/7
 */
export function getModeWeights(planType: PlanType): Record<LearningMode, number> {
  const distribution = PLAN_MODE_DISTRIBUTION[planType];
  const rawScore = (weight: ModeWeight): number =>
    weight === "primary" ? 2 : weight === "secondary" ? 1 : 0;

  const scores: Record<LearningMode, number> = {
    input: rawScore(distribution.input),
    output: rawScore(distribution.output),
    review: rawScore(distribution.review),
    drill: rawScore(distribution.drill),
    test: rawScore(distribution.test),
  };

  const total = scores.input + scores.output + scores.review + scores.drill + scores.test;
  if (total === 0) {
    // 防衛: マトリクス全 none の異常系。実用上は起きないが 0 除算回避。
    return { input: 0, output: 0, review: 0, drill: 0, test: 0 };
  }

  return {
    input: scores.input / total,
    output: scores.output / total,
    review: scores.review / total,
    drill: scores.drill / total,
    test: scores.test / total,
  };
}

/**
 * PlanType の人間向け表示ラベル + 説明。
 * 立案 UI の「もっと ▼ → 他の計画タイプ」サブメニュー / Plan Engine ダッシュボードで使用。
 */
export const PLAN_TYPE_LABELS: Record<
  PlanType,
  { label: string; description: string }
> = {
  "regular-study": {
    label: "日常学習",
    description: "教科書をコツコツ回す通常の学習計画 (デフォルト)",
  },
  "exam-prep": {
    label: "試験対策",
    description: "定期テスト・期末試験など期限がある短期集中計画",
  },
  "weakness-grind": {
    label: "苦手克服",
    description: "弱いところに集中して output / drill で潰す計画",
  },
  review: {
    label: "復習",
    description: "過去に習った内容を再構築する計画",
  },
  "long-term-memory": {
    label: "長期記憶化",
    description: "間隔反復で定着させる計画 (試験後の知識保持)",
  },
};
