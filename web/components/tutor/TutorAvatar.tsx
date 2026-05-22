"use client";

/**
 * TutorAvatar - 担任「ゆい」さんのアバター（テキスト円バッジ）。
 * Phase 2 では emoji / 文字。後で画像差し替え可。
 */
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function TutorAvatar({ size = "md", className }: Props) {
  const sizeCls =
    size === "sm" ? "size-6 text-xs" : size === "lg" ? "size-10 text-base" : "size-8 text-sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
        sizeCls,
        className,
      )}
      aria-label="ゆい先生のアイコン"
    >
      ゆ
    </span>
  );
}
