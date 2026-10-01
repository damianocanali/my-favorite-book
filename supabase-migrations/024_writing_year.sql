-- Schools: "My Writing Year" — a per-child book built during the year — and
-- class printing (spec 2026-10-01 §3).
--
-- Same rules as 018–023: every table is read and written ONLY by api/ with
-- the service-role key. RLS is enabled with no policies, and the client
-- roles' table grants are revoked too, so the anon and authenticated keys
-- (which ship to browsers) can read nothing.
--
-- Deletion (lib/deleteUser.js order unchanged):
--   * writing_year_items / writing_year_meta cascade from classrooms and
--     class_students; a hand-in item also cascades from class_submissions.
--     So a child deleting their account mid-year (purgeUser deletes their
--     class_submissions, then the auth user, whose class_students row
--     cascades) takes every piece, their "About me" and the teacher's note
--     with them. A class purge (students first, then the classroom) does too.
--   * class_print_request_children cascades from class_students: a child who
--     leaves after a print request was made drops out of it (if it was not
--     yet sent to the printer). The request itself cascades from the
--     classroom; requested_by is ON DELETE SET NULL.
--   * The rendered PDFs live in the print-pdfs bucket under
--     writing-year/<child auth user id>/…; purgeUser removes that prefix.
--   None of these rows can block a purge: every FK cascades or sets null.
--
-- Apply BEFORE deploying the code that uses it. Idempotent: safe to re-run.

-- ── Pieces in a child's Writing Year ───────────────────────────────────
-- kind 'submission': a graded hand-in (book or worksheet) — the content is
--   read from class_submissions at preview/print time (the latest version).
-- kind 'book': one of the child's own books, frozen when suggested (a
--   data-URI-free copy, ≤ 200 KB — lib/school/snapshot.js).
-- A child's suggestion waits for the teacher (approved = false); a teacher's
-- own addition is approved from the start. Declining deletes the row.
create table if not exists public.writing_year_items (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  kind text not null check (kind in ('submission','book')),
  submission_id uuid references public.class_submissions(id) on delete cascade,
  book_id text check (char_length(book_id) between 1 and 128),
  book_snapshot jsonb,
  title text not null default '' check (char_length(title) <= 200),
  position int not null check (position >= 1),
  added_by text not null check (added_by in ('teacher','child_suggested')),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'submission' and submission_id is not null and book_id is null and book_snapshot is null)
    or (kind = 'book' and submission_id is null and book_id is not null
        and jsonb_typeof(book_snapshot) = 'object' and octet_length(book_snapshot::text) <= 250000)
  ),
  -- Only a child's suggestion can be waiting.
  check (approved or added_by = 'child_suggested')
);
-- One row per piece per child (a teacher adding a suggested hand-in approves
-- the suggestion instead of duplicating it).
create unique index if not exists writing_year_items_sub_uniq
  on public.writing_year_items (student_id, submission_id) where submission_id is not null;
create unique index if not exists writing_year_items_book_uniq
  on public.writing_year_items (student_id, book_id) where book_id is not null;
-- The order of a child's book. Deferred, so a reorder can swap positions in
-- one transaction (school_wy_reorder).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'writing_year_items_position_uniq'
                 and conrelid = 'public.writing_year_items'::regclass) then
    alter table public.writing_year_items add constraint writing_year_items_position_uniq
      unique (student_id, position) deferrable initially deferred;
  end if;
end $$;
create index if not exists writing_year_items_class_idx on public.writing_year_items (classroom_id);
-- The class_submissions cascade.
create index if not exists writing_year_items_submission_idx
  on public.writing_year_items (submission_id) where submission_id is not null;
alter table public.writing_year_items enable row level security;
revoke all on public.writing_year_items from anon, authenticated;

