-- Stage 4: teacher verification, per-seat pricing, Stripe purchase,
-- school plans, seat blocks, renewals.
--
-- Spec: docs/superpowers/specs/2026-10-01-worksheets-grading-yearbook-design.md §4,
-- docs/superpowers/notes/stage4-license-terms.md (starts_at rules),
-- docs/superpowers/specs/2026-09-26-schools-design.md §6 (billing).
--
-- Same rules as 018–033: every table here is written and read ONLY by api/
-- with the service-role key. RLS is enabled with NO policies and the client
-- roles' grants are revoked, so the anon and authenticated keys (which ship
-- to browsers) can read nothing.
--
-- Write-only here: NOT applied. Apply after 033 and BEFORE deploying the
-- Stage 4 code. Additive with defaults, so the previous code keeps working.
-- Idempotent: safe to re-run.

-- ── 1. Teacher verification ─────────────────────────────────────────────
-- A teacher is verified when app_metadata.teacher_verified_at is set
-- (requireVerifiedTeacher in api/_school.js). It is set automatically for a
-- confirmed school-domain email, or by the owner from this queue.
create table if not exists public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Only the DOMAIN of the teacher's email, never the address: the owner
  -- alert and the queue carry domain + user id only.
  email_domain text not null check (char_length(email_domain) between 1 and 253),
  -- Optional, teacher-typed. Helps the owner look the school up.
  school_name text check (school_name is null or char_length(school_name) <= 120),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_by uuid,
  decided_at timestamptz,
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists teacher_verification_one_pending
  on public.teacher_verification_requests (user_id) where status = 'pending';
create index if not exists teacher_verification_queue_idx
  on public.teacher_verification_requests (status, created_at);
alter table public.teacher_verification_requests enable row level security;
revoke all on public.teacher_verification_requests from anon, authenticated;

-- Grandfather: every CURRENT class owner (and license owner) is verified, so
-- no existing class stops working — including the owner's own. Students are
-- never marked (they never own classes, but be explicit). Rows that already
-- carry teacher_verified_at are left alone, so a re-run changes nothing.
-- classrooms.owner_user_id may be NULL on very old legacy rows: EXISTS
-- simply never matches those.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('teacher_verified_at', now(), 'teacher_verified_by', 'grandfathered')
 where coalesce(u.raw_app_meta_data->>'teacher_verified_at', '') = ''
   and coalesce(u.raw_app_meta_data->>'role', '') <> 'student'
   and (exists (select 1 from public.classrooms c where c.owner_user_id = u.id)
        or exists (select 1 from public.class_licenses l where l.owner_user_id = u.id));

