-- ============================================================================
-- 20260521000000_init_profiles.sql
-- profiles テーブルと RLS、自動 profile 作成 trigger をセットアップする。
-- AI-Education プロジェクトの最初の migration。
-- ============================================================================

-- ロール enum
-- admin: ito19 さん（管理者、教科書アップロード、体系図監修、全進捗閲覧）
-- learner: 娘さん（学習者、自分のデータのみ）
create type public.user_role as enum ('admin', 'learner');

-- プロフィールテーブル
-- auth.users の拡張。アプリ固有のメタデータ（role / display_name 等）を持つ。
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null default 'learner',
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- updated_at 自動更新トリガー
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 現在ログイン中のユーザーの role を返す SECURITY DEFINER 関数。
-- RLS ポリシー内で profiles を再帰的に参照するのを避けるために使う。
-- ============================================================================
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ============================================================================
-- RLS（Row Level Security）
-- ============================================================================
alter table public.profiles enable row level security;

-- 自分の profile は SELECT 可能
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- admin は全 profile を SELECT 可能（娘さんの進捗を見るため）
create policy "profiles_select_all_for_admin"
  on public.profiles
  for select
  using (public.current_user_role() = 'admin');

-- 自分の display_name のみ UPDATE 可能（role は別途トリガーで保護）
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- learner が自分の role を 'admin' に書き換えるのを防ぐトリガー
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 同一ユーザーの操作で role を変えようとした場合は拒否
  if auth.uid() = new.id and new.role is distinct from old.role then
    raise exception 'role の自己変更は許可されていません';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- INSERT は trigger（handle_new_user）経由のみ。明示的なポリシーを作らない。
-- DELETE も無し（auth.users が消えたら ON DELETE CASCADE で消える）。

-- ============================================================================
-- auth.users へのユーザー作成時、自動で profiles を作成する trigger
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 既存ユーザー（手動で Add user した 2 人）に profile を割り当てる
-- ============================================================================
-- ito19 さん（admin 役）
insert into public.profiles (id, role, display_name)
select id, 'admin'::public.user_role, 'ito19'
from auth.users
where email = 'ito19913@gmail.com'
on conflict (id) do update set role = 'admin', display_name = excluded.display_name;

-- 娘さん（learner 役）
insert into public.profiles (id, role, display_name)
select id, 'learner'::public.user_role, '娘さん'
from auth.users
where email = 'hanaemao.ito@gmail.com'
on conflict (id) do update set role = 'learner', display_name = excluded.display_name;
