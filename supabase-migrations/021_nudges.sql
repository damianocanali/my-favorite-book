-- Schools: teacher nudges — a short, encouraging note from a teacher to a
-- child who hasn't written in a while ("Your story is waiting for you!").
--
-- Same rules as 018/019/020: every table is read and written ONLY by api/
-- with the service-role key. RLS is enabled with no policies, and the client
-- roles' table grants are revoked too, so the anon and authenticated keys
-- (which ship to browsers) can read nothing.
--
-- Deletion: class_nudges cascades from classrooms and from class_students,
-- and teacher_user_id is ON DELETE SET NULL, so neither purgeClassroom nor
-- purgeUser in lib/deleteUser.js is ever blocked by these rows and the
-- existing purge order is unchanged (students are purged first; their
-- class_students rows cascade from auth.users, and their nudges with them).
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── Nudges ──────────────────────────────────────────────────────────────
-- A preset is stored as a key (the child's app renders it in the child's
-- language); a custom message is stored as the teacher wrote it.
-- assignment_id CASCADES (not SET NULL): a 'hand_in' nudge must name an
-- assignment (the last check below), so SET NULL would make deleting that
-- assignment fail the check and block school_delete_assignment. A nudge
-- about an assignment that no longer exists has nothing left to say.
create table if not exists public.class_nudges (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  teacher_user_id uuid references auth.users(id) on delete set null,
  teacher_name text not null default '' check (char_length(teacher_name) <= 60),
  preset text check (preset in ('story_waiting','one_more_page','cant_wait','hand_in')),
  message text check (char_length(message) <= 140),
  assignment_id uuid references public.assignments(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  check (preset is not null or message is not null),
  check (preset <> 'hand_in' or assignment_id is not null)
);
-- "Latest nudge per child" (teacher) and "my unread nudge" (child).
create index if not exists class_nudges_student_time_idx on public.class_nudges (student_id, created_at desc);
-- One unread nudge per child at a time: a new one replaces it (see the RPC).
create unique index if not exists class_nudges_one_unread_idx on public.class_nudges (student_id) where seen_at is null;
-- The classroom-FK cascade and the teacher's per-class read.
create index if not exists class_nudges_class_time_idx on public.class_nudges (classroom_id, created_at desc);
-- The assignment-FK cascade.
create index if not exists class_nudges_assignment_idx on public.class_nudges (assignment_id);
alter table public.class_nudges enable row level security;
revoke all on public.class_nudges from anon, authenticated;

-- ── Daily cap counter (same pattern as images_day / images_today) ───────
-- A replaced unread nudge is deleted, so counting class_nudges rows would
-- let a teacher resend forever. The count lives on the student row instead,
-- keyed by the calendar day in the CLASS's timezone.
alter table public.class_students add column if not exists nudges_day date;
alter table public.class_students add column if not exists nudges_today int not null default 0;

-- ── RPC (service role only) ─────────────────────────────────────────────
-- Errors are raised with a bare message (SQLSTATE P0001); PostgREST returns
-- it as {code:'P0001', message:'<name>'} and api/ maps the name.
--
-- Sends one nudge to one child. The student row is locked FOR UPDATE, so
-- two sends at once serialise: the daily cap can't be exceeded and the
-- one-unread rule can't trip the unique index. Returns the new row.
--
-- Re-checked here, against the database clock, whatever the API already
-- checked: the class is not archived; a linked assignment is published and
-- still OPEN (not past a due date that disallows late work); a 'hand_in'
-- nudge never reaches a child who has already handed that assignment in.
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

revoke all on function public.school_send_nudge(uuid, uuid, uuid, text, text, text, uuid, int) from public, anon, authenticated;
grant execute on function public.school_send_nudge(uuid, uuid, uuid, text, text, text, uuid, int) to service_role;
