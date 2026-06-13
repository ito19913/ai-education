-- ============================================================================
-- 20260613000100_init_segmentation_jobs.sql
-- まとまり生成ジョブのキュー (2026-06-13、grill 確定)。
--
-- Supabase pg_cron が毎分 Vercel の Route Handler (/api/cron/segment) を叩き、
-- このテーブルから 1 ジョブを claim して時間制限内で 1 チャンク処理 → 進捗を保存する
-- (再開可能)。スキャン本は cursor/partial_segments を貯めてチャンク継続する。
--
-- RLS: enqueue (insert) のみクライアント (本人/admin) に許可。claim/update/complete は
-- service-role (Cron ワーカー) が RLS をバイパスして行うため SELECT/UPDATE/DELETE
-- ポリシーは作らない (状態はクライアントには materials.segment_status で見せる)。
-- ============================================================================
create table public.segmentation_jobs (
  id               uuid primary key default gen_random_uuid(),
  material_id      uuid not null references public.materials(id) on delete cascade,
  -- 持ち主 (RLS バイパスのワーカーは owner_id をこの行から押印する)。
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  -- 'digital' | 'scan' (ワーカーが PDF を覗いて確定。enqueue 時は 'unknown' で可)。
  kind             text not null default 'unknown',
  -- queued | processing | ready | failed
  status           text not null default 'queued',
  total_pages      int  not null default 0,
  -- スキャン本のチャンク継続: 次に処理する PDF 紙番号 (1-indexed)。
  cursor           int  not null default 1,
  -- tick 間に貯めるスキャン区切りの中間結果 (ScanVisionSegment[])。完走時に一括マージ。
  partial_segments jsonb not null default '[]'::jsonb,
  attempts         int  not null default 0,
  -- これを過ぎたら他 tick が奪える (掴んだまま死んだ tick の救済)。
  lease_until      timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- claim 用: 取得可能なジョブを絞り込む部分インデックス。
create index segmentation_jobs_claimable_idx
  on public.segmentation_jobs (created_at)
  where status in ('queued', 'processing');

-- ★二重キュー防止★: 1 教材につき走行中 (queued|processing) のジョブは 1 つだけ。
-- enqueue が衝突したらクライアントは「既にキュー済み」として握り潰す。
create unique index segmentation_jobs_one_active_per_material
  on public.segmentation_jobs (material_id)
  where status in ('queued', 'processing');

-- updated_at 自動更新 (既存関数を再利用)。
create trigger segmentation_jobs_touch_updated_at
  before update on public.segmentation_jobs
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS: enqueue (insert) のみ本人/admin。読み書きはワーカー (service-role) 専用。
-- ============================================================================
alter table public.segmentation_jobs enable row level security;

create policy "segmentation_jobs_insert_own_or_admin"
  on public.segmentation_jobs
  for insert
  with check (
    owner_id = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- SELECT / UPDATE / DELETE ポリシーは作らない (service-role がバイパスして担う)。
