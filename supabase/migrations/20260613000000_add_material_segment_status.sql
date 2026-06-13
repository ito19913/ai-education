-- ============================================================================
-- 20260613000000_add_material_segment_status.sql
-- まとまり生成のサーバー側ジョブ化 (2026-06-13、grill 確定)。
--
-- まとまり (concept_segments) の生成をブラウザからサーバー側バックグラウンドジョブに
-- 移すにあたり、教材に生成状態を持たせる。本棚バッジ・読書ビュー「準備中」・
-- 教材詳細「区切り直す」がこの列を見て出し分ける。
--
--   'ready'      … 生成済み (既存教材は concept_segments があるので default ready)
--   'queued'     … ジョブ登録済み・未着手
--   'processing' … ジョブ処理中 (スキャン本はチャンク継続中)
--   'failed'     … 最終失敗 (手動リトライ可、読書は手めくりで可)
-- ============================================================================
alter table public.materials
  add column segment_status text not null default 'ready';

comment on column public.materials.segment_status is
  'まとまり生成の状態 (queued|processing|ready|failed)。サーバー側ジョブ (segmentation_jobs) が更新。既存教材は ready 既定。';
