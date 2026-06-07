-- ============================================================================
-- 20260607000000_init_subjects.sql
-- 手動追加した科目 (subjects) を永続化する。
--
-- これまで「新規科目を追加」(SubjectSettingsPanel) は in-memory state + MOCK_SUBJECTS
-- へ push するだけで、リロードすると消えていた。さらにその科目に紐づけた教材
-- (materials.subject_id) は DB 行としては残るが、親の科目が消えるため UI 上で
-- 迷子になり「保存されていない」ように見えていた。本 migration でカスタム科目を
-- 永続化し、リロード後も科目とその教材が残るようにする。
--
-- 設計: ハードコード5教科 (英・数・国・理・社) はコード側 MOCK_SUBJECTS に残し
-- (先生アバター等がコード前提のため)、本テーブルには「ユーザーが手動追加した
-- カスタム科目」のみを保存する。起動時にこのテーブルを fetch して5教科にマージする。
--
-- 既存 20260605000000_init_materials.sql のパターンを踏襲:
--   - public.touch_updated_at()  … updated_at 自動更新トリガー (再利用)
--   - public.current_user_role() … RLS の admin 判定 (再利用)
-- ============================================================================

create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  -- 持ち主 (= その科目が誰の学習用か = 娘さん)。profiles 経由で auth.users を参照。
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  -- 先生の名前 (例: "ひろし")。表示は呼び出し側で「○○先生」に整形。
  teacher_name  text not null,
  -- アバターに表示する1文字 (通常は名前の頭文字)。
  avatar_letter text not null,
  -- 論理削除。値あり = 一覧から隠す。materials と同じ規約。
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index subjects_owner_idx on public.subjects(owner_id);

-- updated_at 自動更新 (既存関数を再利用)
create trigger subjects_touch_updated_at
  before update on public.subjects
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (materials と同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.subjects enable row level security;

create policy "subjects_select_own_or_admin"
  on public.subjects
  for select
  using (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

create policy "subjects_insert_own_or_admin"
  on public.subjects
  for insert
  with check (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

create policy "subjects_update_own_or_admin"
  on public.subjects
  for update
  using (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
  with check (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- DELETE ポリシーは作らない (物理削除しない。削除は deleted_at の UPDATE で行う)。
