"use client";

/**
 * DialogPane - Pane 3。対話領域（上下分割）。
 * 上: 現在のノードの説明カード（常に「今やっていること」が見える）
 * 中: AI との対話履歴（吹き出し）。AI メッセージには「もっと詳しく / もっと簡単に」ボタン
 * 下: 音声入力ボタン（メイン）+ テキスト補助
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Mic, ZoomIn } from "lucide-react";
import { MarkdownText } from "@/components/chat/MarkdownText";
import type { ChatMessage, KnowledgeNode } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type Props = {
  currentNode: KnowledgeNode | null;
  messages: ChatMessage[];
  onAskMore: (messageId: string) => void;
  onAskSimpler: (messageId: string) => void;
};

export function DialogPane({
  currentNode,
  messages,
  onAskMore,
  onAskSimpler,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* 上: 現在のノードの説明 */}
      <div className="border-b border-border bg-background p-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {currentNode?.name ?? "（未選択）"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {currentNode?.description ??
                "左の体系図からノードを選んでください。"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 中: 対話履歴 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                このノードのチャットはまだありません。
                <br />
                音声で話しかけて始めよう。
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onAskMore={onAskMore}
              onAskSimpler={onAskSimpler}
            />
          ))}
        </div>
      </ScrollArea>

      {/* 下: 音声入力ボタン */}
      <div className="border-t border-border bg-background p-3">
        <Button size="lg" className="w-full gap-2">
          <Mic />
          <span>押している間、話す</span>
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          話すだけで OK。書く必要はないよ。
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onAskMore,
  onAskSimpler,
}: {
  message: ChatMessage;
  onAskMore: (messageId: string) => void;
  onAskSimpler: (messageId: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground",
        )}
      >
        <MarkdownText
          text={message.content}
          variant={isUser ? "bubble-primary" : "card"}
        />
      </div>
      {!isUser && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onAskMore(message.id)}
          >
            <ZoomIn className="size-3" />
            <span>もっと詳しく</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onAskSimpler(message.id)}
          >
            <Lightbulb className="size-3" />
            <span>もっと簡単に</span>
          </Button>
        </div>
      )}
    </div>
  );
}
