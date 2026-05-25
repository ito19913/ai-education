"use client";

/**
 * NodeReviewSuggestionCard - 上ノード復習提案カード (C18 Phase 5 P5-Q4)。
 *
 * NodeComprehension 低下検出 or テスト失敗 (failureAction: "review-parent")
 * 時に Plan Engine が生成した NodeReviewSuggestion を、ゆい chat 冒頭で
 * 3 択提示する。
 *
 * 3 択 (quickReplies と連動):
 *   - 「復習する」: accept → 復習 GT 生成 → 即時 今週 SI 挿入
 *   - 「あとで考える」: pending のまま、次セッションで再提示
 *   - 「いらない」: dismiss → status: "dismissed"、再提案抑制
 *
 * 本カードはディスプレイ専用 (発話処理は quickReplies 経由で handler 側が判定)。
 * カードの内容: 失敗ノード → 親ノード の流れと、ゆいの所感 (reason)。
 */
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, BookOpen } from "lucide-react";

type Card = {
  kind: "node-review-suggestion";
  suggestionId: string;
  failedNodeName: string;
  parentNodeName: string;
  reason: string;
};

type Props = {
  card: Card;
};

export function NodeReviewSuggestionCard({ card }: Props) {
  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardContent className="flex flex-col gap-2.5 py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-amber-700 dark:text-amber-400">
          <BookOpen className="size-3.5" />
          <span>上ノード復習の提案</span>
        </div>

        {/* 親 ← 子 の流れを視覚化 */}
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="rounded-md bg-amber-100/60 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            {card.failedNodeName}
          </span>
          <ArrowUpRight className="size-3.5 text-amber-600 dark:text-amber-500" />
          <span className="rounded-md border border-amber-300 bg-card px-2 py-0.5 font-semibold text-card-foreground dark:border-amber-700">
            {card.parentNodeName}
          </span>
          <span className="text-[11px] text-muted-foreground">に戻る</span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {card.reason}
        </p>
      </CardContent>
    </Card>
  );
}
