-- Schools: worksheet assignments (spec 2026-10-01 §2). A teacher assigns
-- either a book (as before) or a worksheet: a template (lib/school/
-- worksheets.js) whose box prompts the teacher may edit.
--
-- Same rules as 018–022: every table is read and written ONLY by api/ with
-- the service-role key. Nothing here adds a table, a policy or a grant to
-- the client roles.
--
-- Where a worksheet hand-in lives — the least invasive choice:
-- class_submissions is unchanged. A worksheet hand-in is a row like any
-- other, with
--   book_id       = 'worksheet:<assignment id>'  (not a user_books key)
--   book_title    = the assignment's title
--   book_snapshot = { "kind": "worksheet", "templateId", "word"?,
--                     "boxes": [{ "id", "prompt" }],   -- prompts as the
--                     "answers": { "<boxId>": "..." } } -- child saw them
-- So grading (022: school_grade_submission, submission_grades, returned_at),
-- feedback, the dashboard, nudges, the all-handed-in alert, the summary and
-- the account/class purge all work on it unchanged: none of them read the
-- snapshot. No server drafts: answers are autosaved on the child's device.
--
-- Deletion: nothing new to purge. The worksheet definition is teacher text
-- on the assignment (cascades with the class); the child's answers are in
-- class_submissions, which 019 already cascades and lib/deleteUser.js
-- already deletes.
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── The worksheet shape check (mirrors lib/school/worksheets.js) ───────
-- An object {templateId, prompts, word?}: templateId a template-id-shaped
-- string; prompts an object of 1–12 box-id-shaped keys, each a string of
-- 1–300 characters; word (the acrostic's, optional) 2–12 letters. Which
-- template ids and box ids exist is checked by api/ against the template
-- list (the SQL can't follow a list that grows in code). CASE, not AND,
-- wherever a function would raise on the wrong JSON type: SQL doesn't
-- promise short-circuiting.
create or replace function public.school_valid_worksheet(w jsonb)
returns boolean language sql immutable set search_path = public as $$
  select case when coalesce(jsonb_typeof(w), '') <> 'object' then false
  else coalesce(
    jsonb_typeof(w->'templateId') = 'string'
    and (w->>'templateId') ~ '^[a-z_]{1,40}$'
    and not exists (
      select 1 from jsonb_object_keys(w) k where k not in ('templateId', 'prompts', 'word')
    )
    and (case when jsonb_typeof(w->'prompts') <> 'object' then false
         else (select count(*) from jsonb_object_keys(w->'prompts')) between 1 and 12
           and not exists (
             select 1 from jsonb_each(w->'prompts') p
             where not (
               p.key ~ '^[a-z_]{1,40}$'
               and jsonb_typeof(p.value) = 'string'
               and char_length(p.value #>> '{}') between 1 and 300
             )
           )
         end)
    and (case when not (w ? 'word') then true
         when jsonb_typeof(w->'word') <> 'string' then false
         else (w->>'word') ~ '^[[:alpha:]]{2,12}$'
         end),
    false)
  end
$$;

-- ── Assignments: book or worksheet ─────────────────────────────────────
alter table public.assignments add column if not exists kind text not null default 'book';
alter table public.assignments add column if not exists worksheet jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignments_kind_check'
                 and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_kind_check
      check (kind in ('book', 'worksheet'));
  end if;
  -- A book carries no worksheet; a worksheet always carries a valid one.
  if not exists (select 1 from pg_constraint where conname = 'assignments_worksheet_check'
                 and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_worksheet_check
      check ((kind = 'book' and worksheet is null)
          or (kind = 'worksheet' and public.school_valid_worksheet(worksheet)));
  end if;
  -- 019's inline prompt check (1-1000 characters) becomes: a worksheet's
  -- class-wide instructions may be empty (its boxes carry the prompts); a
  -- book's prompt is still 1-1000.
  if not exists (select 1 from pg_constraint where conname = 'assignments_prompt_kind_check'
                 and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments drop constraint if exists assignments_prompt_check;
    alter table public.assignments add constraint assignments_prompt_kind_check
      check (char_length(prompt) <= 1000 and (kind = 'worksheet' or char_length(prompt) >= 1));
  end if;
end $$;

-- What an assignment IS never changes once created: hand-ins (and a
-- child's device draft) are of that kind. api/ never sends kind on an
-- update; this makes it a rule, not a habit.
create or replace function public.school_assignment_kind_locked()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.kind is distinct from old.kind then raise exception 'kind_locked'; end if;
  return new;
end $$;

drop trigger if exists assignments_kind_locked on public.assignments;
create trigger assignments_kind_locked before update of kind on public.assignments
  for each row execute function public.school_assignment_kind_locked();

-- ── school_submit (022), unchanged except for one check ───────────────
-- The hand-in must match the assignment's kind: a worksheet assignment
-- takes only a worksheet snapshot, a book assignment only a book. Read
-- under the same FOR SHARE lock as the status re-check ('wrong_kind').
-- Everything else is 022's, word for word: the closed/draft/past_due
-- re-check against the database clock, the FOR UPDATE read of the existing
-- row for was_returned, the one-statement upsert that bumps the version,
-- and returned_at cleared on handing in again.
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
  select status, due_at, allow_late, kind into a
    from assignments where id = p_assignment_id and classroom_id = p_classroom_id
    for share;
  if not found or a.status = 'draft' then raise exception 'assignment_not_found'; end if;
  if a.status = 'closed' then raise exception 'assignment_closed'; end if;
  if not a.allow_late and a.due_at is not null and now() > a.due_at then
    raise exception 'past_due';
  end if;
  if (a.kind = 'worksheet') is distinct from (coalesce(p_book_snapshot->>'kind', '') = 'worksheet') then
    raise exception 'wrong_kind';
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

revoke all on function public.school_valid_worksheet(jsonb) from public, anon, authenticated;
revoke all on function public.school_assignment_kind_locked() from public, anon, authenticated;
revoke all on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
-- The worksheet check runs as whoever writes the row: only ever the
-- service role (or a definer RPC's owner).
grant execute on function public.school_valid_worksheet(jsonb) to service_role;
grant execute on function public.school_submit(uuid, uuid, uuid, uuid, text, text, jsonb) to service_role;
