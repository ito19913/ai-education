-- ============================================================================
-- 20260606000000_add_concept_segments.sql
-- materials に concept_segments (JSONB) 列を 1 本追加する。
-- まとめノートの「まとまり (一単元) = 1 概念」区切り (M1-M10、2026-06-06、grill 確定)。
--
-- 現状ノートは「今表示中ページ要約」になり「一単元 (まとまり) 要約」になっていない。
-- まとまり = 1 概念 = 1 ノート (M1) を、AI が中身を読んで PDF の紙番号で区切り (M3)、
-- 登録時バックグラウンドで全書ぶん保存する (M4)。読書ビューの単元提示・範囲要約・
-- 縦スライダー・N9④スケジュール配分の土台。
--
-- 既存 extracted_nodes (目次ベース・印刷番号) と意味の違う数値 (PDF 紙番号) なので、
-- 同じ列に混ぜず別列で持つ (混ぜると印刷⇄PDF ズレのバグが再発する)。
-- ConceptSegment[] (lib/learn/types.ts) を JSONB でそのまま格納。RLS は materials の
-- 既存ポリシーがそのまま効くため変更不要。
-- ============================================================================

alter table public.materials
  add column concept_segments jsonb not null default '[]'::jsonb;

comment on column public.materials.concept_segments is
  'まとまり(一単元=1概念)区切り ConceptSegment[]。PDF紙番号ベース(M3)。登録時バックグラウンド生成(M4)。';
