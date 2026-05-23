/**
 * Subject history collector - 科目の先生との対話履歴を集約する utility（Phase 3 追加）。
 *
 * 指定 subject に属する全 ChatMessage（ノード対話）と
 * IssueChatMessage（課題 chat、Issue.chatThread に格納）を時系列降順で集約する。
 *
 * 集約の方針（grill-me 確定）:
 * - 含めるのは ChatMessage + IssueChatMessage の 2 種類のみ
 * - サマリーや NodeComprehension は含めない（別画面の責務）
 * - クリア済み Issue の chatThread も含める（読み返しの価値）
 * - ソート: createdAt 降順、同値時は id.localeCompare で安定化
 */
import type {
  ChatMessage,
  Issue,
  IssueChatMessage,
  KnowledgeNode,
} from "./types";
import { getNodeIdsForSubject } from "./subject-resolver";

/**
 * 1 件の履歴アイテム（ビュー専用、永続エンティティではない）。
 * 描画時にどちらの種別か switch するため `kind` を持つ。
 */
export type SubjectHistoryItem =
  | {
      kind: "node-chat";
      message: ChatMessage;
      nodeName: string;
    }
  | {
      kind: "issue-chat";
      message: IssueChatMessage;
      issue: Issue;
      nodeName: string;
    };

/**
 * 指定 subject に属する全対話を時系列降順で集約する。
 */
export function collectSubjectHistory(args: {
  subjectId: string;
  nodes: KnowledgeNode[];
  rootToSubject: Record<string, string>;
  chatMessages: ChatMessage[];
  issues: Issue[];
}): SubjectHistoryItem[] {
  const { subjectId, nodes, rootToSubject, chatMessages, issues } = args;

  const nodeIds = getNodeIdsForSubject(subjectId, nodes, rootToSubject);
  const nodeNameById = new Map(nodes.map((n) => [n.id, n.name]));

  const items: SubjectHistoryItem[] = [];

  // ノード対話を取り込む
  for (const msg of chatMessages) {
    if (!nodeIds.has(msg.nodeId)) continue;
    items.push({
      kind: "node-chat",
      message: msg,
      nodeName: nodeNameById.get(msg.nodeId) ?? msg.nodeId,
    });
  }

  // 課題 chat を取り込む（Issue.chatThread を展開）
  for (const issue of issues) {
    if (!nodeIds.has(issue.nodeId)) continue;
    if (!issue.chatThread || issue.chatThread.length === 0) continue;
    for (const msg of issue.chatThread) {
      items.push({
        kind: "issue-chat",
        message: msg,
        issue,
        nodeName: nodeNameById.get(issue.nodeId) ?? issue.nodeId,
      });
    }
  }

  // 時系列降順 + id で安定化
  items.sort((a, b) => {
    const cmp = b.message.createdAt.localeCompare(a.message.createdAt);
    if (cmp !== 0) return cmp;
    return b.message.id.localeCompare(a.message.id);
  });

  return items;
}

/**
 * 集約済み履歴に登場するノードを一覧で返す（フィルタチップに使う）。
 */
export function getNodesInHistory(
  items: SubjectHistoryItem[],
): Array<{ nodeId: string; nodeName: string; count: number }> {
  const counts = new Map<string, { nodeName: string; count: number }>();
  for (const item of items) {
    const nodeId =
      item.kind === "node-chat" ? item.message.nodeId : item.issue.nodeId;
    const entry = counts.get(nodeId) ?? { nodeName: item.nodeName, count: 0 };
    entry.count += 1;
    counts.set(nodeId, entry);
  }
  return Array.from(counts.entries())
    .map(([nodeId, v]) => ({ nodeId, nodeName: v.nodeName, count: v.count }))
    .sort((a, b) => b.count - a.count);
}
