-- Schools: grading with tips — a child-facing level and 0–3 tips on a
-- hand-in, and "send back to revise" (Try again).
--
-- Same rules as 018–021: every table is read and written ONLY by api/ with
-- the service-role key. RLS is enabled with no policies, and the client
-- roles' table grants are revoked too, so the anon and authenticated keys
-- (which ship to browsers) can read nothing.
--
-- Deletion: submission_grades cascades from class_submissions, which already
-- cascades from classrooms, assignments, class_students and auth.users (019).
-- author_user_id is ON DELETE SET NULL. So purgeUser (which deletes the
-- child's class_submissions by user_id, then the auth user) and
-- purgeClassroom (students first, then the classroom) take the grades with
-- the hand-ins, and neither is ever blocked by these rows: the purge order in
-- lib/deleteUser.js is unchanged. Grades are part of the child's data.
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── Tips: the shape check, shared by the table and the RPC ─────────────
-- A JSON array of at most 3 tips, each exactly {"key": "<skill>.<tip>"} (a
-- library tip; api/ checks it against lib/school/grading.js) or
-- {"text": "<1–140 chars>"} (a custom tip). Immutable, so usable in a CHECK.
create or replace function public.school_valid_tips(t jsonb)
returns boolean language sql immutable set search_path = public as $$
  select case when coalesce(jsonb_typeof(t), '') <> 'array' then false
  else jsonb_array_length(t) <= 3
     and not exists (
       select 1 from jsonb_array_elements(t) e
       where not (
         -- CASE, not AND: SQL doesn't promise short-circuiting, and
         -- jsonb_object_keys raises on a non-object. COALESCE: a missing
         -- key makes its branch NULL, not false, and NOT NULL would let
         -- the element through.
         case when jsonb_typeof(e) <> 'object' then false
         else coalesce(
           (select count(*) from jsonb_object_keys(e)) = 1
           and (
             (jsonb_typeof(e->'key') = 'string' and (e->>'key') ~ '^[a-z]+\.[a-z_]+$' and char_length(e->>'key') <= 40)
             or
             (jsonb_typeof(e->'text') = 'string' and char_length(e->>'text') between 1 and 140)
           ),
           false)
         end
       )
     )
  end
$$;

-- ── Grades (one per hand-in VERSION; re-grading a version replaces it) ──
-- Keyed by version, so the teacher keeps the history: v1 "Growing, sent back
-- with tips", v2 "Got it!". `returned` records whether THAT version was sent
-- back; the live "sent back, waiting for the child" state is
-- class_submissions.returned_at below.
create table if not exists public.submission_grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.class_submissions(id) on delete cascade,
  version int not null check (version >= 1),
  level text not null check (level in ('getting_started','growing','got_it','wow')),
  tips jsonb not null default '[]'::jsonb check (public.school_valid_tips(tips)),
  returned boolean not null default false,
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (submission_id, version)
);
-- The unique (submission_id, version) index serves every read: the
-- per-assignment grid and the per-student history both find their
-- class_submissions rows first (class_submissions_student_idx and the
-- (assignment_id, student_id) unique index from 019), then read grades by
-- submission_id in (...); and it serves the cascade from class_submissions.
-- The teacher-wide CSV read goes through class_submissions_class_time_idx.
alter table public.submission_grades enable row level security;
revoke all on public.submission_grades from anon, authenticated;

-- ── "Sent back to revise" on the hand-in itself ─────────────────────────
-- Set by school_grade_submission when the teacher sends it back; cleared by
-- a re-grade without "send back", and by the child handing in again
-- (school_submit below), which also bumps the version.
alter table public.class_submissions add column if not exists returned_at timestamptz;

-- ── RPCs (service role only) ────────────────────────────────────────────
-- Errors are raised with a bare message (SQLSTATE P0001); PostgREST returns
-- it as {code:'P0001', message:'<name>'} and api/ maps the name.

