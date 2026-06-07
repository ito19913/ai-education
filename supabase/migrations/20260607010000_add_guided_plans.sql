-- ============================================================================
-- 20260607010000_add_guided_plans.sql
-- materials に guided_plans (JSONB) 列を 1 本追加する。
-- AI 主導ガイド読書のブロックプラン永続化 (G-A、2026-06-07)。
--
-- これまでガイドプラン (GuidedBlock[]) は概念を開くたび Opus vision で作り直し、
-- session メモリにしか持っていなかった (リロードで消える・非決定的)。
-- ブロック ID は生成順依存なので、作り直すと「子が手で動かした青枠 (bbox)」が
-- 別のブロックに当たってしまい、手動調整値を保存しても意味を持たなかった。
--
-- そこでプランを概念 (ConceptSegment.id) ごと固定保存する:
--   ①高価な Opus vision を概念ごと 1 回で済ます (2 回目以降は即表示・無料)
--   ②子が直した青枠は該当ブロックの bbox に焼き込んで保存 → 次回も同じブロックに当たる
--
-- 形は { [segmentId]: GuidedBlock[] } の JSONB。RLS は materials の既存ポリシーが
-- そのまま効くため変更不要。null/未設定なら従来どおりオンデマンド生成にフォールバック。
-- ============================================================================

alter table public.materials
  add column guided_plans jsonb not null default '{}'::jsonb;

comment on column public.materials.guided_plans is
  'ガイド読書のブロックプラン {segmentId: GuidedBlock[]} (G-A、2026-06-07)。手動調整した青枠 bbox を該当ブロックに焼き込んで永続化。';
