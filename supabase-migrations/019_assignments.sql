-- Schools, stage 2: assignments, hand-ins and teacher feedback.
--
-- Same rules as 018: every table is read and written ONLY by api/ with the
-- service-role key. RLS is enabled with no policies, so the anon and
-- authenticated keys (which ship to browsers) can read nothing.
--
-- Every foreign key here cascades (or sets null), so deleting a classroom,
-- a student or an auth user is never blocked by these rows: lib/deleteUser.js
-- keeps its existing order and the new rows go with their parents.
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── Assignments ─────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  prompt text not null check (char_length(prompt) between 1 and 1000),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  allow_late boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assignments_class_time_idx on public.assignments (classroom_id, created_at desc);
alter table public.assignments enable row level security;

-- ── Hand-ins (one per student per assignment; resubmitting bumps version) ──
create table if not exists public.class_submissions (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  book_title text not null default '',
  book_snapshot jsonb not null,
  version int not null default 1,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists class_submissions_class_time_idx on public.class_submissions (classroom_id, submitted_at desc);
-- Student reads ("my hand-ins") and the student-FK cascade; account purge by user.
create index if not exists class_submissions_student_idx on public.class_submissions (student_id);
create index if not exists class_submissions_user_idx on public.class_submissions (user_id);
alter table public.class_submissions enable row level security;

-- ── Teacher feedback: a short comment and/or one sticker from a fixed set ──
create table if not exists public.submission_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.class_submissions(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  comment text check (char_length(comment) <= 500),
  sticker text check (sticker in ('star','rocket','heart','wow','keep_going','rainbow')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  check (comment is not null or sticker is not null)
);
create index if not exists submission_feedback_sub_time_idx on public.submission_feedback (submission_id, created_at desc);
alter table public.submission_feedback enable row level security;

-- ── RPCs (service role only) ────────────────────────────────────────────
-- Errors are raised with a bare message (SQLSTATE P0001); PostgREST returns
-- it as {code:'P0001', message:'<name>'} and api/ maps the name to a status.

-- Hand in (or hand in again). The assignment is re-checked here, under a
-- share lock and against the database clock, so a teacher closing it (or the
-- due date passing) between the API's fast pre-check and this write can't
-- let a hand-in through. The upsert is one statement, so two taps at once
-- can never both write the same version: ON CONFLICT serialises them.
-- Returns {id, version, submitted_at}.
create or replace function public.school_submit(
  p_classroom_id uuid, p_assignment_id uuid, p_student_id uuid, p_user_id uuid,
  p_book_id text, p_book_title text, p_book_snapshot jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  r record;
begin
  select status, due_at, allow_late into a
    from assignments where id = p_assignment_id and classroom_id = p_classroom_id
    for share;
  if not found or a.status = 'draft' then raise exception 'assignment_not_found'; end if;
  if a.status = 'closed' then raise exception 'assignment_closed'; end if;
  if not a.allow_late and a.due_at is not null and now() > a.due_at then
    raise exception 'past_due';
  end if;

  insert into class_submissions (classroom_id, assignment_id, student_id, user_id, book_id, book_title, book_snapshot)
    values (p_classroom_id, p_assignment_id, p_student_id, p_user_id, p_book_id, coalesce(p_book_title, ''), p_book_snapshot)
  on conflict (assignment_id, student_id) do update set
    book_id = excluded.book_id,
    book_title = excluded.book_title,
    book_snapshot = excluded.book_snapshot,
    user_id = excluded.user_id,
    version = class_submissions.version + 1,
    submitted_at = now()
  returning id, version, submitted_at into r;
  return jsonb_build_object('id', r.id, 'version', r.version, 'submitted_at', r.submitted_at);
end $$;

-- Delete an assignment nobody has handed in. The row lock (FOR UPDATE)
-- conflicts with school_submit's FOR SHARE, so a hand-in can't land between
-- the "no submissions" check and the delete and then vanish in the cascade.
create or replace function public.school_delete_assignment(p_classroom_id uuid, p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1
    from assignments where id = p_assignment_id and classroom_id = p_classroom_id
    for update;
  if not found then raise exception 'assignment_not_found'; end if;
  if exists (select 1 from class_submissions where assignment_id = p_assignment_id) then
    raise exception 'has_submissions';
  end if;
  delete from assignments where id = p_assignment_id;
end $$;

revoke all on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.school_delete_assignment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.school_delete_assignment(uuid, uuid) to service_role;
