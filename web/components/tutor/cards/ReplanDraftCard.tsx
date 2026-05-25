"use client";

/**
 * ReplanDraftCard - Replan draft 提示カード (C19 Phase 5 P5-Q3)。
 *
 * Replan の 3 トリガー (週次レポート時 / InterruptEvent 即時 / 明示発話) で
 * AI が生成した提案を本人に表示する。「OK 反映して」で commitReplan が走り、
 * MOCK_LEARNING_PLANS[i].revisions に PlanRevision が push される。
 *
 * 種類別:
 *   - carry-over:     当月内で遅延を再配置 (来月以降に滲ませる、軽量)
 *   - pace-change:    monthlyRoadmap 再計算 → 未来 GT[] 全再生成 (重い)
 *   - material-change: 新 LearningPlan + 旧 paused (立案やり直し相当)
 *
 * トリガー別:
 *   - weekly-review: 週次レポート判定 (delayThresholdDays 超え)
 *   - interrupt:     InterruptEvent (体調不良 / 学校行事 / 急な提出物等)
 *   - manual:        本人発話 (「ペース変えて」「教材変える」等)
 */
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

type Card = {
  kind: "replan-draft";
  planId: string;
  planTitle: string;
  replanKind: "carry-over" | "pace-change" | "material-change";
  triggeredBy: "weekly-review" | "interrupt" | "manual";
  proposedChange: string;
  rationale: string;
};

type Props = {
  card: Card;
};

export function ReplanDraftCard({ card }: Props) {
  const kindMeta = KIND_META[card.replanKind];
  const triggerLabel = TRIGGER_LABELS[card.triggeredBy];

  return (
    <Card className="border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20">
      <CardContent className="flex flex-col gap-2.5 py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-sky-700 dark:text-sky-400">
          <RefreshCw className="size-3.5" />
          <span>Replan 提案: {kindMeta.label}</span>
          <span className="ml-auto rounded-full border border-sky-200 bg-card px-1.5 py-0 text-[9px] font-medium text-sky-700 dark:border-sky-800 dark:text-sky-400">
            {triggerLabel}
          </span>
        </div>

        <p className="text-[12px] font-medium text-card-foreground">
          {card.planTitle}
        </p>

        <div className="rounded-md border border-sky-200 bg-card px-3 py-2 dark:border-sky-900/50">
          <p className="text-[11px] font-medium text-muted-foreground">
            変更内容
          </p>
          <p className="mt-0.5 text-[12px] text-card-foreground">
            {card.proposedChange}
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {card.rationale}
        </p>
      </CardContent>
    </Card>
  );
}

const KIND_META: Record<
  "carry-over" | "pace-change" | "material-change",
  { label: string }
> = {
  "carry-over": { label: "当月内で繰越調整" },
  "pace-change": { label: "ペース変更" },
  "material-change": { label: "教材変更 (立案やり直し)" },
};

const TRIGGER_LABELS: Record<
  "weekly-review" | "interrupt" | "manual",
  string
> = {
  "weekly-review": "週次判定",
  interrupt: "割込み発生",
  manual: "本人要望",
};
