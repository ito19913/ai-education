"use client";

/**
 * TutorTopic の表示用ヘルパー（絵文字 + 色 + チップコンポーネント）。
 *
 * セクションヘッダー（TutorMessageBubble）と
 * アーカイブの話題フィルター（TutorArchiveView）で共用する。
 *
 * デザイン方針（ito19 さん要望 2026-05-24）:
 *   中2 女子向けらしい可愛さ。ライン icon ではなく emoji ベース + パステル色。
 */
import type { TutorTopic } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

export function topicEmoji(topic: TutorTopic): string {
  switch (topic) {
    case "morning-reflection":
      return "🌅";
    case "excavation":
      return "💭";
    case "issue-check":
      return "🎯";
    case "schedule-check":
      return "📅";
    case "history-check":
      return "📖";
    case "reflection-check":
      return "📔";
    case "material-add":
      return "📚";
    case "subject-history":
      return "✏️";
    case "start-study":
      return "✨";
    case "ending":
      return "🌙";
    case "free-chat":
      return "💬";
  }
}

export function topicLabel(topic: TutorTopic): string {
  switch (topic) {
    case "morning-reflection":
      return "朝の振り返り";
    case "excavation":
      return "掘り起こし";
    case "issue-check":
      return "課題を確認";
    case "schedule-check":
      return "スケジュール確認";
    case "history-check":
      return "学習履歴を確認";
    case "reflection-check":
      return "振り返りログ";
    case "material-add":
      return "教材を追加";
    case "subject-history":
      return "先生の対話履歴";
    case "start-study":
      return "学習を開始";
    case "ending":
      return "学習を終了";
    case "free-chat":
      return "おしゃべり";
  }
}

/** topic ごとのパステルカラー（active / 通常 / 静的 で同系統を使う） */
type Tone = {
  /** chip background */
  bg: string;
  /** chip text */
  text: string;
  /** chip border */
  border: string;
  /** active 時の追加（フィルタチップ用）*/
  activeRing: string;
};

export function topicTone(topic: TutorTopic): Tone {
  switch (topic) {
    case "morning-reflection":
      return {
        bg: "bg-amber-100 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-900/60",
        activeRing: "ring-amber-400",
      };
    case "excavation":
      return {
        bg: "bg-sky-100 dark:bg-sky-950/40",
        text: "text-sky-700 dark:text-sky-300",
        border: "border-sky-200 dark:border-sky-900/60",
        activeRing: "ring-sky-400",
      };
    case "issue-check":
      return {
        bg: "bg-orange-100 dark:bg-orange-950/40",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-900/60",
        activeRing: "ring-orange-400",
      };
    case "schedule-check":
      return {
        bg: "bg-violet-100 dark:bg-violet-950/40",
        text: "text-violet-700 dark:text-violet-300",
        border: "border-violet-200 dark:border-violet-900/60",
        activeRing: "ring-violet-400",
      };
    case "history-check":
      return {
        bg: "bg-slate-100 dark:bg-slate-800/60",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-700/60",
        activeRing: "ring-slate-400",
      };
    case "reflection-check":
      return {
        bg: "bg-teal-100 dark:bg-teal-950/40",
        text: "text-teal-700 dark:text-teal-300",
        border: "border-teal-200 dark:border-teal-900/60",
        activeRing: "ring-teal-400",
      };
    case "material-add":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-900/60",
        activeRing: "ring-emerald-400",
      };
    case "subject-history":
      return {
        bg: "bg-indigo-100 dark:bg-indigo-950/40",
        text: "text-indigo-700 dark:text-indigo-300",
        border: "border-indigo-200 dark:border-indigo-900/60",
        activeRing: "ring-indigo-400",
      };
    case "start-study":
      return {
        bg: "bg-fuchsia-100 dark:bg-fuchsia-950/40",
        text: "text-fuchsia-700 dark:text-fuchsia-300",
        border: "border-fuchsia-200 dark:border-fuchsia-900/60",
        activeRing: "ring-fuchsia-400",
      };
    case "ending":
      return {
        bg: "bg-rose-100 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-900/60",
        activeRing: "ring-rose-400",
      };
    case "free-chat":
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
        activeRing: "ring-primary",
      };
  }
}

type TopicChipProps = {
  topic: TutorTopic;
  /** フィルター用の件数バッジ（任意） */
  count?: number;
  /** フィルター選択中（強調表示）*/
  active?: boolean;
  /** クリック可（フィルター用） */
  onClick?: () => void;
  /** サイズ */
  size?: "sm" | "md";
};

/**
 * 絵文字 + ラベルのカラフルなチップ。
 * セクションヘッダーとアーカイブのフィルターで共用。
 */
export function TopicChip({
  topic,
  count,
  active,
  onClick,
  size = "md",
}: TopicChipProps) {
  const tone = topicTone(topic);
  const isButton = typeof onClick === "function";
  const baseSizeCls =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  const content = (
    <>
      <span aria-hidden="true" className="text-[1.1em] leading-none">
        {topicEmoji(topic)}
      </span>
      <span>{topicLabel(topic)}</span>
      {count !== undefined && (
        <span
          className={cn(
            "ml-0.5 rounded-full bg-white/70 px-1.5 text-[9px] font-semibold dark:bg-black/30",
            tone.text,
          )}
        >
          {count}
        </span>
      )}
    </>
  );

  const sharedCls = cn(
    "inline-flex items-center gap-1 rounded-full border font-medium transition-all",
    baseSizeCls,
    tone.bg,
    tone.text,
    tone.border,
    active && cn("ring-2 ring-offset-1", tone.activeRing),
    isButton && "cursor-pointer hover:scale-105 hover:shadow-sm",
    !isButton && "select-none",
  );

  if (isButton) {
    return (
      <button type="button" onClick={onClick} className={sharedCls}>
        {content}
      </button>
    );
  }
  return <span className={sharedCls}>{content}</span>;
}
