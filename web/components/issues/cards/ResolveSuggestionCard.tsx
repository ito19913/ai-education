"use client";

/**
 * ResolveSuggestionCard - 科目の先生が「もうクリアして良さそう」と提案するカード。
 * 提案だけで自動 resolve はしない（本人意思を尊重）。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import type { IssueChatCard } from "@/lib/learn/types";

type SuggestCard = Extract<IssueChatCard, { kind: "resolve-suggestion" }>;

type Props = {
  card: SuggestCard;
  onResolveClick: () => void;
  /** 既に resolved 済みなら disabled で出す */
  disabled?: boolean;
};

export function ResolveSuggestionCard({ card, onResolveClick, disabled }: Props) {
  return (
    <Card className="border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <CardContent className="flex flex-col gap-2 py-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Sparkles className="size-3.5" />
          <span>もうクリアして良さそう</span>
        </p>
        {card.reason && (
          <p className="text-xs text-card-foreground">{card.reason}</p>
        )}
        <div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={onResolveClick}
            disabled={disabled}
          >
            <Check className="size-3.5" />
            <span>クリアする</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
