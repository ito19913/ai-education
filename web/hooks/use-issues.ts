"use client";

/**
 * useIssues — 課題 (Issue) ドメインフック (Phase 3 モノリス分割、2026-06-12)
 *
 * TutorWorkspace から課題の state + 操作を抽出したもの。挙動は移設前と同一:
 * - real モードは起動時に DB から復元 (mock の課題は出さない = 「画面に出るのは実データだけ」)、
 *   mock モードは initialIssues (MOCK_ISSUES)
 * - 各 mutation は in-memory 更新 + real モードのみ DB 保存 (失敗はログのみ =
 *   in-memory では生きている、動線止めない)
 */

import { useCallback, useEffect, useState } from "react";
import type { Issue, IssueChatMessage } from "@/lib/learn/types";
import type { DetectedAssignmentIssue } from "@/lib/ai/assignment-solve-claude";
import { isSupabaseConfigured } from "@/lib/materials/is-supabase-configured";
import { getCurrentUserId } from "@/lib/materials/materials-repo";
import {
  fetchIssues,
  insertIssues,
  updateIssueStatus,
  updateIssueChatThread,
} from "@/lib/issues/issues-repo";

export function useIssues(initialIssues: Issue[]) {
  // 2026-06-12 永続化: real モードは起動時に DB から復元。
  const [issues, setIssues] = useState<Issue[]>(
    isSupabaseConfigured() ? [] : initialIssues,
  );
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    fetchIssues()
      .then((rows) => {
        if (!cancelled) setIssues(rows);
      })
      .catch((err) => console.error("[課題] 一覧取得失敗:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResolveIssue = useCallback((issueId: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
              aiSuggestedClear: false,
              aiSuggestedClearReason: undefined,
            }
          : i,
      ),
    );
    if (isSupabaseConfigured()) {
      updateIssueStatus(issueId, "resolved").catch((err) =>
        console.error("[課題] 解決の保存失敗:", err),
      );
    }
  }, []);

  const handleReopenIssue = useCallback((issueId: string) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId ? { ...i, status: "open", resolvedAt: undefined } : i,
      ),
    );
    if (isSupabaseConfigured()) {
      updateIssueStatus(issueId, "open").catch((err) =>
        console.error("[課題] 再オープンの保存失敗:", err),
      );
    }
  }, []);

  // 宿題「AI と解く」(2026-06-11 grill 確定): 解説セッション末に葵が検知した
  // つまずきを Issue として自動登録する (監修なし、間違っていれば後で消せる)。
  // nodeId には概念名をそのまま入れる: 宿題は共有体系図 (KnowledgeNode) に紐付かないが、
  // IssueListView は未知 nodeId を「その文字列のまま」表示するため、概念名が出る。
  const handleAssignmentIssues = useCallback(
    (materialName: string, found: DetectedAssignmentIssue[]) => {
      if (found.length === 0) return;
      const now = new Date().toISOString();
      const stamp = Date.now();
      const created = found.map(
        (f, i): Issue => ({
          id: `issue-hw-${stamp}-${i}`,
          nodeId: f.concept,
          source: "ai-detected",
          title: f.title,
          detail: f.detail,
          status: "open",
          createdAt: now,
          occurrences: [
            {
              id: `occ-hw-${stamp}-${i}`,
              detectedAt: now,
              description: `宿題「${materialName}」の解説で見つかった`,
              source: "ai-detected",
            },
          ],
        }),
      );
      setIssues((prev) => [...created, ...prev]);
      // 2026-06-12 永続化: 失敗しても in-memory では生きている (ログのみ)。
      if (isSupabaseConfigured()) {
        void (async () => {
          try {
            const ownerId = await getCurrentUserId();
            await insertIssues(created, ownerId);
          } catch (err) {
            console.error("[課題] 自動登録の保存失敗:", err);
          }
        })();
      }
    },
    [],
  );

  const handleAppendChatMessages = useCallback(
    (issueId: string, msgs: IssueChatMessage[]) => {
      // 永続化用に追記後スレッドを state 更新の外で組み立てる (updater 内の副作用を避ける)。
      const target = issues.find((i) => i.id === issueId);
      const newThread = [...(target?.chatThread ?? []), ...msgs];
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId ? { ...i, chatThread: newThread } : i,
        ),
      );
      if (isSupabaseConfigured() && target) {
        updateIssueChatThread(issueId, newThread).catch((err) =>
          console.error("[課題] chat 保存失敗:", err),
        );
      }
    },
    [issues],
  );

  return {
    issues,
    handleResolveIssue,
    handleReopenIssue,
    handleAssignmentIssues,
    handleAppendChatMessages,
  };
}
