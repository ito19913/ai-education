"use client";

/**
 * SubjectHistoryView - 科目の先生との対話履歴の集約タイムライン（Phase 3 追加）。
 *
 * grill-me で確定した設計:
 * - 読み取り中心（新規発話は既存 DialogPane / IssueChat で）
 * - 時系列降順タイムライン + 種別フィルタ + ノードフィルタ
 * - 各発言に出典バッジ + 「元の対話を開く」ジャンプリンク
 * - 含めるデータ: ChatMessage (ノード対話) + IssueChatMessage (課題 chat)
 *
 * /tutor 右ペインに embedded 展開される（独立ルートは作らない）。
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Book,
  ChevronRight,
  MessageSquare,
  ScrollText,
  Target,
} from "lucide-react";
import type {
  ChatMessage,
  Issue,
  KnowledgeNode,
  Subject,
} from "@/lib/learn/types";
import {
  collectSubjectHistory,
  getNodesInHistory,
  type SubjectHistoryItem,
} from "@/lib/learn/subject-history";
import { ROOT_NODE_TO_SUBJECT } from "@/lib/learn/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  subjectId: string;
  subjects: Subject[];
  nodes: KnowledgeNode[];
  chatMessages: ChatMessage[];
  issues: Issue[];
  /**
   * 「ゆい先生に戻る」リンクのハンドラ。
   * TutorWorkspace では subject-history 時に左ゆい先生ペインを隠すため、
   * 戻り導線をこのビューのヘッダに置く（呼び出し側が無ければ非表示）。
   */
  onBack?: () => void;
};

type KindFilter = "all" | "node-chat" | "issue-chat";

const MAX_NODE_CHIPS = 8;

export function SubjectHistoryView({
  subjectId,
  subjects,
  nodes,
  chatMessages,
  issues,
  onBack,
}: Props) {
  const subject = subjects.find((s) => s.id === subjectId);
  const subjectName = subject?.name ?? subjectId;
  const teacherDisplay = subject?.teacher?.displayName ?? `${subjectName}の先生`;

  const allItems = useMemo(
    () =>
      collectSubjectHistory({
        subjectId,
        nodes,
        rootToSubject: ROOT_NODE_TO_SUBJECT,
        chatMessages,
        issues,
      }),
    [subjectId, nodes, chatMessages, issues],
  );

  const nodeOptions = useMemo(() => getNodesInHistory(allItems), [allItems]);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [nodeFilter, setNodeFilter] = useState<string | "all">("all");
  const [showAllNodes, setShowAllNodes] = useState(false);

  const filtered = useMemo(() => {
    return allItems.filter((it) => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (nodeFilter !== "all") {
        const nid =
          it.kind === "node-chat" ? it.message.nodeId : it.issue.nodeId;
        if (nid !== nodeFilter) return false;
      }
      return true;
    });
  }, [allItems, kindFilter, nodeFilter]);

  const visibleNodeChips = showAllNodes
    ? nodeOptions
    : nodeOptions.slice(0, MAX_NODE_CHIPS);

  return (
    <div className="flex h-full w-full flex-col bg-canvas">
      {/* ヘッダ */}
      <header className="border-b border-border bg-background px-5 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 h-7 gap-1.5 px-2 text-xs"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            <span>ゆい先生に戻る</span>
          </Button>
        )}
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            {teacherDisplay}（{subjectName}）との対話履歴
          </h2>
          <span className="text-[11px] text-muted-foreground">
            （全 {allItems.length} 件{filtered.length !== allItems.length && ` / 表示 ${filtered.length} 件`}）
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          ノード対話 + 課題 chat を時系列で集約。読み取り専用。
        </p>
      </header>

      {/* フィルタ */}
      <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-5 py-3">
        <FilterRow label="種別">
          <FilterChip
            active={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
          >
            すべて
          </FilterChip>
          <FilterChip
            active={kindFilter === "node-chat"}
            onClick={() => setKindFilter("node-chat")}
          >
            <Book className="size-3" />
            ノード対話
          </FilterChip>
          <FilterChip
            active={kindFilter === "issue-chat"}
            onClick={() => setKindFilter("issue-chat")}
          >
            <Target className="size-3" />
            課題 chat
          </FilterChip>
        </FilterRow>

        {nodeOptions.length > 0 && (
          <FilterRow label="ノード">
            <FilterChip
              active={nodeFilter === "all"}
              onClick={() => setNodeFilter("all")}
            >
              全部
            </FilterChip>
            {visibleNodeChips.map((n) => (
              <FilterChip
                key={n.nodeId}
                active={nodeFilter === n.nodeId}
                onClick={() => setNodeFilter(n.nodeId)}
              >
                <span>{n.nodeName}</span>
                <span className="ml-1 text-[9px] opacity-60">
                  {n.count}
                </span>
              </FilterChip>
            ))}
            {!showAllNodes && nodeOptions.length > MAX_NODE_CHIPS && (
              <button
                type="button"
                onClick={() => setShowAllNodes(true)}
                className="rounded-full border border-dashed border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
              >
                +他 {nodeOptions.length - MAX_NODE_CHIPS} 件
              </button>
            )}
          </FilterRow>
        )}
      </div>

      {/* タイムライン */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-5">
          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <ScrollText className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {allItems.length === 0
                    ? `${teacherDisplay}とまだ対話していません。`
                    : "条件に合う対話がありません。"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((item) => <HistoryItemCard key={itemKey(item)} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

function itemKey(item: SubjectHistoryItem): string {
  return `${item.kind}-${item.message.id}`;
}

function HistoryItemCard({ item }: { item: SubjectHistoryItem }) {
  const role = item.message.role;
  const isTeacher = role === "assistant" || role === "teacher";
  // ChatMessage は `content`、IssueChatMessage は `text` (オプショナル)
  const text =
    item.kind === "node-chat"
      ? item.message.content
      : (item.message.text ?? "（カード or 添付）");
  const dateLabel = formatDateTime(item.message.createdAt);

  const jumpHref =
    item.kind === "node-chat"
      ? `/learn?node=${encodeURIComponent(item.message.nodeId)}`
      : `/tutor?view=issue&id=${encodeURIComponent(item.issue.id)}`;
  const jumpLabel =
    item.kind === "node-chat" ? "このノードを開く" : "この課題を開く";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge item={item} />
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {dateLabel}
          </span>
        </div>

        <p
          className={cn(
            "whitespace-pre-wrap text-sm leading-relaxed",
            isTeacher
              ? "text-card-foreground"
              : "rounded-md bg-muted/40 px-2 py-1 text-foreground",
          )}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {!isTeacher && (
            <span className="mr-1 text-[10px] font-medium text-muted-foreground">
              [本人]
            </span>
          )}
          {text}
        </p>

        <Link
          href={jumpHref}
          className="inline-flex items-center gap-1 self-start rounded-md border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <MessageSquare className="size-2.5" />
          <span>{jumpLabel}</span>
          <ChevronRight className="size-2.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function KindBadge({ item }: { item: SubjectHistoryItem }) {
  if (item.kind === "node-chat") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-blue-300/60 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      >
        <Book className="size-2.5" />
        <span>{item.nodeName}</span>
        <span className="opacity-60">(ノード対話)</span>
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-orange-300/60 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300"
    >
      <Target className="size-2.5" />
      <span className="truncate max-w-[200px]">{item.issue.title}</span>
      <span className="opacity-60">(課題 chat)</span>
    </Badge>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-medium text-muted-foreground">
        {label}:
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground"
          : "flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d
    .getHours()
    .toString()
    .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
