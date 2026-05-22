"use client";

/**
 * TutorComposer - 担任 chat の入力欄 + QuickReply chips。
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send } from "lucide-react";

type Props = {
  /** AI が提示中の quick reply 候補（unused; 親で focus 制御の依存にだけ使う想定でも可）*/
  quickReplies?: string[];
  /** 送信時 */
  onSend: (text: string) => void;
  /** locked = AI ターン中、入力できない */
  locked?: boolean;
};

export function TutorComposer({ quickReplies, onSend, locked }: Props) {
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // AI ターンが終わって locked が解けたら入力欄に focus（UX 向上）。
  // setState は呼ばないので effect で問題ない。draft のクリアは submit 内で行う。
  useEffect(() => {
    if (!locked) taRef.current?.focus();
  }, [locked]);

  const submit = () => {
    const t = draft.trim();
    if (!t || locked) return;
    onSend(t);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

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
          placeholder={locked ? "ゆい先生が考え中…" : "ゆい先生に話す（Enter で送信）"}
          disabled={locked}
          rows={1}
          className="min-h-[44px] flex-1 resize-none"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled
          aria-label="音声入力（Phase 3 で実装）"
          title="音声入力（Phase 3 で実装予定）"
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
