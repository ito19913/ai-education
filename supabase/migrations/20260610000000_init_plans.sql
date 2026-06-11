-- ============================================================================
-- 20260610000000_init_plans.sql
-- 新プラン (ザックリ・まとまりキュー型、2026-06-10 grill 確定)。
--
-- 旧 Plan Engine (Phase 5、全モック・予定表型) を丸ごと廃棄してゼロベースで置き換え。
--   - プラン = 教材単位。「プランに組み込む」+ 期間 (チェックポイント日) を選ぶだけで成立。
--   - キュー = 教材のまとまり (materials.concept_segments) を上から順。
--   - 「済み」はプラン側に持たない。レジュメ (note_entries の understood) から導出する
--     (レジュメが真実の情報源)。プランが持つのは「手動スキップした まとまり id」だけ。
--   - count_from: 済みに数えるレジュメの起点。null = 全期間 (作成前の理解済みも数える)。
--     「最初からやり直す (2周目)」では now() を入れ、それ以降に更新されたレジュメのみ数える。
--   - 期限 (ends_at) はチェックポイント。過ぎてもプランは止まらず、カードが
--     3 択 (延長 = ends_at 更新 / 終了 = status completed / 最初から = 新プラン) になる。
--
-- 既存テーブルと同じ owner モデル + RLS + 論理削除。
-- ============================================================================

create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles(id) on delete cascade,
  -- 科目 (教材の subject_id と同じ値を非正規化。ハードコード/カスタム両対応のため text)
  subject_id           text not null,
  -- 対象教材 (1 プラン = 1 教材)。教材が消えたらプランも消える。
  material_id          uuid not null references public.materials(id) on delete cascade,
  -- チェックポイント日 (YYYY-MM-DD)
  ends_at              date not null,
  status               text not null default 'active'
                       check (status in ('active', 'completed')),
  -- 手動スキップした まとまり (ConceptSegment.id) の配列
  skipped_segment_ids  jsonb not null default '[]'::jsonb,
  -- 済みに数えるレジュメの起点 (null = 全期間)。2周目 (最初からやり直す) で now() を入れる。
  count_from           timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index plans_owner_idx    on public.plans(owner_id);
create index plans_material_idx on public.plans(material_id);

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (既存テーブルと同型: 本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.plans enable row level security;

create policy "plans_select_own_or_admin"
  on public.plans
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "plans_insert_own_or_admin"
  on public.plans
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "plans_update_own_or_admin"
  on public.plans
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (論理削除のみ)。
