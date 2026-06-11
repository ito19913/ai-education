-- ============================================================================
-- 20260610010000_init_learning_logs.sql
-- 学習履歴 (出来事ログ + 学習時間、2026-06-10 grill 確定)。
--
-- 今日のタスクは「任意」、履歴は「自動・必須」。タスクを作らず学習しても、
-- 実アクションへのフックで勝手に記録される。
--   - learning_logs: 出来事 1 行 (読んだ / レジュメ途中 / 仕上げた / 振り返り昇格 / 宿題やった)。
--     不変ログなので update しない (insert + select のみ)。
--   - study_minutes: 日 × 教材 の学習分数。読書ビューのアクティブ 1 分ごとに +1 する
--     ハートビート方式 (セッション開始/終了の境界問題を構造的に避ける)。
--
-- 既存テーブルと同じ owner モデル + RLS。
-- ============================================================================

create table public.learning_logs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  kind        text not null
              check (kind in ('read', 'resume-draft', 'resume-done', 'review-promote', 'assignment-done')),
  subject_id  text not null,
  -- 教材が消えても履歴は残す (set null)
  material_id uuid references public.materials(id) on delete set null,
  -- まとまり (ConceptSegment.id、read/resume 系)
  segment_id  text,
  -- 人が読むラベルのスナップショット (まとまり名・宿題名など)
  title       text not null,
  created_at  timestamptz not null default now()
);

create index learning_logs_owner_idx   on public.learning_logs(owner_id);
create index learning_logs_created_idx on public.learning_logs(created_at desc);

alter table public.learning_logs enable row level security;

create policy "learning_logs_select_own_or_admin"
  on public.learning_logs
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "learning_logs_insert_own_or_admin"
  on public.learning_logs
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- 不変ログ: UPDATE / DELETE ポリシーは作らない。

-- ============================================================================
-- study_minutes: 日 × 教材 の学習分数 (ハートビートで +1)
-- ============================================================================
create table public.study_minutes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  -- ローカル日付 (YYYY-MM-DD、クライアントが確定して送る)
  day         date not null,
  subject_id  text not null,
  material_id uuid references public.materials(id) on delete set null,
  minutes     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1 日 × 1 教材 で 1 バケット
create unique index study_minutes_bucket_uidx
  on public.study_minutes(owner_id, day, material_id);
create index study_minutes_owner_idx on public.study_minutes(owner_id);

create trigger study_minutes_touch_updated_at
  before update on public.study_minutes
  for each row execute function public.touch_updated_at();

alter table public.study_minutes enable row level security;

create policy "study_minutes_select_own_or_admin"
  on public.study_minutes
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "study_minutes_insert_own_or_admin"
  on public.study_minutes
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "study_minutes_update_own_or_admin"
  on public.study_minutes
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');
