"use client";

/**
 * StartStudyCard - 担任 chat の最後で出る「学習を始める」CTA。
 *
 * クリックで /learn?node=...&startDay=1 へ遷移し、復元テスト → 本編 に入る。
 */
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import type { TutorCard } from "@/lib/learn/types";

type Props = {
  card: Extract<TutorCard, { kind: "start-study" }>;
};

export function StartStudyCard({ card }: Props) {
  const href = card.withReconstruction
    ? `/learn?node=${encodeURIComponent(card.entryNodeId)}&startDay=1`
    : `/learn?node=${encodeURIComponent(card.entryNodeId)}`;

  return (
    <Card className="my-2 border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-primary">
        <Sparkles className="size-3.5" />
        <span className="font-medium">準備 OK</span>
      </div>
      <p className="mb-3 text-sm text-foreground">
        {card.withReconstruction
          ? "体系図の「思い出す訓練」を軽くやってから、本編に入るよ。"
          : "本編に入るよ。"}
      </p>
      <Link href={href}>
        <Button size="lg" className="w-full justify-center gap-2 font-semibold">
          <Play className="size-4 fill-current" />
          <span>{card.label}</span>
        </Button>
      </Link>
    </Card>
  );
}
