"use client";

/**
 * IssueListView - 課題一覧（イシュードリブン思考の中心画面）。
 *
 * - 未クリア / クリア済み / すべて の切替
 * - 本人発 / AI 発 のフィルタ
 * - 各課題:
 *   - source バッジ（本人/AI）
 *   - タイトル + 詳細
 *   - 関連ノード（クリックで /learn?node=xxx へ）
 *   - 発生履歴（複数回出ていれば回数 + 最終発生日）
 *   - 「分かった！」でクリア
 *   - AI が「クリアして OK そう」と言ってる時は強調表示
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Check,
  CheckCircle2,
  CircleDot,
  Home,
  MessageSquare,
  Sparkles,
  Target,
  User as UserIcon,
} from "lucide-react";
import type { Issue, IssueSource, KnowledgeNode } from "@/lib/learn/types";

type StatusFilter = "open" | "resolved" | "all";
type SourceFilter = "all" | IssueSource;

type Props = {
  issues: Issue[];
  nodes: KnowledgeNode[];
  /** クリア / クリア取り消し */
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
};

export function IssueListView({
  issues,
  nodes,
  onResolve,
  onReopen,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const nameOf = (id: string) =>
    nodes.find((n) => n.id === id)?.name ?? id;

  const counts = useMemo(() => {
    const open = issues.filter((i) => i.status === "open").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    const aiSuggested = issues.filter(
      (i) => i.status === "open" && i.aiSuggestedClear,
    ).length;
    return { open, resolved, aiSuggested, all: issues.length };
  }, [issues]);

  const filtered = useMemo(() => {
    return [...issues]
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter((i) => sourceFilter === "all" || i.source === sourceFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [issues, statusFilter, sourceFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Target className="size-5 text-primary" />
          <div className="flex-1">
            <h1 className="text-base font-semibold">課題一覧</h1>
            <p className="text-xs text-muted-foreground">
              未クリア {counts.open} 件 · クリア済み {counts.resolved} 件
              {counts.aiSuggested > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-primary">
                    AI クリア提案 {counts.aiSuggested} 件
                  </span>
                </>
              )}
            </p>
          </div>
          <Link href="/learn">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="size-4" />
              <span>学習画面に戻る</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6">
        {/* フィルタ */}
        <div className="flex flex-wrap items-center gap-3">
          <FilterGroup label="状態">
            <FilterChip
              active={statusFilter === "open"}
              onClick={() => setStatusFilter("open")}
            >
              <CircleDot className="size-3" />
              <span>未クリア</span>
              <span className="ml-1 text-[10px] opacity-70">({counts.open})</span>
            </FilterChip>
            <FilterChip
              active={statusFilter === "resolved"}
              onClick={() => setStatusFilter("resolved")}
            >
              <CheckCircle2 className="size-3" />
              <span>クリア済み</span>
              <span className="ml-1 text-[10px] opacity-70">
                ({counts.resolved})
              </span>
            </FilterChip>
            <FilterChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              <span>すべて</span>
              <span className="ml-1 text-[10px] opacity-70">({counts.all})</span>
            </FilterChip>
          </FilterGroup>

          <FilterGroup label="発生源">
            <FilterChip
              active={sourceFilter === "all"}
              onClick={() => setSourceFilter("all")}
            >
              <span>すべて</span>
            </FilterChip>
            <FilterChip
              active={sourceFilter === "self"}
              onClick={() => setSourceFilter("self")}
            >
              <UserIcon className="size-3" />
              <span>本人発</span>
            </FilterChip>
            <FilterChip
              active={sourceFilter === "ai-detected"}
              onClick={() => setSourceFilter("ai-detected")}
            >
              <Bot className="size-3" />
              <span>AI 発</span>
            </FilterChip>
          </FilterGroup>
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="mx-auto size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {statusFilter === "open"
                  ? "未クリアの課題はありません 🎉"
                  : "条件に合う課題がありません"}
              </p>
            </CardContent>
          </Card>
        )}

        {filtered.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            nodeName={nameOf(issue.nodeId)}
            onResolve={() => onResolve(issue.id)}
            onReopen={() => onReopen(issue.id)}
          />
        ))}
      </main>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <div className="flex items-center gap-1">{children}</div>
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
          ? "flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
          : "flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function IssueCard({
  issue,
  nodeName,
  onResolve,
  onReopen,
}: {
  issue: Issue;
  nodeName: string;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const isResolved = issue.status === "resolved";
  const occurrenceCount = issue.occurrences?.length ?? 0;
  const lastOccurrence = issue.occurrences?.[issue.occurrences.length - 1];

  return (
    <Card
      className={
        issue.aiSuggestedClear && !isResolved
          ? "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
          : isResolved
            ? "opacity-70"
            : ""
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <SourceBadge source={issue.source} />
          <CardTitle
            className={
              isResolved
                ? "flex-1 text-sm text-muted-foreground line-through"
                : "flex-1 text-sm"
            }
          >
            {issue.title}
          </CardTitle>
          {isResolved ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={onReopen}
            >
              <CircleDot className="size-3.5" />
              <span>未クリアに戻す</span>
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={onResolve}>
              <Check className="size-3.5" />
              <span>分かった！</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {issue.detail && (
          <p className="text-xs leading-relaxed text-card-foreground">
            {issue.detail}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Link
            href={`/learn?node=${encodeURIComponent(issue.nodeId)}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <MessageSquare className="size-3" />
            <span>{nodeName}</span>
            <span className="text-[10px] opacity-70">— 学習へ</span>
          </Link>

          <span className="text-muted-foreground">
            {new Date(issue.createdAt).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            })}{" "}
            発生
          </span>

          {occurrenceCount > 1 && (
            <Badge variant="outline" className="text-[10px]">
              {occurrenceCount} 回発生 / 最終{" "}
              {lastOccurrence
                ? new Date(lastOccurrence.detectedAt).toLocaleDateString(
                    "ja-JP",
                    { month: "short", day: "numeric" },
                  )
                : ""}
            </Badge>
          )}

          {isResolved && issue.resolvedAt && (
            <Badge variant="outline" className="text-[10px] text-emerald-700">
              <Check className="mr-0.5 size-2.5" />
              {new Date(issue.resolvedAt).toLocaleDateString("ja-JP", {
                month: "short",
                day: "numeric",
              })}{" "}
              クリア
            </Badge>
          )}
        </div>

        {issue.aiSuggestedClear && !isResolved && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-300/60 bg-card/70 p-2.5 text-[11px] dark:border-emerald-900/60">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                AI: もうクリアして良さそう
              </p>
              {issue.aiSuggestedClearReason && (
                <p className="mt-0.5 text-muted-foreground">
                  {issue.aiSuggestedClearReason}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: IssueSource }) {
  if (source === "self") {
    return (
      <Badge
        variant="outline"
        className="mt-0.5 gap-1 border-blue-300/60 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      >
        <UserIcon className="size-2.5" />
        本人発
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="mt-0.5 gap-1 border-purple-300/60 bg-purple-50 text-[10px] text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300"
    >
      <Bot className="size-2.5" />
      AI 発
    </Badge>
  );
}
