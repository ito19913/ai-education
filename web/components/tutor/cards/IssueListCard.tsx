"use client";

/**
 * IssueListCard - ゆい chat 内で未クリア課題を簡易リスト表示するカード（Phase 3）。
 *
 * 各 row クリックで親 (TutorWorkspace) に onSelectIssue(id) を通知 →
 * URL を /tutor?view=issue&id=xxx に push し、右ペインに IssueChat を展開する。
 * 「全部見る」で右ペインに IssueListView を展開する。
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronRight, Sparkles, Target, User as UserIcon } from "lucide-react";
import type { Issue, KnowledgeNode, TutorCard } from "@/lib/learn/types";

type Props = {
  card: Extract<TutorCard, { kind: "issue-list" }>;
  /** 全 Issue（card.issueIds で絞り込む）*/
  issues: Issue[];
  /** ノード解決用 */
  nodes: KnowledgeNode[];
  /** 個別 issue 行クリック → 右ペインに IssueChat */
  onSelectIssue: (issueId: string) => void;
  /** 「全部見る」クリック → 右ペインに IssueListView */
  onSeeAll: () => void;
};

export function IssueListCard({
  card,
  issues,
  nodes,
  onSelectIssue,
  onSeeAll,
}: Props) {
  const items = card.issueIds
    .map((id) => issues.find((i) => i.id === id))
    .filter((i): i is Issue => !!i);

  if (items.length === 0) {
    return (
      <Card className="my-1 border-primary/30 bg-primary/5">
        <CardContent className="py-3 text-center text-xs text-muted-foreground">
          未クリアの課題はありません 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-1 border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-1.5 py-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-primary">
          <Target className="size-3.5" />
          <span className="font-medium">未クリア課題 {items.length} 件</span>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((issue) => {
            const nodeName =
              nodes.find((n) => n.id === issue.nodeId)?.name ?? issue.nodeId;
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => onSelectIssue(issue.id)}
                className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <SourceBadge source={issue.source} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-xs font-medium text-foreground">
                    {issue.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{nodeName}</p>
                </div>
                {issue.aiSuggestedClear && (
                  <Sparkles className="size-3 shrink-0 text-emerald-600" />
                )}
                <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-full gap-1.5"
          onClick={onSeeAll}
        >
          <span>{card.seeAllLabel}</span>
          <ChevronRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: Issue["source"] }) {
  if (source === "self") {
    return (
      <Badge
        variant="outline"
        className="mt-0.5 h-4 shrink-0 gap-0.5 border-blue-300/60 bg-blue-50 px-1 text-[9px] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      >
        <UserIcon className="size-2.5" />
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="mt-0.5 h-4 shrink-0 gap-0.5 border-purple-300/60 bg-purple-50 px-1 text-[9px] text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300"
    >
      <Bot className="size-2.5" />
    </Badge>
  );
}
