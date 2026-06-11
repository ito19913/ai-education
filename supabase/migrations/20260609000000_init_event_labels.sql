-- ============================================================================
-- 20260609000000_init_event_labels.sql
-- 予定ラベル (2026-06-09、grill 確定)。
--
-- 「予定」を勉強専用から「何でも入る1本のカレンダー」に拡張する設計の土台。
-- ラベル = { 名前, 色(固定パレット), 種類 }。色つきで見分け、改名・追加・削除できる。
--   - kind="study"  … 勉強タスクが自動で紐づくシステムラベル。削除保護 (1つだけ)。
--   - kind="exam"   … 試験。リストで「あと◯日」カウントダウンを出す。
--   - kind="normal" … 締切・遊び・習い事・自作ラベル。
-- デフォルト5つ (勉強/試験/締切・提出/遊び・予定/習い事) はオンデマンドでシードする
-- (ensureDefaultEventLabels、起動時にラベルが0件なら作る)。
--
-- 既存の resumes / subjects / note_entries と同じ owner モデル + RLS + 論理削除。
-- ============================================================================

create table public.event_labels (
  id          uuid primary key default gen_random_uuid(),
  -- 持ち主 (= 娘さん)。他テーブルと同じ owner モデル。
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  -- ラベル名 (改名可。例「勉強」「遊び・予定」)。
  name        text not null,
  -- 色 (固定パレットのキー: "blue" | "violet" | ... )。アプリ側で enforce。
  color       text not null,
  -- 種類 (改名・色変更しても役割は kind で保つ)。
  kind        text not null default 'normal'
              check (kind in ('study', 'exam', 'normal')),
  -- 論理削除。値あり = 一覧から隠す。kind='study' は削除しない (アプリ側でガード)。
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index event_labels_owner_idx on public.event_labels(owner_id);

create trigger event_labels_touch_updated_at
  before update on public.event_labels
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (resumes / subjects と同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.event_labels enable row level security;

create policy "event_labels_select_own_or_admin"
  on public.event_labels
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "event_labels_insert_own_or_admin"
  on public.event_labels
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "event_labels_update_own_or_admin"
  on public.event_labels
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (物理削除しない、削除は deleted_at の UPDATE で行う)。
