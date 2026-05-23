"use client";

/**
 * IssueChatComposer - 課題 chat の入力欄 + QuickReply chips。
 * TutorComposer の双子だが、placeholder と locked 表示が課題 chat 仕様。
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send } from "lucide-react";

type Props = {
  quickReplies?: string[];
  onSend: (text: string) => void;
  /** AI ターン中: 入力ロック */
  locked?: boolean;
  /** Issue resolved 済み: 入力欄を完全 disabled に */
  readonly?: boolean;
};

export function IssueChatComposer({
  quickReplies,
  onSend,
  locked,
  readonly,
}: Props) {
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!locked && !readonly) taRef.current?.focus();
  }, [locked, readonly]);

  const submit = () => {
    const t = draft.trim();
    if (!t || locked || readonly) return;
    onSend(t);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (readonly) {
    return (
      <div className="border-t border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
        この課題はクリア済みです。会話は読み取り専用です。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-background p-3">
      {quickReplies && quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              disabled={locked}
              onClick={() => onSend(q)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            locked
              ? "あおい先生が考え中…"
              : "あおい先生に話す（Enter で送信）"
          }
          disabled={locked}
          rows={1}
          className="min-h-[44px] flex-1 resize-none"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled
          aria-label="音声入力（Phase 8 で実装）"
          title="音声入力（Phase 8 で実装予定）"
        >
          <Mic className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={locked || !draft.trim()}
          aria-label="送信"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
