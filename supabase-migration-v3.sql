-- ============================================================================
-- Codeply Supabase migration v3 — COMPLETE, STANDALONE, IDEMPOTENT
-- ----------------------------------------------------------------------------
-- Run this ONE file in the Supabase SQL Editor and it sets up everything the
-- app + admin analytics dashboard need. Safe to run multiple times.
--
-- It folds together:
--   • base tables (from supabase-waitlist.sql)
--   • migration v2  (user_settings, usage_monthly, remote_config, admin, RPC)
--   • migration v3  (usage_events, country columns, dashboard aggregates)
--
-- Required Vercel env vars (unchanged):
--   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
--   WHOP_API_KEY, WHOP_STARTER_PLAN_ID, WHOP_PRO_PLAN_ID, WHOP_WEBHOOK_SECRET,
--   API_KEY_ENCRYPTION_SECRET (32+ chars), SITE_URL
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — BASE TABLES  (from supabase-waitlist.sql)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text not null unique,
  source text not null default 'codply_landing',
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  starter_provider text not null default 'openrouter' check (starter_provider in ('openrouter', 'groq')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'past_due', 'canceled')),
  whop_membership_id text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_api_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'claude', 'openrouter', 'groq', 'gemini', 'deepseek', 'qwen', 'custom')),
  encrypted_key text not null,
  key_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.webhook_events (
  id text primary key,
  type text,
  created_at timestamptz not null default now()
);

alter table public.waitlist_subscribers enable row level security;
alter table public.profiles            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.user_api_keys       enable row level security;
alter table public.webhook_events      enable row level security;

drop policy if exists "Allow public waitlist inserts" on public.waitlist_subscribers;
create policy "Allow public waitlist inserts"
  on public.waitlist_subscribers for insert to anon
  with check (
    email is not null
    and length(email) between 5 and 320
    and position('@' in email) > 1
  );


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — MIGRATION v2  (settings, usage, remote config, admin, RPC)
-- ════════════════════════════════════════════════════════════════════════════

-- profiles.is_admin — gates the admin panel + analytics dashboard
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- user_settings: every user input auto-saves here
create table if not exists public.user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  provider         text not null default 'openrouter',
  model            text not null default 'openai/gpt-4o-mini',
  theme            text not null default 'dark',
  hotkey           text not null default 'Alt+C',
  api_priority     jsonb not null default '[]'::jsonb,
  per_prompt_cap   integer not null default 0,
  monthly_cap      bigint  not null default 0,
  extra            jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

