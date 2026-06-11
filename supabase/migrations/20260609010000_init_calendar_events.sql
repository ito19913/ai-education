-- ============================================================================
-- 20260609010000_init_calendar_events.sql
-- 手動の予定イベント (2026-06-09、grill 確定)。
--
-- 子が自分で入れる「遊びの約束」「試験」「締切」などの予定。勉強タスク (ScheduleItem、
-- 当面モック) とこの calendar_events をラベル色でマージして 1 本のカレンダーに並べる。
--
-- 設計 (grill 確定):
--   - タイトル(必須) / 日付(必須) / ラベル(必須) / 時間(任意・終日OK) / メモ(任意)。
--   - ラベルは event_labels への参照。ラベルを論理削除しても予定は残せるよう、
--     label_id は on delete set null (物理削除はしないので実際は走らないが安全側)。
--   - 編集・削除できる (削除は deleted_at)。
--
-- 既存テーブルと同じ owner モデル + RLS + 論理削除。
-- ============================================================================

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  -- タイトル (必須)。
  title       text not null,
  -- 日付 (YYYY-MM-DD, ローカル日付)。date 型で持つ。
  event_date  date not null,
  -- どのラベルか。ラベルを消しても予定は残す (set null)。
  label_id    uuid references public.event_labels(id) on delete set null,
  -- 開始時刻 (任意、終日なら null)。"HH:MM"。
  start_time  text,
  -- メモ (任意)。
  memo        text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index calendar_events_owner_idx on public.calendar_events(owner_id);
create index calendar_events_date_idx  on public.calendar_events(event_date);

create trigger calendar_events_touch_updated_at
  before update on public.calendar_events
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS (本人は自分の行、admin (親) は全行)
-- ============================================================================
alter table public.calendar_events enable row level security;

create policy "calendar_events_select_own_or_admin"
  on public.calendar_events
  for select
  using (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "calendar_events_insert_own_or_admin"
  on public.calendar_events
  for insert
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

create policy "calendar_events_update_own_or_admin"
  on public.calendar_events
  for update
  using (owner_id = auth.uid() or public.current_user_role() = 'admin')
  with check (owner_id = auth.uid() or public.current_user_role() = 'admin');

-- DELETE ポリシーは作らない (論理削除のみ)。
