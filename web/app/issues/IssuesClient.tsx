"use client";

/**
 * IssuesClient - /issues の state ホルダー。
 *
 * MVP は local state のみ。後で Supabase 連携 (server action + revalidate) に置換。
 */
import { useState } from "react";
import { IssueListView } from "@/components/issues/IssueListView";
import type { Issue, KnowledgeNode } from "@/lib/learn/types";

type Props = {
  initialIssues: Issue[];
  nodes: KnowledgeNode[];
};

export function IssuesClient({ initialIssues, nodes }: Props) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);

  const handleResolve = (id: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
              // クリアしたら AI 提案フラグも消す
              aiSuggestedClear: false,
              aiSuggestedClearReason: undefined,
            }
          : i,
      ),
    );
  };

  const handleReopen = (id: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "open", resolvedAt: undefined }
          : i,
      ),
    );
  };

  return (
    <IssueListView
      issues={issues}
      nodes={nodes}
      onResolve={handleResolve}
      onReopen={handleReopen}
    />
  );
}