-- Grade one hand-in. The hand-in row is locked FOR UPDATE, which conflicts with
-- school_submit's ON CONFLICT update, so a resubmission can't land between
-- the version check and the write: a grade always belongs to the version the
-- teacher was looking at, and a stale screen gets 'version_changed'.
--
-- Sending back is only allowed while the child can actually hand in again:
-- the assignment is published and not past a due date that refuses late
-- work (the same rule school_submit applies), else 'cannot_return'.
-- Returns {grade: {...}}. Stickers and comments stay on their own route
-- (submission_feedback, api/school/feedback.js).
-- An earlier draft of this migration had a 9-argument version (with
-- comment/sticker). Never applied, but dropped by its exact signature so a
-- database that ever saw it can't keep a stale overload callable.
drop function if exists public.school_grade_submission(uuid, uuid, int, uuid, text, jsonb, boolean, text, text);

create or replace function public.school_grade_submission(
  p_classroom_id uuid, p_submission_id uuid, p_version int, p_author_user_id uuid,
  p_level text, p_tips jsonb, p_returned boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record;
  a record;
  g record;
begin
  select id, version, assignment_id into s
    from class_submissions
    where id = p_submission_id and classroom_id = p_classroom_id
    for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.version <> p_version then raise exception 'version_changed'; end if;

  if p_returned then
    select status, due_at, allow_late into a from assignments where id = s.assignment_id;
    if not found or a.status <> 'published'
       or (not a.allow_late and a.due_at is not null and now() > a.due_at) then
      raise exception 'cannot_return';
    end if;
  end if;

  insert into submission_grades (submission_id, version, level, tips, returned, author_user_id)
    values (s.id, s.version, p_level, coalesce(p_tips, '[]'::jsonb), coalesce(p_returned, false), p_author_user_id)
  on conflict (submission_id, version) do update set
    level = excluded.level,
    tips = excluded.tips,
    returned = excluded.returned,
    author_user_id = excluded.author_user_id,
    updated_at = now(),
    -- A changed grade is news to the child again.
    seen_at = null
  returning id, version, level, tips, returned, created_at, updated_at, seen_at into g;

  update class_submissions
    set returned_at = case when coalesce(p_returned, false) then now() else null end
    where id = s.id;

  return jsonb_build_object(
    'grade', jsonb_build_object('id', g.id, 'version', g.version, 'level', g.level, 'tips', g.tips,
                                'returned', g.returned, 'created_at', g.created_at,
                                'updated_at', g.updated_at, 'seen_at', g.seen_at)
  );
end $$;

-- school_submit (019), unchanged except that handing in again clears
-- returned_at (the revision is in, so it is no longer "sent back") and the
-- result says whether the hand-in it replaced HAD been sent back
-- (was_returned): only then can a resubmission complete the class, so only
-- then does api/ re-run the "everyone has handed in" check. The existing row
-- is read FOR UPDATE first, so a send-back can't land between that read and
-- the upsert.
create or replace function public.school_submit(
  p_classroom_id uuid, p_assignment_id uuid, p_student_id uuid, p_user_id uuid,
  p_book_id text, p_book_title text, p_book_snapshot jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  r record;
  was_returned boolean := false;
begin
  select status, due_at, allow_late into a
    from assignments where id = p_assignment_id and classroom_id = p_classroom_id
    for share;
  if not found or a.status = 'draft' then raise exception 'assignment_not_found'; end if;
  if a.status = 'closed' then raise exception 'assignment_closed'; end if;
  if not a.allow_late and a.due_at is not null and now() > a.due_at then
    raise exception 'past_due';
  end if;

  select returned_at is not null into was_returned
    from class_submissions where assignment_id = p_assignment_id and student_id = p_student_id
    for update;
  was_returned := coalesce(was_returned, false);

  insert into class_submissions (classroom_id, assignment_id, student_id, user_id, book_id, book_title, book_snapshot)
    values (p_classroom_id, p_assignment_id, p_student_id, p_user_id, p_book_id, coalesce(p_book_title, ''), p_book_snapshot)
  on conflict (assignment_id, student_id) do update set
    book_id = excluded.book_id,
    book_title = excluded.book_title,
    book_snapshot = excluded.book_snapshot,
    user_id = excluded.user_id,
    version = class_submissions.version + 1,
    submitted_at = now(),
    returned_at = null
  returning id, version, submitted_at into r;
  return jsonb_build_object('id', r.id, 'version', r.version, 'submitted_at', r.submitted_at,
                            'was_returned', was_returned);
end $$;

-- school_send_nudge (021), unchanged except that a hand-in the teacher
-- SENT BACK no longer counts as handed in: "Don't forget to hand in" may
-- reach a child who is revising. Owner ruling: a sent-back hand-in is not
-- done (nudge pre-ticks, the all-handed-in alert, the daily summary and the
-- dashboard's handed-in counts all read it the same way).
create or replace function public.school_send_nudge(
  p_classroom_id uuid, p_student_id uuid, p_teacher_user_id uuid, p_teacher_name text,
  p_preset text, p_message text, p_assignment_id uuid, p_daily_cap int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  st record;
  tz text;
  archived timestamptz;
  today date;
  sent int;
  r record;
begin
  select id, nudges_day, nudges_today into st
    from class_students
    where id = p_student_id and classroom_id = p_classroom_id and status = 'active'
    for update;
  if not found then raise exception 'student_not_found'; end if;

  select coalesce(nullif(timezone, ''), 'UTC'), archived_at into tz, archived
    from classrooms where id = p_classroom_id;
  if archived is not null then raise exception 'class_archived'; end if;

  if p_assignment_id is not null then
    perform 1 from assignments
      where id = p_assignment_id and classroom_id = p_classroom_id and status = 'published'
        and (allow_late or due_at is null or due_at >= now());
    if not found then raise exception 'assignment_not_found'; end if;
    if p_preset = 'hand_in' and exists (
      select 1 from class_submissions where assignment_id = p_assignment_id and student_id = p_student_id
        and returned_at is null
    ) then
      raise exception 'handed_in';
    end if;
  end if;

  begin
    today := (now() at time zone tz)::date;
  exception when others then
    today := (now() at time zone 'UTC')::date;
  end;

  sent := case when st.nudges_day is distinct from today then 0 else st.nudges_today end;
  if sent >= p_daily_cap then raise exception 'daily_cap'; end if;

  delete from class_nudges where student_id = p_student_id and seen_at is null;
  insert into class_nudges (classroom_id, student_id, teacher_user_id, teacher_name, preset, message, assignment_id)
    values (p_classroom_id, p_student_id, p_teacher_user_id, left(coalesce(p_teacher_name, ''), 60),
            p_preset, p_message, p_assignment_id)
    returning id, student_id, created_at into r;
  update class_students set nudges_day = today, nudges_today = sent + 1 where id = p_student_id;
  return jsonb_build_object('id', r.id, 'student_id', r.student_id, 'created_at', r.created_at);
end $$;

revoke all on function public.school_valid_tips(jsonb) from public, anon, authenticated;
revoke all on function public.school_grade_submission(uuid, uuid, int, uuid, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
-- The tips check runs as whoever writes the row: only ever the service role
-- (or the RPC's owner).
grant execute on function public.school_valid_tips(jsonb) to service_role;
grant execute on function public.school_grade_submission(uuid, uuid, int, uuid, text, jsonb, boolean) to service_role;
grant execute on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
revoke all on function public.school_send_nudge(uuid, uuid, uuid, text, text, text, uuid, int) from public, anon, authenticated;
grant execute on function public.school_send_nudge(uuid, uuid, uuid, text, text, text, uuid, int) to service_role;
