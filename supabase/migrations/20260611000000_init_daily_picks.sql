-- ============================================================================
-- 20260611000000_init_daily_picks.sql
-- 「その日決める枠」の pick (Phase B 勉強開始 chat 儀式、2026-06-11 grill B-1〜B-8 確定)。
--
--   - pick = 子がゆいとの「おかえり、今日なにやる?」儀式で選んだ 1 件。
--     宿題・テスト (segment_id null) or プラン外の本のまとまり (segment_id あり)。
--   - 完了フラグは持たない (B-4)。「済み」は導出する:
--       宿題 → materials.assignment_status = 'done'
--       まとまり → そのまとまりのレジュメ (note_entries) が understood
--     completed_at は「完了を観測した時刻」のキャッシュ (✓ を完了当日だけ見せて
--     翌日消すための表示用。真実の情報源は宿題 status / レジュメ)。
--   - 持ち越し (B-5): 完了するか、子が「やめとく」(removed_at) で外すまで残る。
--     否定バッジは付けない。完了当日は ✓ 表示 → 翌日自動で消える (client 側で
--     completed_at < 今日 の行に removed_at を入れて掃除する)。
--
-- 既存テーブルと同じ owner モデル + RLS。
-- ============================================================================

create table public.daily_picks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  -- 選んだ対象 (宿題・テスト or 本)。教材が消えたら pick も消える。
  material_id  uuid not null references public.materials(id) on delete cascade,
  -- 本のまとまり (ConceptSegment.id、教材内ユニークな "seg-1" 等)。null = 宿題・テスト pick。
  segment_id   text,
  -- 完了を観測した時刻 (導出結果のキャッシュ。null = 未完了 or 未観測)
  completed_at timestamptz,
  -- 子が「やめとく」で外した時刻 (論理削除)
  removed_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index daily_picks_owner_idx    on public.daily_picks(owner_id);
create index daily_picks_material_idx on public.daily_picks(material_id);

-- ============================================================================
-- RLS (既存テーブルと同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.daily_picks enable row level security;

create policy "daily_picks_select_own_or_admin"
  on public.daily_picks
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "daily_picks_insert_own_or_admin"
  on public.daily_picks
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "daily_picks_update_own_or_admin"
  on public.daily_picks
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (論理削除のみ)。
