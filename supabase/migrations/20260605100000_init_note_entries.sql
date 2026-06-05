-- ============================================================================
-- 20260605100000_init_note_entries.sql
-- note_entries テーブル + RLS をセットアップする。
-- まとめノート構想 N9① 縦切り MVP (2026-06-05、grill N1-N9 確定)。
--
-- 「学習した概念を、子が AI 対話 (能動ゲート) で理解してから刻む」まとめノートの
-- エントリ本体。1 エントリ = 概念 (N1) + AI 要約 (N3、正しい内容) + 出典 (N5、教材+ページ)
-- + 自分メモ (N7) + 理解ステータス (N8、MVP は 'understood' のみ)。
--
-- 既存 20260605000000_init_materials.sql のパターンを踏襲:
--   - public.touch_updated_at()   … updated_at 自動更新 (再利用)
--   - public.current_user_role()  … RLS の admin 判定 (再利用)
-- ============================================================================

create table public.note_entries (
  id                 uuid primary key default gen_random_uuid(),
  -- 持ち主 (= 娘さん)。materials と同じ owner モデル。
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  -- 科目 (N4: 科目はまたがない、MVP は英語)。科目テーブルは無いので文字列。
  subject_id         text not null,
  -- 論点名 (N1: 概念単位)。
  concept_name       text not null,
  -- AI が作る正しい要約 (N3: 本体、子の言葉ベースにしない)。
  ai_summary         text not null,
  -- 理解ステータス (N8)。MVP は 'understood' のみ生成。'open' = 未理解(=Issue) は N9②。
  status             text not null default 'understood',
  -- 出典 (N5): 教材 + ページ範囲。教材が消えても残せるよう set null。
  source_material_id uuid references public.materials(id) on delete set null,
  source_page_range  text,
  -- ノート体系図③の親 (概念階層、null = root)。
  parent_ref         text,
  -- 子の自分メモ (N7: 本体は守り、子はメモで所有)。
  user_note          text,
  -- 論理削除 (N7: 子は削除/非表示できる)。
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index note_entries_owner_idx   on public.note_entries(owner_id);
create index note_entries_subject_idx on public.note_entries(subject_id);

create trigger note_entries_touch_updated_at
  before update on public.note_entries
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (materials と同型: 本人は自分の行、admin は全行)
-- ============================================================================
alter table public.note_entries enable row level security;

create policy "note_entries_select_own_or_admin"
  on public.note_entries
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "note_entries_insert_own_or_admin"
  on public.note_entries
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "note_entries_update_own_or_admin"
  on public.note_entries
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (物理削除しない、削除は deleted_at の UPDATE で行う)。
