"use client";

/**
 * HandoffBanner - IssueChat ヘッダ直下に表示する「ゆいから N 件」バッジ + 展開ビュー（Phase 3 レビュー追従 C5）。
 *
 * 表示条件: 当該 Issue に紐づく TutorHandoff が 1 件以上ある場合のみ。
 * 関連付け: `handoff.relatedIssueId === issue.id` で絞り込み。
 * 表示内容:
 *   - 折り畳み時: 「📨 ゆい先生から N 件 (未読 M)」 + chevron
 *   - 展開時: 各 handoff のタイトル / 日時 / status / body (markdown)
 *
 * ito19 さん設計（C3 で実装した excavation 派生 + C2 静的 mock）と合わせて:
 *   - excavation 経由で動的に増える handoff も即反映
 *   - status = "unread" は緑バッジで強調、葵が「読む」モチベを作る
 *
 * 既読化のアクションは Phase 7 (Supabase 永続化) と合わせて実装する。
 * 現状は読み取り専用（mutation なし）。
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Mail, MailOpen } from "lucide-react";
import { MarkdownText } from "@/components/chat/MarkdownText";
import { cn } from "@/lib/utils";
import type { TutorHandoff } from "@/lib/learn/types";

type Props = {
  /** 当該 Issue に紐づく handoff 全件（呼び出し元でフィルタ済み）*/
  handoffs: TutorHandoff[];
};

export function HandoffBanner({ handoffs }: Props) {
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => handoffs.filter((h) => h.status === "unread").length,
    [handoffs],
  );

  if (handoffs.length === 0) return null;

  return (
    <div
      className={cn(
        "border-b border-border bg-emerald-50/60 dark:bg-emerald-950/20",
        open && "pb-3",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30"
        aria-expanded={open}
      >
        <Mail className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
          ゆい先生から {handoffs.length} 件
        </span>
        {unreadCount > 0 && (
          <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            未読 {unreadCount}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
          {open ? "閉じる" : "申し送りを読む"}
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-4">
          {handoffs.map((h) => (
            <HandoffCard key={h.id} handoff={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function HandoffCard({ handoff }: { handoff: TutorHandoff }) {
  const isUnread = handoff.status === "unread";
  return (
    <article
      className={cn(
        "rounded-md border bg-card p-3",
        isUnread
          ? "border-emerald-300/60 dark:border-emerald-900/60"
          : "border-border",
      )}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        {isUnread ? (
          <Mail className="size-3.5 text-emerald-600" />
        ) : (
          <MailOpen className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-[12px] font-semibold text-foreground">
          {handoff.title}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            isUnread
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUnread ? "未読" : "既読"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {formatDateTime(handoff.createdAt)}
        </span>
      </header>
      <div className="rounded bg-muted/30 px-3 py-2 text-[13px] text-card-foreground">
        <MarkdownText text={handoff.body} variant="card" />
      </div>
      {handoff.readAt && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          既読: {formatDateTime(handoff.readAt)}
        </p>
      )}
    </article>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d
    .getHours()
    .toString()
    .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
