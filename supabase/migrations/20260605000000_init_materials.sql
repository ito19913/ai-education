-- ============================================================================
-- 20260605000000_init_materials.sql
-- 教材 (materials) テーブル + RLS + Storage バケット (material-pdfs) をセットアップする。
-- 段階1-B「教材本文理解システム永続化」(2026-06-05、grill 確定)。
--
-- これまで教材 (Material)・体系図ノード (extractedNodes)・元 PDF はすべて in-memory
-- (TutorWorkspace の React state と session-pdf-store の Map) で、リロードで消えていた。
-- 本 migration で「教材 + 体系図ノード (JSONB) + 元 PDF (Storage)」を永続化する。
--
-- 既存 20260521000000_init_profiles.sql のパターンを踏襲:
--   - public.touch_updated_at()      … updated_at 自動更新トリガー (再利用)
--   - public.current_user_role()     … RLS の admin 判定 (再利用)
-- ============================================================================

-- ============================================================================
-- materials テーブル
--   1 冊 1 教材。PDF 実体は Storage に置き、ここにはパス (pdf_path) だけ持つ。
--   体系図ノード (extracted_nodes) は段階1 では教材から切り離して使わないため JSONB 列。
-- ============================================================================
create table public.materials (
  id               uuid primary key default gen_random_uuid(),
  -- 持ち主 (= その教材が誰の学習用か = 娘さん)。profiles 経由で auth.users を参照。
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  -- 科目はまだ DB テーブルに無い (ハードコード5教科) ので文字列で保持。
  subject_id       text not null,
  name             text not null,
  -- "テキスト" | "問題集" | "副教材"
  label            text not null,
  grade_level      text,
  -- 既存共有体系図ノードにマッチした ID 群 (string[])
  covered_node_ids jsonb not null default '[]'::jsonb,
  -- 目次から葵 AI が抽出した教材固有の体系図 (AiExtractedNode[])
  extracted_nodes  jsonb not null default '[]'::jsonb,
  -- Storage オブジェクトパス。アップロード完了で埋まる (それまで null)。
  pdf_path         text,
  pdf_size         bigint,
  -- 論理削除。値あり = ゴミ箱 (一覧から隠す)。PDF 実体は別途 Storage から削除する。
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index materials_owner_idx   on public.materials(owner_id);
create index materials_subject_idx on public.materials(subject_id);

-- updated_at 自動更新 (既存関数を再利用)
create trigger materials_touch_updated_at
  before update on public.materials
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (profiles の型に揃える: 本人は自分の行、admin は全行)
-- ============================================================================
alter table public.materials enable row level security;

-- SELECT: 自分が持ち主の教材、または admin (親) は全部
create policy "materials_select_own_or_admin"
  on public.materials
  for select
  using (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- INSERT: 自分を持ち主にした行、または admin
create policy "materials_insert_own_or_admin"
  on public.materials
  for insert
  with check (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- UPDATE: pdf_path 更新・論理削除に使う。本人または admin。
create policy "materials_update_own_or_admin"
  on public.materials
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

-- ============================================================================
-- Storage バケット material-pdfs (private)
--   オブジェクトパス規約 = `${owner_id}/${material_id}.pdf` (先頭フォルダ = owner_id)。
--   file_size_limit は 256MB (自炊スキャン 186MB が通るように)。
--   ※ Supabase 無料プランは 1 ファイル 50MB 上限のため、Pro プランが前提。
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('material-pdfs', 'material-pdfs', false, 268435456)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      public = excluded.public;

-- Storage RLS: 先頭フォルダ (= owner_id) が本人、または admin のみ読み書き可。
create policy "material_pdfs_select_own_or_admin"
  on storage.objects
  for select
  using (
    bucket_id = 'material-pdfs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() = 'admin'
    )
  );

create policy "material_pdfs_insert_own_or_admin"
  on storage.objects
  for insert
  with check (
    bucket_id = 'material-pdfs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() = 'admin'
    )
  );

create policy "material_pdfs_update_own_or_admin"
  on storage.objects
  for update
  using (
    bucket_id = 'material-pdfs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() = 'admin'
    )
  );

create policy "material_pdfs_delete_own_or_admin"
  on storage.objects
  for delete
  using (
    bucket_id = 'material-pdfs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() = 'admin'
    )
  );
