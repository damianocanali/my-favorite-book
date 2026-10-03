-- ════════════════════════════════════════════════════════════════════════
-- RECONSTRUCTED, NOT DUMPED. These three tables were created in the
-- Supabase dashboard, never in a migration (privacy review §4.2 "schema
-- drift"). Their DDL below is inferred from what the code reads and writes
-- and from later migrations (010, 017, 018) that ALTER them. It is the
-- EXPECTED shape, to be replaced by a real
--     supabase db dump --schema-only
-- (owner action: needs the production DB password). Until then, treat
-- every column type and default here as a best guess.
-- ════════════════════════════════════════════════════════════════════════

-- Legacy classroom join codes; extended by 010 (owner_user_id) and 018
-- (locale, sign-in state, archive, timezone, school hours).
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.classrooms enable row level security;          -- 017
-- Expected policies: NONE (017 dropped the public read/insert policies;
-- every access goes through api/ with the service role).

-- Legacy anonymous "submit to classroom" hand-ins (api/classroom-submit.js);
-- user_id added by 018. Sunset pending (review §7 item 22).
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  classroom_code text not null,
  book jsonb not null,
  submitted_at timestamptz not null default now()
);
alter table public.submissions enable row level security;         -- 017
-- Expected policies: NONE (017).

-- Consumer plan, written by api/stripe-webhook.js and
-- api/revenuecat-webhook.js (upsert on_conflict=user_id), read by the web
-- client (src/hooks/useSubscription.js: plan, status, stripe_customer_id).
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text,
  status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
-- Expected policy (VERIFY in prod — the client reads its own row directly):
--   create policy "own subscription" on public.subscriptions
--     for select to authenticated using (auth.uid() = user_id);
-- and NO insert/update/delete policy (only the service role writes).