-- ── "About me" (the child) and the teacher's note, one row per child ───
create table if not exists public.writing_year_meta (
  student_id uuid primary key references public.class_students(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  -- The three "About me" prompts: favorite thing to write about, my best
  -- sentence, what I learned. 200 each, 600 in all.
  about_favorite text not null default '' check (char_length(about_favorite) <= 200),
  about_best_sentence text not null default '' check (char_length(about_best_sentence) <= 200),
  about_learned text not null default '' check (char_length(about_learned) <= 200),
  teacher_note text not null default '' check (char_length(teacher_note) <= 600),
  cover_title text check (char_length(cover_title) between 1 and 60),
  updated_at timestamptz not null default now()
);
create index if not exists writing_year_meta_class_idx on public.writing_year_meta (classroom_id);
alter table public.writing_year_meta enable row level security;
revoke all on public.writing_year_meta from anon, authenticated;

-- ── Class print requests ───────────────────────────────────────────────
-- A teacher asks for the class's books (one softcover per child, included
-- in a paid license); the owner reviews it in the admin area and only then
-- sends it to Lulu as ONE print job with a line item per child, shipped to
-- the school in one box. Nothing here talks to Lulu by itself.
--   requested → approved → submitted → in_production → shipped
--   + canceled (owner or teacher, before submission) + failed (Lulu said no)
create table if not exists public.class_print_requests (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  -- '2026-27': the school year the books are for (Aug 1 boundary,
  -- lib/school/writingYear.js). One live request per class per year.
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'requested'
    check (status in ('requested','approved','submitted','in_production','shipped','canceled','failed')),
  school_name text not null check (char_length(school_name) between 1 and 120),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_phone text not null check (char_length(contact_phone) between 5 and 30),
  address_line1 text not null check (char_length(address_line1) between 1 and 120),
  address_line2 text check (char_length(address_line2) <= 120),
  city text not null check (char_length(city) between 1 and 80),
  state_code text check (char_length(state_code) <= 10),
  postal_code text not null check (char_length(postal_code) between 1 and 20),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  children_count int not null check (children_count between 1 and 35),
  excluded_count int not null default 0 check (excluded_count >= 0),
  -- Set once, atomically, by the one admin call that is allowed to create
  -- the Lulu print job (status approved + submit_claimed_at null → now()).
  -- A double click finds it set and never reaches Lulu.
  submit_claimed_at timestamptz,
  lulu_print_job_id text,
  lulu_status text,
  tracking jsonb,
  error text check (char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  submitted_at timestamptz,
  shipped_at timestamptz,
  canceled_at timestamptz
);
-- R3: one printed copy per child per year — a second request for the same
-- class and year is refused while one is live (canceled frees the slot).
create unique index if not exists class_print_requests_live_uniq
  on public.class_print_requests (classroom_id, school_year) where status <> 'canceled';
create index if not exists class_print_requests_status_idx on public.class_print_requests (status, created_at desc);
create unique index if not exists class_print_requests_lulu_idx
  on public.class_print_requests (lulu_print_job_id) where lulu_print_job_id is not null;
alter table public.class_print_requests enable row level security;
revoke all on public.class_print_requests from anon, authenticated;

-- Each included child's book, frozen when the teacher asked: what gets
-- printed is what the teacher saw in the summary. The PDFs are rendered by
-- the admin step and stored under writing-year/<child auth user id>/.
create table if not exists public.class_print_request_children (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.class_print_requests(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  position int not null check (position >= 1),
  book jsonb not null check (jsonb_typeof(book) = 'object' and octet_length(book::text) <= 8000000),
  interior_key text,
  cover_key text,
  page_count int check (page_count >= 1),
  rendered_at timestamptz,
  unique (request_id, student_id)
);
create index if not exists class_print_request_children_student_idx
  on public.class_print_request_children (student_id);
alter table public.class_print_request_children enable row level security;
revoke all on public.class_print_request_children from anon, authenticated;

-- ── RPCs (service role only) ────────────────────────────────────────────
-- Errors are raised with a bare message (SQLSTATE P0001); PostgREST returns
-- it as {code:'P0001', message:'<name>'} and api/ maps the name.

-- Add a piece to a child's Writing Year, at the end. Serialised per child by
-- an advisory lock, so two adds can't take the same position and the caps
-- hold under concurrency.
--   Teacher, a hand-in: p_submission_id. The hand-in must be in this class
--     and graded (any version). The child is taken from the hand-in. If the
--     child already suggested it, the suggestion is approved instead.
--   Child, a hand-in or a book: p_student_id + (p_submission_id | p_book_id
--     + p_book_snapshot). Their own hand-ins only (checked here); a book is
--     read by api/ from their own user_books row.
-- Returns {id, position, approved, existed}.
create or replace function public.school_wy_add_item(
  p_classroom_id uuid, p_student_id uuid, p_submission_id uuid,
  p_book_id text, p_book_snapshot jsonb, p_title text, p_added_by text,
  p_max_items int, p_max_pending int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sid uuid := p_student_id;
  sub record;
  sub_title text := '';
  existing record;
  pos int;
  new_id uuid;
begin
  if p_submission_id is not null then
    select id, student_id, book_title into sub from class_submissions
      where id = p_submission_id and classroom_id = p_classroom_id;
    if not found then raise exception 'submission_not_found'; end if;
    if sid is null then sid := sub.student_id; end if;
    if sub.student_id <> sid then raise exception 'submission_not_found'; end if;
    sub_title := coalesce(sub.book_title, '');
    if p_added_by = 'teacher'
       and not exists (select 1 from submission_grades where submission_id = p_submission_id) then
      raise exception 'not_graded';
    end if;
  end if;
  if sid is null then raise exception 'student_not_found'; end if;
  if not exists (select 1 from class_students where id = sid and classroom_id = p_classroom_id and status = 'active') then
    raise exception 'student_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('writing_year:' || sid::text, 0));

  select id, position, approved into existing from writing_year_items
    where student_id = sid
      and ((p_submission_id is not null and submission_id = p_submission_id)
        or (p_book_id is not null and book_id = p_book_id));
  if found then
    if p_added_by = 'teacher' and not existing.approved then
      update writing_year_items set approved = true, updated_at = now() where id = existing.id;
      return jsonb_build_object('id', existing.id, 'position', existing.position, 'approved', true, 'existed', true);
    end if;
    return jsonb_build_object('id', existing.id, 'position', existing.position, 'approved', existing.approved, 'existed', true);
  end if;

  if (select count(*) from writing_year_items where student_id = sid) >= p_max_items then
    raise exception 'too_many_items';
  end if;
  if p_added_by = 'child_suggested'
     and (select count(*) from writing_year_items where student_id = sid and not approved) >= p_max_pending then
    raise exception 'too_many_pending';
  end if;

  select coalesce(max(position), 0) + 1 into pos from writing_year_items where student_id = sid;
  insert into writing_year_items (classroom_id, student_id, kind, submission_id, book_id, book_snapshot,
                                  title, position, added_by, approved)
    values (p_classroom_id, sid,
            case when p_submission_id is not null then 'submission' else 'book' end,
            p_submission_id,
            case when p_submission_id is null then p_book_id end,
            case when p_submission_id is null then p_book_snapshot end,
            left(coalesce(nullif(p_title, ''), sub_title), 200),
            pos, p_added_by, p_added_by = 'teacher')
    returning id into new_id;
  return jsonb_build_object('id', new_id, 'position', pos, 'approved', p_added_by = 'teacher', 'existed', false);
end $$;

-- Reorder one child's pieces: p_item_ids must be exactly that child's
-- pieces (every one, once), in the new order; positions become 1..n.
-- Same lock as school_wy_add_item, and the position constraint is deferred,
-- so the swap is one consistent write ('order_mismatch' otherwise).
create or replace function public.school_wy_reorder(p_classroom_id uuid, p_student_id uuid, p_item_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtextextended('writing_year:' || p_student_id::text, 0));
  select count(*) into n from writing_year_items
    where student_id = p_student_id and classroom_id = p_classroom_id;
  if n <> coalesce(array_length(p_item_ids, 1), 0)
     or n <> (select count(distinct x) from unnest(p_item_ids) x)
     or exists (select 1 from unnest(p_item_ids) x
                where not exists (select 1 from writing_year_items
                                  where id = x and student_id = p_student_id and classroom_id = p_classroom_id)) then
    raise exception 'order_mismatch';
  end if;
  update writing_year_items w set position = o.ord, updated_at = now()
    from unnest(p_item_ids) with ordinality as o(id, ord)
    where w.id = o.id;
  return n;
end $$;

-- Create a class print request and its children in one transaction. The
-- partial unique index refuses a second live request for the class and year
-- ('already_requested'); the license is re-checked here, under a share lock,
-- so a lapse between api/'s check and this write can't let it through
-- (R1: active, grace or comped — never a trial).
-- p_children: [{student_id, display_name, book}] in print order.
create or replace function public.school_create_class_print(
  p_classroom_id uuid, p_requested_by uuid, p_school_year text, p_address jsonb,
  p_children jsonb, p_excluded_count int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lic record;
  req_id uuid;
  n int := coalesce(jsonb_array_length(p_children), 0);
begin
  select status, expires_at into lic from class_licenses where classroom_id = p_classroom_id for share;
  if not found or lic.status not in ('active','grace','comped')
     or (lic.status <> 'grace' and lic.expires_at <= now()) then
    raise exception 'license_not_paid';
  end if;
  if n < 1 then raise exception 'no_children'; end if;

  begin
    insert into class_print_requests (classroom_id, requested_by, school_year, school_name, contact_name,
      contact_email, contact_phone, address_line1, address_line2, city, state_code, postal_code,
      country_code, children_count, excluded_count)
    values (p_classroom_id, p_requested_by, p_school_year, p_address->>'school_name', p_address->>'contact_name',
      p_address->>'contact_email', p_address->>'contact_phone', p_address->>'address_line1',
      nullif(p_address->>'address_line2', ''), p_address->>'city', nullif(p_address->>'state_code', ''),
      p_address->>'postal_code', p_address->>'country_code', n, coalesce(p_excluded_count, 0))
    returning id into req_id;
  exception when unique_violation then
    raise exception 'already_requested';
  end;

  insert into class_print_request_children (request_id, student_id, display_name, position, book)
    select req_id, (c->>'student_id')::uuid, c->>'display_name', o.ord, c->'book'
      from jsonb_array_elements(p_children) with ordinality as o(c, ord)
      join class_students s on s.id = (c->>'student_id')::uuid
                           and s.classroom_id = p_classroom_id and s.status = 'active';
  get diagnostics n = row_count;
  if n <> jsonb_array_length(p_children) then raise exception 'children_changed'; end if;

  return jsonb_build_object('id', req_id, 'children_count', n);
end $$;

revoke all on function public.school_wy_add_item(uuid, uuid, uuid, text, jsonb, text, text, int, int) from public, anon, authenticated;
revoke all on function public.school_wy_reorder(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.school_create_class_print(uuid, uuid, text, jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.school_wy_add_item(uuid, uuid, uuid, text, jsonb, text, text, int, int) to service_role;
grant execute on function public.school_wy_reorder(uuid, uuid, uuid[]) to service_role;
grant execute on function public.school_create_class_print(uuid, uuid, text, jsonb, jsonb, int) to service_role;
