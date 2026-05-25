"use client";

/**
 * DurationPickerCard - 計画立案フロー (C8 Phase 4) で期間 + 回転数を選択するカード。
 *
 * フロー:
 *   ゆい「全体で何ヶ月で 1 回転終わらせる? 何回転する?」+ DurationPickerCard
 *   → 本人が「1 回転 = N ヶ月」「合計 M 回転」を選択
 *   → 「決定」ボタン → onPick(months, rotations) 発火
 *   → tutor-mock が plan-await-confirm に遷移 + roadmap-preview を出す
 *
 * デザイン:
 *   - 推奨値 (3 ヶ月 × 3 回 = 9 ヶ月) は初期選択 + ハイライト
 *   - 合計期間 (months × rotations) を即時計算して表示
 *   - 本人が変更したら「OK にする?」を促す
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

type Card = {
  kind: "duration-picker";
  subjectId: string;
  materialId: string;
  totalPages: number;
  recommendedMonthsPerRotation: number;
  recommendedRotations: number;
  monthsOptions: number[];
  rotationsOptions: number[];
};

type Props = {
  card: Card;
  onPick: (monthsPerRotation: number, rotations: number) => void;
};

export function DurationPickerCard({ card, onPick }: Props) {
  const [months, setMonths] = useState<number>(
    card.recommendedMonthsPerRotation,
  );
  const [rotations, setRotations] = useState<number>(card.recommendedRotations);

  const totalMonths = months * rotations;
  const pagesPerMonth = Math.ceil(card.totalPages / months);

  return (
    <Card className="border-primary/30 bg-card">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <CalendarClock className="size-3.5 text-primary" />
          <span>期間 + 回転数を選ぼう</span>
        </div>

        {/* 1 回転あたりの月数 */}
        <Section title="1 回転に何ヶ月かける?">
          <div className="flex flex-wrap gap-1.5">
            {card.monthsOptions.map((m) => (
              <Chip
                key={m}
                active={months === m}
                recommended={m === card.recommendedMonthsPerRotation}
                onClick={() => setMonths(m)}
              >
                {m} ヶ月
              </Chip>
            ))}
          </div>
        </Section>

        {/* 回転数 */}
        <Section title="何回まわす?">
          <div className="flex flex-wrap gap-1.5">
            {card.rotationsOptions.map((r) => (
              <Chip
                key={r}
                active={rotations === r}
                recommended={r === card.recommendedRotations}
                onClick={() => setRotations(r)}
              >
                {r} 回転
              </Chip>
            ))}
          </div>
        </Section>

        {/* 合計表示 */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-card-foreground">
          <div className="flex justify-between">
            <span>合計期間</span>
            <span className="font-semibold tabular-nums">
              {totalMonths} ヶ月 ({months} ヶ月 × {rotations} 回転)
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>1 ヶ月あたり</span>
            <span className="font-semibold tabular-nums">
              約 {pagesPerMonth} ページ
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => onPick(months, rotations)}
            className="gap-1.5"
          >
            この期間で進める
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  recommended,
  onClick,
  children,
}: {
  active: boolean;
  recommended: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-card-foreground hover:border-primary/40",
        recommended && !active && "ring-1 ring-primary/30",
      )}
      title={recommended ? "推奨" : undefined}
    >
      {children}
      {recommended && !active && (
        <span className="ml-1 text-[9px] opacity-60">推奨</span>
      )}
    </button>
  );
}
