-- ============================================================================
-- 20260609020000_add_material_kind_assignment.sql
-- 教材に「種類 (kind)」と宿題・テスト用フィールドを追加 (2026-06-09、grill 確定)。
--
-- 教材を「長期の本 (テキスト/問題集)」だけでなく「宿題・テスト」も扱えるよう拡張する。
--   - kind="book"       … 既存の本 (既定)。本棚・まとまり・ガイド読書あり。
--   - kind="assignment" … 宿題・テスト。リスト表示、提出日・状態つき。重い処理オフ。
-- 既存教材はすべて book (default 'book')。assignment 用の列は book では null のまま。
--
-- ※ イシュー(=アプリ上の「課題」)とは別物。宿題・テストは「学校から来てアップして
--    AI と一緒に解くやること」。
-- ※ label は NOT NULL のままなので、assignment 行はアプリ側でプレースホルダ label を
--    入れる (assignment では label を表示に使わない)。
-- ============================================================================

alter table public.materials
  add column kind text not null default 'book'
    check (kind in ('book', 'assignment')),
  add column assignment_type text
    check (assignment_type in ('homework', 'test')),
  add column due_date date,
  add column assignment_status text
    check (assignment_status in ('todo', 'done'));

-- 種類で絞る一覧 (本棚 / 宿題・テスト) が多いのでインデックス。
create index materials_kind_idx on public.materials(kind);
