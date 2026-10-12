-- ============================================================================
-- schema.sql
-- One-time setup for login + cross-device sync. Run this once in your
-- Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query ->
-- paste -> Run).
--
-- Design: one row per advisor (owner = auth.uid()), holding the ENTIRE
-- local app state (the currently-open client, the full saved-clients
-- list, and which one is current) as a single JSONB blob. This mirrors
-- what the app already keeps in localStorage, so no application code
-- needs to change beyond pointing js/core/supabaseConfig.js at your
-- project. Row Level Security ensures each signed-in advisor can only
-- ever read or write their own row.
-- ============================================================================

create table if not exists public.app_state (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Advisors can read their own app state"
  on public.app_state for select
  using (auth.uid() = owner);

create policy "Advisors can insert their own app state"
  on public.app_state for insert
  with check (auth.uid() = owner);

create policy "Advisors can update their own app state"
  on public.app_state for update
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- Enables the Realtime subscription sync.js uses to push live updates to
-- your other signed-in devices (laptop -> iPad -> phone).
alter publication supabase_realtime add table public.app_state;

-- ----------------------------------------------------------------------------
-- Next steps:
--   1. Authentication -> Providers: leave "Email" enabled (default).
--   2. Authentication -> Users -> Add user: create yourself an account
--      (email + password). There is no public sign-up screen in the app —
--      accounts for a single-advisor tool are created here deliberately.
--   3. Project Settings -> API: copy the Project URL and the "anon public"
--      key into js/core/supabaseConfig.js.
--   4. Sign in from the app once on each device. The first sign-in seeds
--      your row from whatever is currently in that browser's local
--      storage; every device after that reads the same synced row.
-- ----------------------------------------------------------------------------
