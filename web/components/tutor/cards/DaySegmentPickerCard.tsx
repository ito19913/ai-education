"use client";

/**
 * DaySegmentPickerCard - 本を選んだ後の「どのまとまりやる?」ピッカー (Phase B、grill B-3)。
 *
 * 済み (レジュメ understood) は ✓ バッジ、おすすめ = 次のまとまり (最初の未済) を
 * 先頭ハイライト。どれでも選べる (キューの順不同 OK 思想と同じ)。
 * 既に今日の枠に入っているまとまりだけ無効化する (B-5 重複防止)。
 */
import { Card } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  card: Extract<TutorCard, { kind: "day-segment-picker" }>;
  /** 既に今日の枠に入っているキー集合 (`${materialId}:${segmentId}`) */
  pickedKeys: Set<string>;
  onPickSegment: (
    materialId: string,
    segmentId: string,
    label: string,
  ) => void;
};

export function DaySegmentPickerCard({
  card,
  pickedKeys,
  onPickSegment,
}: Props) {
  return (
    <Card className="my-2 p-3">
      <p className="mb-2 text-[11px] text-muted-foreground">
        「{card.materialLabel}」のどのまとまりやる? (⭐ = つぎのおすすめ)
      </p>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {card.options.map((opt) => {
          const key = `${card.materialId}:${opt.segmentId}`;
          const picked = pickedKeys.has(key);
          return (
            <button
              key={opt.segmentId}
              type="button"
              disabled={picked}
              onClick={() =>
                onPickSegment(card.materialId, opt.segmentId, opt.label)
              }
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                picked
                  ? "cursor-default border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : opt.recommended
                    ? "border-primary bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5",
              )}
            >
              {picked ? (
                <Check className="size-4 shrink-0" strokeWidth={3} />
              ) : opt.recommended ? (
                <Star className="size-4 shrink-0 text-amber-500" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">
                {opt.label}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {opt.pageRange}
              </span>
              {opt.done && !picked && (
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✓ 済み
                </span>
              )}
              {picked && <span className="shrink-0 text-[10px]">入れたよ</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