-- usage_monthly: cumulative token usage per user per month
create table if not exists public.usage_monthly (
  user_id    uuid not null references auth.users(id) on delete cascade,
  month      text not null,                       -- 'YYYY-MM'
  tokens     bigint  not null default 0,
  requests   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- remote_config: online control panel + kill switch
create table if not exists public.remote_config (
  id            integer primary key default 1 check (id = 1),
  kill_switch   boolean not null default false,
  min_version   text    not null default '0.0.0',
  update_banner text    not null default '',
  feature_flags jsonb   not null default '{}'::jsonb,
  free_mode     boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- Legacy compatibility tables (read by shipped builds / api/config.js)
create table if not exists public.app_config (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values ('kill_switch', 'false')
  on conflict (key) do nothing;

create table if not exists public.app_settings (
  id        integer primary key default 1 check (id = 1),
  free_mode boolean not null default false
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Seed remote_config from current live values so behavior doesn't change
insert into public.remote_config (id, kill_switch, free_mode)
values (
  1,
  coalesce((select value = 'true' from public.app_config where key = 'kill_switch'), false),
  coalesce((select free_mode from public.app_settings where id = 1), false)
)
on conflict (id) do nothing;

-- RLS
alter table public.user_settings  enable row level security;
alter table public.usage_monthly  enable row level security;
alter table public.remote_config  enable row level security;
alter table public.app_config     enable row level security;
alter table public.app_settings   enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "usage_select_own" on public.usage_monthly;
create policy "usage_select_own" on public.usage_monthly
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "remote_config_read_all" on public.remote_config;
create policy "remote_config_read_all" on public.remote_config
  for select to anon, authenticated using (true);
drop policy if exists "app_config_read_all" on public.app_config;
create policy "app_config_read_all" on public.app_config
  for select to anon, authenticated using (true);
drop policy if exists "app_settings_read_all" on public.app_settings;
create policy "app_settings_read_all" on public.app_settings
  for select to anon, authenticated using (true);

-- Admin helper used across policies
create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "remote_config_admin_write" on public.remote_config;
create policy "remote_config_admin_write" on public.remote_config
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
drop policy if exists "app_config_admin_write" on public.app_config;
create policy "app_config_admin_write" on public.app_config
  for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

-- Atomic usage accumulation (callable by the signed-in app)
create or replace function public.increment_usage(p_tokens bigint, p_requests integer default 1)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
begin
  if auth.uid() is null then return; end if;
  insert into public.usage_monthly (user_id, month, tokens, requests)
  values (auth.uid(), v_month, greatest(p_tokens, 0), greatest(p_requests, 0))
  on conflict (user_id, month) do update
    set tokens     = usage_monthly.tokens   + greatest(p_tokens, 0),
        requests   = usage_monthly.requests + greatest(p_requests, 0),
        updated_at = now();
end;
$$;
grant execute on function public.increment_usage(bigint, integer) to authenticated;

-- Owner read access for the desktop app
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Realtime: live-sync settings changed on the web dashboard
do $$
begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — MIGRATION v3  (analytics dashboard data)
-- ════════════════════════════════════════════════════════════════════════════

-- Country columns (filled from Vercel geo header x-vercel-ip-country)
alter table public.profiles             add column if not exists country text;
alter table public.waitlist_subscribers add column if not exists country text;

-- usage_events: one row per AI placement / call — powers peak hours, model
-- popularity (by real calls), country distribution, and "active now".
create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  model       text,
  provider    text,
  country     text,
  tokens      integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);
create index if not exists usage_events_model_idx      on public.usage_events (model);
create index if not exists usage_events_country_idx    on public.usage_events (country);
create index if not exists usage_events_user_idx       on public.usage_events (user_id);

alter table public.usage_events enable row level security;

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated using (auth.uid() = user_id);

-- Admin read access to the tables the dashboard aggregates (safety net;
-- the dashboard normally reads via /api/admin-stats with the service role).
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select to authenticated using (public.is_admin_user());

drop policy if exists "subscriptions_admin_read_all" on public.subscriptions;
create policy "subscriptions_admin_read_all" on public.subscriptions
  for select to authenticated using (public.is_admin_user());

drop policy if exists "usage_monthly_admin_read_all" on public.usage_monthly;
create policy "usage_monthly_admin_read_all" on public.usage_monthly
  for select to authenticated using (public.is_admin_user());

drop policy if exists "usage_events_admin_read_all" on public.usage_events;
create policy "usage_events_admin_read_all" on public.usage_events
  for select to authenticated using (public.is_admin_user());

-- Aggregate helpers used by /api/admin-stats.
-- These read from your REAL per-call log: public.usage_history.
create or replace function public.usage_by_hour(p_days integer default 30)
returns table (hour integer, calls bigint)
language sql stable security definer set search_path = public as $$
  select extract(hour from created_at at time zone 'UTC')::int as hour,
         count(*)::bigint as calls
  from public.usage_history
  where created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by 1 order by 1;
$$;

create or replace function public.usage_by_model(p_days integer default 30, p_limit integer default 8)
returns table (model text, calls bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(model, 'unknown') as model, count(*)::bigint as calls
  from public.usage_history
  where created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by 1 order by 2 desc limit greatest(p_limit, 1);
$$;

-- Country lives on profiles (captured at signup / via geo). p_days kept for
-- signature compatibility.
create or replace function public.users_by_country(p_days integer default 90)
returns table (country text, users bigint)
language sql stable security definer set search_path = public as $$
  select country, count(*)::bigint as users
  from public.profiles
  where country is not null and country <> ''
  group by country order by 2 desc;
$$;

create or replace function public.active_users(p_minutes integer default 5)
returns bigint
language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::bigint
  from public.usage_history
  where created_at >= now() - make_interval(mins => greatest(p_minutes, 1))
    and user_id is not null;
$$;

grant execute on function public.usage_by_hour(integer)           to authenticated;
grant execute on function public.usage_by_model(integer, integer) to authenticated;
grant execute on function public.users_by_country(integer)        to authenticated;
grant execute on function public.active_users(integer)            to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — KEEP profiles IN SYNC WITH auth.users
-- ----------------------------------------------------------------------------
-- Signups land in auth.users. The app only writes public.profiles on certain
-- API calls, so profiles can lag. This backfills every existing user and adds
-- a trigger so new signups get a profile row automatically — which is what the
-- analytics dashboard counts as "users".
-- ════════════════════════════════════════════════════════════════════════════

-- Backfill existing auth users into profiles (preserving original signup time)
insert into public.profiles (id, email, created_at)
select u.id, u.email, u.created_at
from auth.users u
on conflict (id) do nothing;

-- Auto-create a profile whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — MAKE YOURSELF ADMIN  (required for the dashboard to load)
-- ════════════════════════════════════════════════════════════════════════════
-- After the backfill above, your profile row exists. Run this to flag it:
-- update public.profiles set is_admin = true where email = 'mawais9171@gmail.com';
