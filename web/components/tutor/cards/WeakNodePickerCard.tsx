"use client";

/**
 * WeakNodePickerCard - 計画立案フロー (C17 Phase 5 P5-Q2) で
 * 弱いノード候補を本人がチェックボックスで選ぶカード。
 *
 * フロー:
 *   ゆい「この計画で特に重点的に練習したいところある?」+ WeakNodePickerCard
 *   → 本人が候補をチェック (なくても OK)
 *   → 「これでいい」ボタン → onPick(selectedNodeIds[]) 発火
 *   → tutor-mock が plan-await-confirm に遷移 + roadmap-preview を出す
 *
 * 候補ソース (Plan Engine が半自動抽出):
 *   - Issue (status: "open" + 最近 7 日言及) ← 「具体的な詰まり」
 *   - NodeComprehension (score < 0.55)       ← 「体系の浅さ」
 *   - 両方ヒット                              ← preChecked: true (強い候補)
 *
 * デザイン:
 *   - preChecked が true な候補はデフォルトチェック済み + やや強調
 *   - 候補ごとに「Issue」「理解度」「両方」のソースバッジ
 *   - 「なくても OK」を明示 (本人主体性、Q15 同精神)
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

type Card = {
  kind: "weak-node-picker";
  subjectId: string;
  candidates: Array<{
    nodeId: string;
    nodeName: string;
    reason: string;
    source: "issue" | "comprehension" | "both";
    preChecked: boolean;
  }>;
};

type Props = {
  card: Card;
  onPick: (selectedNodeIds: string[]) => void;
};

export function WeakNodePickerCard({ card, onPick }: Props) {
  // 初期状態: preChecked が true な候補だけチェック済み
  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const c of card.candidates) {
      if (c.preChecked) initial.add(c.nodeId);
    }
    return initial;
  });

  const toggle = (nodeId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const selectedCount = checked.size;

  return (
    <Card className="border-primary/30 bg-card">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <Target className="size-3.5 text-primary" />
          <span>弱いところを選ぼう (なくても OK)</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {card.candidates.map((c) => {
            const isChecked = checked.has(c.nodeId);
            return (
              <label
                key={c.nodeId}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors",
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(c.nodeId)}
                  className="mt-0.5 size-3.5 accent-primary"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-card-foreground">
                      {c.nodeName}
                    </span>
                    <SourceBadge source={c.source} preChecked={c.preChecked} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.reason}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {selectedCount > 0
              ? `${selectedCount} 件 を重点練習に登録`
              : "なし (全部チェック外し)"}
          </span>
          <Button
            size="sm"
            onClick={() => onPick(Array.from(checked))}
            className="gap-1.5"
          >
            これでいい
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceBadge({
  source,
  preChecked,
}: {
  source: "issue" | "comprehension" | "both";
  preChecked: boolean;
}) {
  const label =
    source === "both" ? "課題 + 理解度" : source === "issue" ? "課題" : "理解度";
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0 text-[9px] font-medium",
        preChecked
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
