-- ============================================================================
-- 20260606010000_add_note_source_segment.sql
-- note_entries に source_segment_id (text) 列を 1 本追加する。
-- まとめノートの「まとまり」区切り (M1、2026-06-06)。
--
-- 「このノートはどの まとまり (ConceptSegment) から刻んだか」を機械可読に持つ。
-- 縦スライダーの「ノート化済み緑チェック」(M5) はこの有無で判定する。
-- ConceptSegment は materials.concept_segments の JSONB 内 ID なので DB 制約 (FK) は
-- かけられない → text で持つ (既存 parent_ref と同じ割り切り)。RLS 変更不要。
-- ============================================================================

alter table public.note_entries
  add column source_segment_id text;

comment on column public.note_entries.source_segment_id is
  'このノートを刻んだ まとまり ConceptSegment.id (M1)。スライダーの緑チェック判定(M5)に使う。';
