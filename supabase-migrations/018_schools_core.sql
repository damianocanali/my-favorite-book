-- Schools, stage 1: class licenses, student accounts, sign-in throttle,
-- student check-ins and help asks.
--
-- Every table here is written and read ONLY by api/ with the service-role
-- key. RLS is enabled with no policies, so the anon and authenticated keys
-- (which ship to browsers) can read nothing. Do not add policies without a
-- design change: class_students holds the picture-password hash.
--
-- Apply AFTER migration 017 and after the api/school deploy. Idempotent.

-- ── Licenses ────────────────────────────────────────────────────────────
create table if not exists public.class_licenses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  classroom_id uuid unique references public.classrooms(id) on delete set null,
  origin text not null check (origin in ('trial','purchase','comp')),
  status text not null check (status in ('trial','pending_payment','active','grace','lapsed','canceled','comped')),
  billing_method text check (billing_method in ('card','invoice','manual')),
  seats int not null default 35 check (seats between 1 and 35),
  -- Default to 300 (trial allowance): if an insert forgets to set it, under-provision rather than grant paid 7,500.
  image_allowance int not null default 300 check (image_allowance >= 0),
  images_used int not null default 0 check (images_used >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  school_name text,
  dpa_version text,
  dpa_accepted_at timestamptz,
  dpa_accepted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists class_licenses_owner_idx on public.class_licenses (owner_user_id);
alter table public.class_licenses enable row level security;

-- ── Classrooms (existing) ───────────────────────────────────────────────
alter table public.classrooms
  add column if not exists locale text not null default 'en' check (locale in ('en','it')),
  add column if not exists sign_in_open boolean not null default true,
  add column if not exists sign_in_paused_until timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists school_hours jsonb not null default
    '{"1":["08:00","15:30"],"2":["08:00","15:30"],"3":["08:00","15:30"],"4":["08:00","15:30"],"5":["08:00","15:30"]}'::jsonb;

-- A cascade would delete the classroom but leave its students' auth users
-- alive. Teacher deletion purges classes explicitly, in order (lib/deleteUser.js).
alter table public.classrooms drop constraint if exists classrooms_owner_user_id_fkey;
alter table public.classrooms add constraint classrooms_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete restrict;

-- Legacy submissions reference the class CODE. Without ON UPDATE CASCADE,
-- rotating a code fails on any class that has legacy submissions.
alter table public.submissions drop constraint if exists submissions_classroom_code_fkey;
alter table public.submissions add constraint submissions_classroom_code_fkey
  foreign key (classroom_code) references public.classrooms(code) on update cascade on delete cascade;

-- So account deletion can find a signed-in child's legacy submissions.
alter table public.submissions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ── Students ────────────────────────────────────────────────────────────
create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar_emoji text not null,
  secret_hash text not null,
  secret_version smallint not null default 1,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  hard_locked boolean not null default false,
  status text not null default 'active' check (status in ('active','removed')),
  images_day date,
  images_today int not null default 0,
  removed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists class_students_name_uniq
  on public.class_students (classroom_id, lower(display_name)) where status = 'active';
create index if not exists class_students_class_idx on public.class_students (classroom_id);
alter table public.class_students enable row level security;

-- ── Sign-in attempts (durable throttle; the in-memory limiter is per instance) ──
create table if not exists public.student_sign_in_attempts (
  id bigint generated always as identity primary key,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid references public.class_students(id) on delete cascade,
  ip_hash text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists ssia_class_time_idx on public.student_sign_in_attempts (classroom_id, created_at);
create index if not exists ssia_ip_time_idx on public.student_sign_in_attempts (ip_hash, created_at);
alter table public.student_sign_in_attempts enable row level security;

-- ── Check-ins shared with the teacher (student accounts only, spec §5a) ──
create table if not exists public.class_checkins (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  feeling text not null check (feeling in ('happy','proud','tired','worried','angry','sad')),
  need text check (need in ('break','quiet','help_book','grownup','keep_going')),
  created_at timestamptz not null default now()
);
create index if not exists class_checkins_class_time_idx on public.class_checkins (classroom_id, created_at desc);
alter table public.class_checkins enable row level security;

-- ── Help asks (spec §12.1) ─────────────────────────────────────────────
create table if not exists public.class_help_requests (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.class_students(id) on delete cascade,
  kind text not null check (kind in ('book','grownup')),
  asks int not null default 1,
  in_hours boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notified_at timestamptz,
  seen_at timestamptz,
  seen_by uuid references auth.users(id) on delete set null
);
create index if not exists class_help_open_idx on public.class_help_requests (student_id, kind, updated_at desc) where seen_at is null;
create index if not exists class_help_class_idx on public.class_help_requests (classroom_id, created_at desc);
alter table public.class_help_requests enable row level security;

-- ── RPCs (service role only) ────────────────────────────────────────────

-- Whether a sign-in may be attempted right now. Checked BEFORE the picture
-- comparison so a locked account never reveals whether a guess was right.
-- Returns: ok | ip_blocked | class_paused | hard_locked | locked
create or replace function public.school_sign_in_state(p_classroom_id uuid, p_student_id uuid, p_ip_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  s record;
  paused timestamptz;
begin
  if (select count(*) from student_sign_in_attempts
      where ip_hash = p_ip_hash and not ok and created_at > now() - interval '1 hour') > 30 then
    return 'ip_blocked';
  end if;
  select sign_in_paused_until into paused from classrooms where id = p_classroom_id;
  if paused is not null and paused > now() then return 'class_paused'; end if;
  select hard_locked, locked_until into s from class_students where id = p_student_id;
  if s.hard_locked then return 'hard_locked'; end if;
  if s.locked_until is not null and s.locked_until > now() then return 'locked'; end if;
  return 'ok';
end $$;

-- Record one attempt and apply the lockout rules (spec §4.4):
-- 5 failures -> 15 min lock; 10 -> hard lock (teacher only);
-- >20 class-wide failures in 10 min -> class paused 10 min.
-- Returns the student's state after this attempt: ok | locked | hard_locked
create or replace function public.school_record_attempt(p_classroom_id uuid, p_student_id uuid, p_ip_hash text, p_ok boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  fails smallint;
begin
  insert into student_sign_in_attempts (classroom_id, student_id, ip_hash, ok)
  values (p_classroom_id, p_student_id, p_ip_hash, p_ok);

  if p_ok then
    update class_students
      set failed_attempts = 0, locked_until = null, last_sign_in_at = now()
      where id = p_student_id;
    return 'ok';
  end if;

  update class_students set failed_attempts = failed_attempts + 1
    where id = p_student_id returning failed_attempts into fails;

  if (select count(*) from student_sign_in_attempts
      where classroom_id = p_classroom_id and not ok and created_at > now() - interval '10 minutes') > 20 then
    update classrooms set sign_in_paused_until = now() + interval '10 minutes' where id = p_classroom_id;
  end if;

  if fails >= 10 then
    update class_students set hard_locked = true where id = p_student_id;
    return 'hard_locked';
  elsif fails % 5 = 0 then
    update class_students set locked_until = now() + interval '15 minutes' where id = p_student_id;
    return 'locked';
  end if;
  return 'ok';
end $$;

-- Atomically spend one AI image from the class allowance and the student's
-- daily allowance. Returns false (and spends nothing) if either is used up
-- or the class has no usable license.
create or replace function public.school_bump_image(p_student_id uuid, p_daily_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  st record;
  lic record;
begin
  select id, classroom_id, images_day, images_today into st
    from class_students where id = p_student_id and status = 'active' for update;
  if not found then return false; end if;

  select id, status, expires_at, image_allowance, images_used into lic
    from class_licenses where classroom_id = st.classroom_id for update;
  if not found then return false; end if;
  if lic.status not in ('trial','active','grace','comped') then return false; end if;
  if lic.status <> 'grace' and lic.expires_at <= now() then return false; end if;
  if lic.images_used >= lic.image_allowance then return false; end if;

  if st.images_day is distinct from current_date then
    st.images_today := 0;
  end if;
  if st.images_today >= p_daily_limit then return false; end if;

  update class_licenses set images_used = images_used + 1, updated_at = now() where id = lic.id;
  update class_students set images_day = current_date, images_today = st.images_today + 1 where id = st.id;
  return true;
end $$;

-- "Sign out everywhere" for one student: drops every session (and with them
-- their refresh tokens). Access tokens already issued live until they expire.
create or replace function public.school_sign_out_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.sessions where user_id = p_user_id;
end $$;

revoke all on function public.school_sign_in_state(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.school_record_attempt(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.school_bump_image(uuid, int) from public, anon, authenticated;
revoke all on function public.school_sign_out_user(uuid) from public, anon, authenticated;
grant execute on function public.school_sign_in_state(uuid, uuid, text) to service_role;
grant execute on function public.school_record_attempt(uuid, uuid, text, boolean) to service_role;
grant execute on function public.school_bump_image(uuid, int) to service_role;
grant execute on function public.school_sign_out_user(uuid) to service_role;
