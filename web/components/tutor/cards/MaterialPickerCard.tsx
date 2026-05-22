"use client";

/**
 * MaterialPickerCard - 担任 chat 内で「テキストはどれにする?」を選ぶカード。
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Book, Check } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  card: Extract<TutorCard, { kind: "material-picker" }>;
  onPick: (materialId: string, label: string) => void;
};

export function MaterialPickerCard({ card, onPick }: Props) {
  const locked = !!card.selectedMaterialId;
  return (
    <Card className="my-2 p-3">
      <p className="mb-2 text-[11px] text-muted-foreground">
        テキストを選んでね
      </p>
      <div className="flex flex-col gap-2">
        {card.options.map((opt) => {
          const picked = card.selectedMaterialId === opt.materialId;
          return (
            <button
              key={opt.materialId}
              type="button"
              disabled={locked}
              onClick={() => onPick(opt.materialId, opt.label)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                picked
                  ? "border-primary bg-primary/10 text-primary"
                  : locked
                    ? "cursor-default border-border bg-muted/40 text-muted-foreground opacity-60"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5",
              )}
            >
              {picked ? (
                <Check className="size-4 shrink-0" strokeWidth={3} />
              ) : (
                <Book className="size-4 shrink-0" />
              )}
              <span className="flex-1 font-medium">{opt.label}</span>
              <Badge variant="outline" className="text-[9px]">
                {opt.tag}
              </Badge>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
