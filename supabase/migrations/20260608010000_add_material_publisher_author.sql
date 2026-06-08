-- ============================================================================
-- 20260608010000_add_material_publisher_author.sql
-- materials に publisher (出版社) / author (著者) 列を追加する (2026-06-08)。
--
-- 教材詳細のメタ情報を「教材名 / 出版社 / 著者」で表示・編集できるようにする
-- (ito19 さん意見)。登録時の AI メタ自動検知 (detect-meta-claude) でも表紙・奥付から
-- 出版社・著者を拾ってプリセットし、編集ダイアログで手直しできる。
--
-- どちらも null 許容 (拾えなかった / 入力していない教材は null)。RLS は materials の
-- 既存ポリシーがそのまま効くため変更不要。
-- ============================================================================

alter table public.materials
  add column publisher text,
  add column author text;

comment on column public.materials.publisher is
  '出版社 (2026-06-08)。AI メタ検知または手入力。null = 未設定。';
comment on column public.materials.author is
  '著者 (2026-06-08)。AI メタ検知または手入力。null = 未設定。';
