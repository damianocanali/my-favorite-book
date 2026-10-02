-- Data lifecycle: retention jobs, license-lapse purge, teacher deletes and
-- the deletion evidence log (privacy review §4.7 / §7.1, 7.2, 7.3, 7.22).
--
-- * deletion_log — one row per deletion of school data (teacher "delete
--   now" of a student or a class, the nightly purge of removed students and
--   of classes 90 days after their license lapsed). Ids, action, actor and
--   row counts only; never a name or content. It is the evidence an NDPA
--   Exhibit D disposal certificate is written from, so it deliberately has
--   no FKs (the things it describes are gone) and is never purged by the
--   jobs it records. Written by lib/school/deletionLog.js.
-- * class_licenses.purge_warning_30_at / purge_warning_7_at — when the
--   teacher was emailed "this class will be deleted in 30 / 7 days". A
--   stamp only counts if it is later than the current lapse, so a renewed
--   and re-lapsed license is warned again. The purge itself waits until
--   the 7-day warning is at least 6 days old (lib/school/lifecycle.js).
-- * Indexes for the nightly deletes by age (api/cron/retention.js).
--
-- Service role only: RLS on, no policies, client grants revoked.
-- Apply BEFORE deploying the code that uses it. Idempotent.

create table if not exists public.deletion_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('teacher','system')),
  action text not null check (action in ('delete_student','delete_class','purge_removed_student','purge_lapsed_class')),
  classroom_id uuid,
  target_id uuid,
  counts jsonb not null default '{}'::jsonb,
  reason text check (char_length(reason) <= 200),
  status text not null default 'started' check (status in ('started','done','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists deletion_log_class_idx on public.deletion_log (classroom_id, created_at desc);
create index if not exists deletion_log_actor_idx on public.deletion_log (actor_user_id, created_at desc);
alter table public.deletion_log enable row level security;
revoke all on public.deletion_log from anon, authenticated;

alter table public.class_licenses
  add column if not exists purge_warning_30_at timestamptz,
  add column if not exists purge_warning_7_at timestamptz;

-- Nightly deletes by age.
create index if not exists class_checkins_created_idx on public.class_checkins (created_at);
create index if not exists ssia_created_idx on public.student_sign_in_attempts (created_at);
create index if not exists class_students_removed_idx on public.class_students (removed_at) where status = 'removed';
create index if not exists submissions_legacy_anon_idx on public.submissions (submitted_at) where user_id is null;