-- ── 2. School plans (one invoice, many classes) ─────────────────────────
create table if not exists public.school_plans (
  id uuid primary key default gen_random_uuid(),
  -- The school admin: a verified teacher who bought the plan.
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  school_name text not null check (char_length(school_name) between 1 and 120),
  status text not null check (status in ('pending_payment','active','grace','lapsed','canceled')),
  billing_method text not null check (billing_method in ('card','invoice','manual')),
  -- The 150 minimum is enforced by the API (lib/school/pricing.js); a
  -- manual/comped plan set by the owner may be smaller.
  seats int not null check (seats between 1 and 100000),
  -- A reduction waits for the renewal (never below the seats in use).
  pending_seats int check (pending_seats is null or pending_seats between 1 and 100000),
  price_tier text check (price_tier in ('standard','founding','school')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  -- The Stripe current_period_start of the last PAID period. starts_at moves
  -- only when a newly paid period's start is later than this.
  stripe_period_start timestamptz,
  -- created time of the last applied customer.subscription.* event, so an
  -- older event arriving late can't undo a newer one.
  stripe_event_at timestamptz,
  cancel_at_period_end boolean not null default false,
  dpa_version text,
  dpa_accepted_at timestamptz,
  dpa_accepted_by uuid,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists school_plans_subscription_uniq
  on public.school_plans (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists school_plans_owner_idx on public.school_plans (owner_user_id);
alter table public.school_plans enable row level security;
revoke all on public.school_plans from anon, authenticated;

create or replace function public.school_plans_status_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then new.status_changed_at := now(); end if;
  return new;
end $$;
revoke all on function public.school_plans_status_stamp() from public, anon, authenticated;
drop trigger if exists school_plans_status_stamp on public.school_plans;
create trigger school_plans_status_stamp before update on public.school_plans
  for each row execute function public.school_plans_status_stamp();

-- ── 3. Class licenses: billing columns ──────────────────────────────────
alter table public.class_licenses
  add column if not exists school_plan_id uuid references public.school_plans(id) on delete set null,
  add column if not exists price_tier text check (price_tier is null or price_tier in ('standard','founding','school')),
  add column if not exists pending_seats int check (pending_seats is null or pending_seats between 1 and 35),
  add column if not exists stripe_period_start timestamptz,
  add column if not exists stripe_event_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;
create unique index if not exists class_licenses_subscription_uniq
  on public.class_licenses (stripe_subscription_id) where stripe_subscription_id is not null and school_plan_id is null;
create index if not exists class_licenses_plan_idx on public.class_licenses (school_plan_id) where school_plan_id is not null;
create index if not exists class_licenses_grace_idx on public.class_licenses (expires_at) where status = 'grace';

-- ── 4. Seat offers: a school admin gives a block to a colleague's class ──
-- v1 transfer: the admin enters the colleague's class code and a seat
-- count; the colleague (the class owner, verified) accepts in their Plan &
-- billing panel. Nothing moves until they accept.
create table if not exists public.school_seat_offers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.school_plans(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  seats int not null check (seats between 1 and 35),
  status text not null default 'pending' check (status in ('pending','accepted','declined','canceled')),
  created_by uuid not null,
  decided_by uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists school_seat_offers_one_pending
  on public.school_seat_offers (plan_id, classroom_id) where status = 'pending';
create index if not exists school_seat_offers_class_idx on public.school_seat_offers (classroom_id) where status = 'pending';
alter table public.school_seat_offers enable row level security;
revoke all on public.school_seat_offers from anon, authenticated;

-- ── 5. Stripe event ledger (school billing) ─────────────────────────────
-- Claimed before an event is applied; a duplicate delivery finds its id and
-- is a no-op. If applying fails, the API deletes the claim and answers 500
-- so Stripe retries. Ordering is NOT by arrival: see lib/school/billingState.js.
create table if not exists public.stripe_school_events (
  event_id text primary key check (char_length(event_id) between 1 and 255),
  type text not null,
  object_id text,
  received_at timestamptz not null default now()
);
alter table public.stripe_school_events enable row level security;
revoke all on public.stripe_school_events from anon, authenticated;

-- ── 6. Seat-block assignment (atomic) ───────────────────────────────────
-- Gives (or resizes) a class's block from a school plan. Locks the plan row
-- so two parallel assignments can't oversell it. Rules:
--   * the plan is usable (pending_payment / active / grace) and not expired
--     (grace is usable until the nightly job ends it);
--   * 1..35 seats, never below the class's active students;
--   * the class has no license, or a trial / lapsed / canceled one, or is
--     already on THIS plan (resize). A class on its own card license, a
--     comp, or another plan is refused (cancel that first).
--   * the plan's blocks never sum past plan.seats.
-- The license mirrors the plan: status, expiry and term (starts_at). A trial
-- becoming a block starts the plan's current term: it can print once.
-- Returns {ok, license_id} or {error: code}.
create or replace function public.school_plan_assign(p_plan_id uuid, p_classroom_id uuid, p_seats int, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pl record;
  lic record;
  used int;
  enrolled int;
  lid uuid;
  has_lic boolean;
begin
  if p_seats is null or p_seats < 1 or p_seats > 35 then return jsonb_build_object('error', 'bad_seats'); end if;
  select * into pl from school_plans where id = p_plan_id for update;
  if not found then return jsonb_build_object('error', 'plan_not_found'); end if;
  if pl.status not in ('pending_payment','active','grace')
     or (pl.status <> 'grace' and pl.expires_at <= now()) then
    return jsonb_build_object('error', 'plan_not_active');
  end if;

  select count(*) into enrolled from class_students where classroom_id = p_classroom_id and status = 'active';
  if enrolled > p_seats then return jsonb_build_object('error', 'below_enrolled', 'enrolled', enrolled); end if;

  select * into lic from class_licenses where classroom_id = p_classroom_id for update;
  -- Captured now: the SELECT INTO below resets FOUND.
  has_lic := found;
  if has_lic and lic.school_plan_id is distinct from p_plan_id
     and lic.status not in ('trial','lapsed','canceled') then
    return jsonb_build_object('error', 'class_has_license');
  end if;

  select coalesce(sum(seats), 0) into used from class_licenses
    where school_plan_id = p_plan_id and classroom_id is distinct from p_classroom_id;
  if used + p_seats > pl.seats then
    return jsonb_build_object('error', 'plan_full', 'available', greatest(pl.seats - used, 0));
  end if;

  if has_lic then
    update class_licenses set
      school_plan_id = p_plan_id,
      origin = 'purchase',
      status = pl.status,
      billing_method = pl.billing_method,
      price_tier = pl.price_tier,
      seats = p_seats,
      pending_seats = null,
      image_allowance = 300 * p_seats,
      -- A new block (from trial/lapsed) starts the plan's term with a fresh
      -- picture allowance; a resize on the same plan keeps both.
      images_used = case when lic.school_plan_id = p_plan_id then images_used else 0 end,
      starts_at = pl.starts_at,
      expires_at = pl.expires_at,
      stripe_customer_id = pl.stripe_customer_id,
      stripe_subscription_id = pl.stripe_subscription_id,
      stripe_price_id = pl.stripe_price_id,
      stripe_period_start = pl.stripe_period_start,
      school_name = pl.school_name,
      dpa_version = pl.dpa_version, dpa_accepted_at = pl.dpa_accepted_at, dpa_accepted_by = pl.dpa_accepted_by,
      updated_at = now()
      where id = lic.id
      returning id into lid;
  else
    insert into class_licenses (owner_user_id, classroom_id, origin, status, billing_method, price_tier, seats,
        image_allowance, images_used, starts_at, expires_at, school_plan_id, stripe_customer_id,
        stripe_subscription_id, stripe_price_id, stripe_period_start, school_name, dpa_version, dpa_accepted_at, dpa_accepted_by)
      values (p_owner, p_classroom_id, 'purchase', pl.status, pl.billing_method, pl.price_tier, p_seats,
        300 * p_seats, 0, pl.starts_at, pl.expires_at, p_plan_id, pl.stripe_customer_id,
        pl.stripe_subscription_id, pl.stripe_price_id, pl.stripe_period_start, pl.school_name, pl.dpa_version, pl.dpa_accepted_at, pl.dpa_accepted_by)
      returning id into lid;
  end if;
  return jsonb_build_object('ok', true, 'license_id', lid);
end $$;
revoke all on function public.school_plan_assign(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.school_plan_assign(uuid, uuid, int, uuid) to service_role;

-- ── 7. Pictures: pending_payment is usable (invoice billing, 30 days) ────
-- Same as 018's school_bump_image, plus 'pending_payment' (an invoice-billed
-- plan is usable while the invoice is open; expires_at = the due date).
-- Printing still needs a PAID term (school_create_class_print, 024).
create or replace function public.school_bump_image(p_student_id uuid, p_daily_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  st record;
  lic record;
  archived timestamptz;
begin
  select id, classroom_id, images_day, images_today into st
    from class_students where id = p_student_id and status = 'active' for update;
  if not found then return false; end if;

  select archived_at into archived from classrooms where id = st.classroom_id;
  if archived is not null then return false; end if;

  select id, status, expires_at, image_allowance, images_used into lic
    from class_licenses where classroom_id = st.classroom_id for update;
  if not found then return false; end if;
  if lic.status not in ('trial','pending_payment','active','grace','comped') then return false; end if;
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
revoke all on function public.school_bump_image(uuid, int) from public, anon, authenticated;
grant execute on function public.school_bump_image(uuid, int) to service_role;
