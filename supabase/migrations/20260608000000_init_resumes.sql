-- ============================================================================
-- 20260608000000_init_resumes.sql
-- レジュメ(冊)管理 R10 Phase 1 (2026-06-08、grill 確定)。
--
-- レジュメ構想では「成果物 = レジュメ(冊)」で、まとめた概念ピース (note_entries) が
-- 冊に溜まって 1 つの体系になる。ito19 さん (会計士) の実体験で「1 科目 = 1 冊が原則」。
-- 本 migration で「冊」のエンティティ (resumes) を追加し、各概念ピース
-- (note_entries) がどの冊に属すかを resume_id で持たせる。
--
-- 設計 (R10 grill 確定):
--   - 原則 1 科目 1 冊。科目を使い始めるとデフォルト冊 1 つがオンデマンドで自動作成される
--     (起動時一括ではなく、ResumePane が保存する直前に ensureDefaultResume で作る)。
--   - subject_id は text (note_entries と同型)。ハードコード5教科 ("subj-english" 等) と
--     カスタム科目 (subjects テーブルの uuid) の両方を受けるため uuid FK にはしない。
--   - is_default = true の冊は Phase 2 で削除不可保護する (科目に常に最低1冊+デフォルト1つ)。
--   - 既存ピース (resume_id null) は、その科目のデフォルト冊が ensure された時に
--     まとめて backfill される (オンデマンド)。表示は subject_id で絞るため、
--     resume_id が null のままでも Phase 1 の一覧表示は成立する。
--
-- 既存 20260605100000_init_note_entries.sql / 20260607000000_init_subjects.sql の
-- パターンを踏襲:
--   - public.touch_updated_at()   … updated_at 自動更新 (再利用)
--   - public.current_user_role()  … RLS の admin 判定 (再利用)
-- ============================================================================

create table public.resumes (
  id          uuid primary key default gen_random_uuid(),
  -- 持ち主 (= 娘さん)。note_entries / subjects と同じ owner モデル。
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  -- 科目 (R10: 1科目1冊が原則)。ハードコード科目もカスタム科目も受けるため text。
  subject_id  text not null,
  -- 冊名 (例: "英語レジュメ")。Phase 2 でリネーム可。
  name        text not null,
  -- デフォルト冊か (R10: 「レジュメにする」は自動でデフォルト冊に付く、削除不可保護)。
  is_default  boolean not null default false,
  -- 論理削除。値あり = 一覧から隠す。materials / subjects と同じ規約。
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index resumes_owner_idx   on public.resumes(owner_id);
create index resumes_subject_idx on public.resumes(subject_id);

create trigger resumes_touch_updated_at
  before update on public.resumes
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- note_entries に resume_id を追加 (どの冊に属すか)。
-- 冊が消えても概念ピースは残せるよう set null (Phase 2 の冊削除を想定)。
-- 既存行は null で始まり、ensureDefaultResume の backfill でデフォルト冊へ移行する。
-- ============================================================================
alter table public.note_entries
  add column resume_id uuid references public.resumes(id) on delete set null;

create index note_entries_resume_idx on public.note_entries(resume_id);

-- ============================================================================
-- RLS (note_entries / subjects と同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.resumes enable row level security;

create policy "resumes_select_own_or_admin"
  on public.resumes
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "resumes_insert_own_or_admin"
  on public.resumes
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "resumes_update_own_or_admin"
  on public.resumes
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (物理削除しない、削除は deleted_at の UPDATE で行う)。
