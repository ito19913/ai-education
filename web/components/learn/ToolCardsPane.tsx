"use client";

/**
 * ToolCardsPane - Pane 4。「娘さんの道具箱」。
 * 縦並びカードリスト。各カード内で Inline* プリミティブで直接編集。
 * 鉛筆アイコン・編集ボタン・モーダルには逃がさない（CLAUDE.md 規律）。
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  InlineTextField,
  InlineTextareaField,
} from "@/components/primitives";
import { Plus, Wrench } from "lucide-react";
import type { ToolCard } from "@/lib/learn/types";

type Props = {
  toolCards: ToolCard[];
  onChangeCard: (id: string, field: keyof ToolCard, value: string) => void;
  onAddCard: () => void;
};

export function ToolCardsPane({ toolCards, onChangeCard, onAddCard }: Props) {
  return (
    <div className="flex w-[360px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">自分の道具箱</h2>
        </div>
        <Button size="sm" variant="outline" onClick={onAddCard}>
          <Plus />
          <span>新規</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {toolCards.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                まだ道具がありません。
                <br />
                AI と一緒に最初のツールカードを作ろう。
              </p>
            </div>
          )}
          {toolCards.map((card, idx) => (
            <Card key={card.id}>
              <CardHeader>
                <CardTitle className="text-sm">ツール #{idx + 1}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Field label="何をするツール？">
                  <InlineTextareaField
                    value={card.whatDoes}
                    onSave={(v) => onChangeCard(card.id, "whatDoes", v)}
                    ariaLabel="このツールが何をするかの説明"
                  />
                </Field>
                <Field label="いつ使う？">
                  <InlineTextareaField
                    value={card.whenToUse}
                    onSave={(v) => onChangeCard(card.id, "whenToUse", v)}
                    ariaLabel="いつ使うかの説明"
                  />
                </Field>
                <Field label="例文">
                  <InlineTextareaField
                    value={card.example}
                    onSave={(v) => onChangeCard(card.id, "example", v)}
                    ariaLabel="例文"
                  />
                </Field>
                <Field label="関連メモ">
                  <InlineTextField
                    value={card.relatedNotes}
                    onSave={(v) => onChangeCard(card.id, "relatedNotes", v)}
                    ariaLabel="関連するツールやメモ"
                  />
                </Field>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
