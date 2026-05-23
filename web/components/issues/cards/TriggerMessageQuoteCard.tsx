"use client";

/**
 * TriggerMessageQuoteCard - AI 発の Issue で、検知元 ChatMessage を引用するカード。
 * 課題 chat の冒頭で「あの時の会話、こんな感じだったよね」と文脈を提示するために使う。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import type { IssueChatCard } from "@/lib/learn/types";

type QuoteCard = Extract<IssueChatCard, { kind: "trigger-message-quote" }>;

type Props = {
  card: QuoteCard;
  /** 引用元ノードの表示名（解決できれば渡す） */
  sourceNodeName?: string;
};

export function TriggerMessageQuoteCard({ card, sourceNodeName }: Props) {
  const date = new Date(card.sourceCreatedAt).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="border-violet-300/60 bg-violet-50/40 dark:border-violet-900/60 dark:bg-violet-950/20">
      <CardContent className="flex gap-2.5 py-3">
        <Quote className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            過去の会話から
            {sourceNodeName && (
              <span className="ml-1.5 text-violet-700 dark:text-violet-300">
                · {sourceNodeName}
              </span>
            )}
            <span className="ml-1.5 text-muted-foreground">· {date}</span>
          </span>
          <p className="whitespace-pre-wrap text-sm text-card-foreground">
            {card.quote}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
