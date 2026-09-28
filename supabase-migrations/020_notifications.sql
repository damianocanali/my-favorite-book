-- Schools, stage 3: teacher notifications (spec §12).
--
-- Same rules as 018/019: every table is read and written ONLY by api/ with
-- the service-role key. RLS is enabled with no policies, and the client
-- roles' table grants are revoked too, so the anon and authenticated keys
-- (which ship to browsers) can read nothing.
--
-- Every foreign key cascades, so deleting a classroom or an auth user is
-- never blocked by these rows: lib/deleteUser.js keeps its existing order.
--
-- class_help_requests.notified_at already exists (018).
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── The bell: one row per event a teacher should hear about ─────────────
-- payload carries display text only (student name, class name, assignment
-- title/id). Never a feeling or a need.
-- dedup_key: set only for events that must fire once ("everyone has handed
-- in <assignment>"); the insert uses ON CONFLICT DO NOTHING on it, so two
-- last hand-ins landing at once cannot both alert. NULLs never conflict.
create table if not exists public.teacher_notifications (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete cascade,
  kind text not null check (kind in ('hand_in','hand_in_late','resubmit','all_handed_in','help_book','help_grownup')),
  payload jsonb not null default '{}'::jsonb,
  dedup_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists teacher_notifications_teacher_time_idx
  on public.teacher_notifications (teacher_user_id, created_at desc);
-- The classroom-FK cascade.
create index if not exists teacher_notifications_class_idx on public.teacher_notifications (classroom_id);
alter table public.teacher_notifications enable row level security;
revoke all on public.teacher_notifications from anon, authenticated;

-- ── Web push subscriptions (one per browser) ────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- ── APNs device tokens (iPad / iPhone teachers) ─────────────────────────
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text unique not null,
  platform text not null default 'ios' check (platform in ('ios')),
  env text not null default 'production' check (env in ('production','sandbox')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;

-- ── Per-teacher notification settings (no row = the defaults) ───────────
create table if not exists public.teacher_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text not null default 'daily' check (summary in ('daily','weekly','off')),
  push_urgent boolean not null default true,
  email_urgent boolean not null default true,
  updated_at timestamptz not null default now()
);
-- When the summary cron last emailed this teacher (activity is counted
-- since then). Added separately so a re-run on an older 020 is safe.
alter table public.teacher_settings add column if not exists last_summary_at timestamptz;
alter table public.teacher_settings enable row level security;
revoke all on public.teacher_settings from anon, authenticated;
