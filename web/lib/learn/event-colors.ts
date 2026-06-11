/**
 * 予定ラベルの色パレット (2026-06-09)。
 *
 * EventLabelColor → Tailwind 静的クラス文字列のマップ。Tailwind の JIT が拾えるよう、
 * クラス名はここに「リテラルで」全色ぶん書き出しておく (動的生成しない)。
 *
 * - dot    … リスト/カレンダーの小さな色ドット (bg)
 * - badge  … ラベルのソフトな pill (border + bg + text、ダーク対応)
 * - swatch … パレット選択 UI のスウォッチ (bg)
 */
import type { EventLabelColor } from "./types";

/** 選択 UI に出す色の並び (固定パレット)。 */
export const EVENT_LABEL_PALETTE: EventLabelColor[] = [
  "blue",
  "violet",
  "orange",
  "green",
  "pink",
  "amber",
  "sky",
  "rose",
  "teal",
  "slate",
];

type ColorClasses = { dot: string; badge: string; swatch: string };

export const EVENT_LABEL_COLOR_CLASSES: Record<EventLabelColor, ColorClasses> = {
  blue: {
    dot: "bg-blue-500",
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    swatch: "bg-blue-500",
  },
  violet: {
    dot: "bg-violet-500",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300",
    swatch: "bg-violet-500",
  },
  orange: {
    dot: "bg-orange-500",
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
    swatch: "bg-orange-500",
  },
  green: {
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    swatch: "bg-emerald-500",
  },
  pink: {
    dot: "bg-pink-500",
    badge:
      "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900/60 dark:bg-pink-950/40 dark:text-pink-300",
    swatch: "bg-pink-500",
  },
  amber: {
    dot: "bg-amber-500",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    swatch: "bg-amber-500",
  },
  sky: {
    dot: "bg-sky-500",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
    swatch: "bg-sky-500",
  },
  rose: {
    dot: "bg-rose-500",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    swatch: "bg-rose-500",
  },
  teal: {
    dot: "bg-teal-500",
    badge:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300",
    swatch: "bg-teal-500",
  },
  slate: {
    dot: "bg-slate-500",
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-300",
    swatch: "bg-slate-500",
  },
};

/** 不明な色のフォールバック (slate)。 */
export function colorClasses(color: EventLabelColor | string): ColorClasses {
  return (
    EVENT_LABEL_COLOR_CLASSES[color as EventLabelColor] ??
    EVENT_LABEL_COLOR_CLASSES.slate
  );
}

/** デフォルトラベルのシード定義 (kind と既定色)。ensureDefaultEventLabels で使う。 */
export const DEFAULT_EVENT_LABELS: ReadonlyArray<{
  name: string;
  color: EventLabelColor;
  kind: "study" | "exam" | "normal";
}> = [
  { name: "勉強", color: "blue", kind: "study" },
  { name: "試験", color: "violet", kind: "exam" },
  { name: "締切・提出", color: "orange", kind: "normal" },
  { name: "遊び・予定", color: "green", kind: "normal" },
  { name: "習い事", color: "pink", kind: "normal" },
];
