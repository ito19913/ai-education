/**
 * issues リポジトリ (2026-06-12、client 用)
 *
 * Supabase の issues テーブルへの薄い CRUD。RLS が効くので browser client から
 * 直接呼んでよい (本人は自分の行、admin は全行)。DB 行 (snake_case) ⇔ Issue 型
 * (camelCase) の変換も担う。
 *
 * これまで Issue は in-memory のみ (リロードで消える) だったが、宿題「AI と解く」が
 * 解説セッション末につまずきを自動 Issue 化するようになったため永続化した。
 *
 * - fetchIssues       … 起動時に課題一覧を取得 (open が先、新しい順)
 * - insertIssues      … 一括登録 (id は client 生成の text をそのまま保存)
 * - updateIssueStatus … 解決 / 再オープン (resolved_at + AI 提案フラグの掃除)
 * - updateIssueChatThread … 課題 chat スレッドの全置換保存 (単一ユーザー前提)
 */
import { createClient } from "@/lib/supabase/client";
import type {
  Issue,
  IssueChatMessage,
  IssueOccurrence,
  IssueSource,
  IssueStatus,
} from "@/lib/learn/types";

/** issues テーブルの 1 行 (DB 形、snake_case)。 */
type IssueRow = {
  id: string;
  owner_id: string;
  node_id: string;
  source: string;
  title: string;
  detail: string | null;
  status: string;
  ai_suggested_clear: boolean;
  ai_suggested_clear_reason: string | null;
  trigger_message_id: string | null;
  summary: string | null;
  occurrences: IssueOccurrence[] | null;
  chat_thread: IssueChatMessage[] | null;
  created_at: string;
  resolved_at: string | null;
};

/** DB 行 → アプリの Issue 型へ変換。 */
function rowToIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    nodeId: row.node_id,
    source: row.source as IssueSource,
    title: row.title,
    detail: row.detail ?? undefined,
    status: row.status as IssueStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    aiSuggestedClear: row.ai_suggested_clear || undefined,
    aiSuggestedClearReason: row.ai_suggested_clear_reason ?? undefined,
    triggerMessageId: row.trigger_message_id ?? undefined,
    summary: row.summary ?? undefined,
    occurrences:
      row.occurrences && row.occurrences.length > 0
        ? row.occurrences
        : undefined,
    chatThread:
      row.chat_thread && row.chat_thread.length > 0
        ? row.chat_thread
        : undefined,
  };
}

/** Issue → DB 行 (insert 用)。 */
function issueToRow(issue: Issue, ownerId: string) {
  return {
    id: issue.id,
    owner_id: ownerId,
    node_id: issue.nodeId,
    source: issue.source,
    title: issue.title,
    detail: issue.detail ?? null,
    status: issue.status,
    ai_suggested_clear: issue.aiSuggestedClear ?? false,
    ai_suggested_clear_reason: issue.aiSuggestedClearReason ?? null,
    trigger_message_id: issue.triggerMessageId ?? null,
    summary: issue.summary ?? null,
    occurrences: issue.occurrences ?? [],
    chat_thread: issue.chatThread ?? [],
    created_at: issue.createdAt,
    resolved_at: issue.resolvedAt ?? null,
  };
}

/** 課題一覧を取得 (open が先、各グループ内は新しい順)。RLS で本人/admin 分のみ。 */
export async function fetchIssues(): Promise<Issue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .order("status", { ascending: false }) // 'resolved' < 'open' ではないので下の sort が本命
    .order("created_at", { ascending: false });
  if (error) throw error;
  const issues = (data as IssueRow[]).map(rowToIssue);
  // open を先頭に (一覧 UI の期待順)。
  return [
    ...issues.filter((i) => i.status === "open"),
    ...issues.filter((i) => i.status !== "open"),
  ];
}

/** 課題を一括登録 (宿題「AI と解く」のセッション末 自動 Issue 化など)。 */
export async function insertIssues(
  issues: Issue[],
  ownerId: string,
): Promise<void> {
  if (issues.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("issues")
    .insert(issues.map((i) => issueToRow(i, ownerId)));
  if (error) throw error;
}

/** 解決 / 再オープン。resolved_at と AI クリア提案フラグも同時に整える。 */
export async function updateIssueStatus(
  id: string,
  status: IssueStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("issues")
    .update(
      status === "resolved"
        ? {
            status,
            resolved_at: new Date().toISOString(),
            ai_suggested_clear: false,
            ai_suggested_clear_reason: null,
          }
        : { status, resolved_at: null },
    )
    .eq("id", id);
  if (error) throw error;
}

/** 課題 chat スレッドを全置換保存 (追記は state 側で済ませてから渡す)。 */
export async function updateIssueChatThread(
  id: string,
  chatThread: IssueChatMessage[],
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("issues")
    .update({ chat_thread: chatThread })
    .eq("id", id);
  if (error) throw error;
}
