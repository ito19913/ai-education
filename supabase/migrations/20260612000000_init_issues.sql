-- ============================================================================
-- 20260612000000_init_issues.sql
-- 課題 (Issue) の永続化 (2026-06-12)。
--
-- これまで Issue は in-memory のみ (MOCK_ISSUES + セッション中の追加) でリロードで
-- 消えていた。宿題「AI と解く」(2026-06-11) が解説セッション末につまずきを自動
-- Issue 化するようになり、消えると価値が失われるため永続化する。
--
--   - id は text (client 生成: "issue-hw-{ts}-{n}" 等)。mock の "issue-1" 系は
--     mock モード専用で DB には入れない。
--   - node_id は text: 共有体系図 (KnowledgeNode) の id か、宿題由来は概念名そのまま
--     (IssueListView が未知 nodeId を文字列のまま表示する仕様を利用)。
--   - occurrences / chat_thread は JSONB (アプリ型 IssueOccurrence[] /
--     IssueChatMessage[] をそのまま)。chat_thread は全置換更新 (単一ユーザー前提)。
--
-- 既存テーブルと同じ owner モデル + RLS。
-- ============================================================================

create table public.issues (
  id                        text primary key,
  owner_id                  uuid not null references public.profiles(id) on delete cascade,
  node_id                   text not null,
  source                    text not null default 'ai-detected',  -- 'self' | 'ai-detected'
  title                     text not null,
  detail                    text,
  status                    text not null default 'open',         -- 'open' | 'resolved'
  ai_suggested_clear        boolean not null default false,
  ai_suggested_clear_reason text,
  trigger_message_id        text,
  summary                   text,
  occurrences               jsonb not null default '[]'::jsonb,
  chat_thread               jsonb not null default '[]'::jsonb,
  created_at                timestamptz not null default now(),
  resolved_at               timestamptz
);

create index issues_owner_idx  on public.issues(owner_id);
create index issues_status_idx on public.issues(owner_id, status);

-- ============================================================================
-- RLS (既存テーブルと同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.issues enable row level security;

create policy "issues_select_own_or_admin"
  on public.issues
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "issues_insert_own_or_admin"
  on public.issues
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "issues_update_own_or_admin"
  on public.issues
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (解決は status='resolved'、物理削除しない)。
