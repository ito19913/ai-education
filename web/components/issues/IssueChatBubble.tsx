"use client";

/**
 * IssueChatBubble - 課題 chat の 1 メッセージ。
 * - role が teacher: 左寄せ、アバター「英」、本文 + カード
 * - role が learner: 右寄せ、本文のみ
 *
 * TutorMessageBubble の双子だが、課題 chat 固有のカード種別を扱う。
 */
import type { IssueChatMessage } from "@/lib/learn/types";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { TriggerMessageQuoteCard } from "./cards/TriggerMessageQuoteCard";
import { ResolveSuggestionCard } from "./cards/ResolveSuggestionCard";

type Props = {
  message: IssueChatMessage;
  /** 引用元ノードの表示名（trigger-message-quote 用、解決できれば渡す）*/
  sourceNodeName?: string;
  /** resolve-suggestion カードの「クリアする」ボタン */
  onResolveClick?: () => void;
  /** Issue が既に resolved 済みなら true（カードのボタンを disabled に）*/
  resolved?: boolean;
};

export function IssueChatBubble({
  message,
  sourceNodeName,
  onResolveClick,
  resolved,
}: Props) {
  if (message.role === "teacher") {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          あ
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            あおい先生（英語）
          </span>
          {message.text && (
            <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-card-foreground">
              <MarkdownText text={message.text} variant="card" />
            </div>
          )}
          {message.card && (
            <div className="max-w-[600px]">
              {message.card.kind === "trigger-message-quote" && (
                <TriggerMessageQuoteCard
                  card={message.card}
                  sourceNodeName={sourceNodeName}
                />
              )}
              {message.card.kind === "resolve-suggestion" && (
                <ResolveSuggestionCard
                  card={message.card}
                  onResolveClick={onResolveClick ?? (() => {})}
                  disabled={resolved}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // learner
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-primary-foreground">
        <MarkdownText text={message.text ?? ""} variant="bubble-primary" />
      </div>
    </div>
  );
}
