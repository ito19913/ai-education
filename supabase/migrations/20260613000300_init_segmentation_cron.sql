-- ============================================================================
-- 20260613000300_init_segmentation_cron.sql
-- まとまり生成ジョブのドライバ: Supabase pg_cron が毎分 Vercel の Route Handler を叩く。
-- (2026-06-13、grill 確定: Vercel プラン非依存・Supabase 内完結)
--
-- ★このファイルを適用する前に (ユーザー側作業)★
--   1. Supabase ダッシュボード → Database → Extensions で `pg_cron` と `pg_net` を有効化。
--   2. シークレットと宛先 URL を DB 設定に投入 (git に秘密を載せないため SQL に直書きしない):
--        alter database postgres set app.cron_secret      = '<CRON_SECRET と同じ値>';
--        alter database postgres set app.cron_target_url  = 'https://<本番ドメイン>/api/cron/segment';
--      (Vercel 側にも環境変数 CRON_SECRET を同じ値で設定する)
--   3. 設定後、この migration を適用する。設定前に適用しても無害 (空 auth で 401 になるだけ)。
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 既存スケジュールがあれば貼り直す (再適用で重複しないように)。
do $$
begin
  perform cron.unschedule('segment-tick');
exception when others then
  -- 未登録なら無視。
  null;
end;
$$;

-- 毎分 Vercel の Route Handler を叩く。URL/シークレットは DB 設定から実行時に読む。
select cron.schedule(
  'segment-tick',
  '* * * * *',
  $cron$
  select net.http_post(
    url     := current_setting('app.cron_target_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), '')
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
