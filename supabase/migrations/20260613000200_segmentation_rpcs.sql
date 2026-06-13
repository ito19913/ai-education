-- ============================================================================
-- 20260613000200_segmentation_rpcs.sql
-- まとまり生成ジョブの claim / complete RPC (2026-06-13)。
--
-- Cron ワーカー (service-role) から呼ぶ。PostgREST のクエリビルダでは
-- `FOR UPDATE SKIP LOCKED` や「update + delete を 1 トランザクション」を表現できないため
-- 関数化する。SECURITY DEFINER + service_role にのみ EXECUTE 許可。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- claim_segmentation_job: 取得可能なジョブを 1 件 atomically に掴んで processing に。
--   - queued、または lease 切れの processing (掴んだまま死んだ tick の救済) が対象。
--   - attempts >= 5 は諦め (暴走/恒久失敗の停止)。
--   - SKIP LOCKED で多重 tick が別ジョブを掴む (空振りなら 0 行)。
--   - 掴んだ行に lease_until=now()+3min、attempts+1 をセットして返す。
-- ----------------------------------------------------------------------------
create or replace function public.claim_segmentation_job()
returns public.segmentation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.segmentation_jobs;
begin
  update public.segmentation_jobs j
  set status      = 'processing',
      lease_until = now() + interval '3 minutes',
      attempts    = j.attempts + 1,
      updated_at  = now()
  where j.id = (
    select id from public.segmentation_jobs
    where status in ('queued', 'processing')
      and (lease_until is null or lease_until < now())
      and attempts < 5
    order by created_at
    for update skip locked
    limit 1
  )
  returning j.* into claimed;

  return claimed; -- 掴めなければ NULL 行 (呼び出し側で id null を即 return 判定)
end;
$$;

-- ----------------------------------------------------------------------------
-- complete_segmentation_job: 完走時に materials を原子的に差し替えて job を削除。
--   - 走行中は materials.concept_segments を触らない設計なので、ここで初めてコミット
--     = 「再区切り中も古い単元が使えて、完走時に差し替わる」が満たされる。
--   - material は id + owner_id の二重縛り (job 行由来の owner_id を渡す)。
-- ----------------------------------------------------------------------------
create or replace function public.complete_segmentation_job(
  p_job_id      uuid,
  p_material_id uuid,
  p_owner_id    uuid,
  p_segments    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.materials
  set concept_segments = p_segments,
      segment_status   = 'ready',
      updated_at       = now()
  where id = p_material_id
    and owner_id = p_owner_id;

  delete from public.segmentation_jobs where id = p_job_id;
end;
$$;

-- 実行はワーカー (service_role) のみ。クライアント (authenticated/anon) には渡さない。
revoke all on function public.claim_segmentation_job() from public;
revoke all on function public.complete_segmentation_job(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.claim_segmentation_job() to service_role;
grant execute on function public.complete_segmentation_job(uuid, uuid, uuid, jsonb) to service_role;
