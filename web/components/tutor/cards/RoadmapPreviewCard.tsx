"use client";

/**
 * RoadmapPreviewCard - 計画立案フロー (C8 Phase 4) で AI 生成 roadmap を確認するカード。
 *
 * フロー:
 *   ゆい「教科書 200p だね、AI で計画作ってみた、見て」+ RoadmapPreviewCard
 *   → 本人が roadmap を確認
 *   → quickReplies で「これで OK」「もう少しゆっくり」「もう少し速く」を選択
 *   → tutor-mock の plan-await-confirm 分岐で処理
 *
 * デザイン:
 *   - 月別ページ範囲を回転単位でグルーピング表示
 *   - 長くなりすぎないよう 1 回転目だけ詳細表示、2 回転目以降は概要のみ
 *   - 「これで OK」「もう少しゆっくり」「もう少し速く」は quickReplies (カード外) で誘導
 *     → カード自体はボタンなし、読み取り専用に近い
 */
import { Card, CardContent } from "@/components/ui/card";
import { Map as MapIcon, RotateCw } from "lucide-react";
import { useState } from "react";

type Card = {
  kind: "roadmap-preview";
  subjectId: string;
  materialId: string;
  materialName: string;
  totalPages: number;
  monthsPerRotation: number;
  rotations: number;
  startDate: string;
  monthlyRoadmap: Array<{
    month: string;
    targetPages: number;
    startPage?: number;
    endPage?: number;
  }>;
};

type Props = {
  card: Card;
};

export function RoadmapPreviewCard({ card }: Props) {
  const [showAll, setShowAll] = useState(false);
  const totalMonths = card.monthsPerRotation * card.rotations;

  // 回転単位でグルーピング
  const rotationGroups: Array<{
    rotationIdx: number;
    months: Card["monthlyRoadmap"];
  }> = [];
  for (let r = 0; r < card.rotations; r++) {
    const start = r * card.monthsPerRotation;
    const end = start + card.monthsPerRotation;
    rotationGroups.push({
      rotationIdx: r,
      months: card.monthlyRoadmap.slice(start, end),
    });
  }

  const visibleGroups = showAll ? rotationGroups : rotationGroups.slice(0, 1);
  const hiddenCount = rotationGroups.length - visibleGroups.length;

  return (
    <Card className="border-primary/30 bg-card">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <MapIcon className="size-3.5 text-primary" />
          <span>{card.materialName} 計画 ({card.rotations} 回転)</span>
        </div>

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px]">
          <div className="flex justify-between">
            <span>総ページ</span>
            <span className="font-semibold tabular-nums">
              {card.totalPages} p
            </span>
          </div>
          <div className="mt-0.5 flex justify-between">
            <span>合計期間</span>
            <span className="font-semibold tabular-nums">
              {totalMonths} ヶ月 ({card.monthsPerRotation} ヶ月 × {card.rotations} 回転)
            </span>
          </div>
          <div className="mt-0.5 flex justify-between">
            <span>開始</span>
            <span className="font-semibold tabular-nums">{card.startDate}</span>
          </div>
        </div>

        {/* 月別 roadmap */}
        <div className="flex flex-col gap-2">
          {visibleGroups.map((group) => (
            <RotationGroup key={group.rotationIdx} group={group} />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-primary"
            >
              + 残り {hiddenCount} 回転を見る
            </button>
          )}
          {showAll && rotationGroups.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-primary"
            >
              閉じる (1 回転目だけ表示)
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          ↑ これで OK なら下のボタンで「これで OK」を選んでね。ペース調整は「ゆっくり / 速く」を選択。
        </p>
      </CardContent>
    </Card>
  );
}

function RotationGroup({
  group,
}: {
  group: { rotationIdx: number; months: Array<{ month: string; targetPages: number; startPage?: number; endPage?: number }> };
}) {
  if (group.months.length === 0) return null;
  const firstMonth = group.months[0].month;
  const lastMonth = group.months[group.months.length - 1].month;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/50 p-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <RotateCw className="size-3 text-primary" />
        <span>
          {group.rotationIdx + 1} 回転目 ({firstMonth} 〜 {lastMonth})
        </span>
      </div>
      <ul className="ml-4 flex flex-col gap-0.5 text-[11px] text-card-foreground">
        {group.months.map((m) => (
          <li key={m.month} className="tabular-nums">
            <span className="font-medium">{m.month}</span>: p.{m.startPage}-
            {m.endPage} ({m.targetPages} p)
          </li>
        ))}
      </ul>
    </div>
  );
}
