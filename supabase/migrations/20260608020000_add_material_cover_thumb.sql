-- ============================================================================
-- 20260608020000_add_material_cover_thumb.sql
-- materials に cover_thumb (表紙サムネの data URL) 列を追加する (2026-06-08)。
--
-- 教材一覧 (MaterialsListPane) に、各教材の表紙 (PDF 1 ページ目) の小さな
-- サムネイルを出す (ito19 さん意見)。PDF を読んだ時 (登録時 / 読書ビューを開いた時)
-- に 1 回だけ pdf.js で 1 ページ目を小さく描画し、data URL (image/jpeg base64) として
-- ここに保存する。一覧はこの列を <img> でそのまま出すだけ (PDF を読み込まず軽い)。
--
-- 1 枚 ~10KB 程度の小さな JPEG なので text 列で十分。null = まだ未生成 (アイコン表示)。
-- RLS は materials の既存ポリシーがそのまま効くため変更不要。
-- ============================================================================

alter table public.materials
  add column cover_thumb text;

comment on column public.materials.cover_thumb is
  '表紙サムネ (PDF 1 ページ目の小さな JPEG data URL、2026-06-08)。PDF を読んだ時に 1 回生成。null = 未生成。';
