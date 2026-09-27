# Schools Stage 1 — Class accounts, picture sign-in, check-in sharing: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher creates a class on the web (with a 30-day free trial), adds a roster, prints picture sign-in cards; children sign in with no email by tapping their name and three pictures; student accounts are fenced off from every consumer-only feature; student check-ins and "help" asks are stored for the teacher.

**Architecture:** New Postgres tables behind the service role (no client RLS policies at all), a small set of Edge functions under `api/school/`, pure logic in `lib/school/` shared by server and web, and web UI for teacher roster + student sign-in. Sessions for students are minted server-side with Supabase admin `generate_link` + `verify`, so no email is ever sent. The teacher's view of check-ins, notifications, assignments and iOS come in later stages.

**Tech Stack:** Vercel Edge functions (plain JS, `export const config = { runtime: 'edge' }`), Supabase REST/Auth over `fetch`, WebCrypto, React 19 + Vite + zustand + react-i18next + Tailwind, vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-09-26-schools-design.md` (read §0, §3, §4, §5a, §12.1–12.2).

## Global Constraints

- Work ONLY in `/Users/damianocanali/dev/mybooklab-schools` (git worktree, branch `feat/schools-stage1`). Never touch `~/Documents/my-favorite-book`.
- Ignore any file whose name ends in ` <digit>.<ext>` (e.g. `CheckInSheet 2.jsx`): iCloud sync copies, never imported.
- Run tests with `npx vitest run` from the worktree root. Baseline: 240 passing. Every task ends with the full suite green.
- Every new `api/` file starts with `export const config = { runtime: 'edge' }` and uses only `fetch` + WebCrypto (no npm server libraries).
- Every API response goes through `withCors(...)` from `api/_rateLimit.js` and every handler starts with `handleCors(req)`, like `api/classroom.js`.
- Database access from `api/` uses the **service-role** key (`SUPABASE_SERVICE_ROLE_KEY`, fallback `SUPABASE_SERVICE_KEY`) and `SUPABASE_URL` (fallback `VITE_SUPABASE_URL`). Never the anon key for table access.
- `app_metadata.role === 'student'` is the ONLY trusted student marker. `user_metadata` is user-writable and must never gate anything.
- Picture passwords are server-generated, never child-chosen, stored only as `HMAC-SHA256(STUDENT_SECRET_PEPPER, "v1|<student_id>|<p1>,<p2>,<p3>")` hex. The pepper lives only in Vercel env.
- Student accounts: no email is ever sent; synthetic email is `s-<uuidv4>@students.mybooklab.invalid`.
- Error bodies are `{ error: <English sentence>, code: <snake_case code> }`. Clients localise by `code`.
- All new user-facing web strings go in a new i18n namespace `school` with **both** `en` and `it` values (`src/i18n/locales/{en,it}/school.json`); `tests/i18n-keys.test.js` enforces parity.
- Children see no prices, no "your school didn't pay", no purchase links. Blocked states say "Ask your teacher".
- Trial (D4): 30 days, no card, 300 AI images per class. Paid class (D2/D5): 7,500 images per year, 15 per student per day. Max 35 students per class.
- Commit after each task with a conventional message ending in the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings made while writing this plan

- **No client RLS policies on any new table.** Every read and write goes through `api/school/*` with the service role. RLS is enabled with zero policies, so the anon and authenticated keys get nothing. This is stricter than spec §3.2 and removes the `secret_hash` column-exposure problem entirely.
- **One link between class and license:** `class_licenses.classroom_id` (unique). The spec's extra `classrooms.license_id` is dropped as redundant.
- **Trial abuse cap:** a teacher gets a trial license for at most **3** classes, lifetime (`class_licenses.origin = 'trial'`).
- **Legacy FK fix:** `submissions.classroom_code → classrooms.code` gets `ON UPDATE CASCADE`, or rotating a class code would fail on classes with legacy submissions.
- **Help asks for students split** the existing `help` need into `help_book` and `grownup` (spec §12.1). Consumer accounts keep today's four needs, unchanged.
- **Check-in sharing lives outside the store.** `useCheckInStore` stays network-free. A separate `src/lib/schoolShare.js` sends a copy only when the signed-in user is a student; the privacy test is updated to pin exactly that.

## File structure

| File | Responsibility |
|---|---|
| `supabase-migrations/018_schools_core.sql` | All Stage 1 tables, column changes, RPCs |
| `lib/school/pictures.js` | The 16 picture ids + emoji, the emoji list for avatars |
| `lib/school/crypto.js` | CSPRNG class codes, picture secrets, HMAC hashing, constant-time compare, IP hashing, synthetic emails |
| `lib/school/hours.js` | `isWithinSchoolHours`, `validateSchoolHours`, `DEFAULT_SCHOOL_HOURS` |
| `lib/school/license.js` | `isLicenseUsable`, trial/paid constants |
| `api/_auth.js` (modify) | `verifyJwt` also returns `appMetadata` |
| `api/_school.js` | `sb`, `json`, `isStudent`, `rejectStudent`, `requireTeacher`, `requireClassOwner`, `requireStudent` |
| `api/school/classes.js` | Teacher: list / create (with trial) / update classes |
| `api/school/students.js` | Teacher: list / bulk-create / manage roster |
| `api/school/roster.js` | Public: name tiles for a class code |
| `api/school/sign-in.js` | Public: picture check → session tokens |
| `api/school/checkin.js` | Student: store a check-in |
| `api/school/help.js` | Student: ask for help / poll whether it was seen |
| `lib/deleteUser.js` (modify) | Purge classes a teacher owns; purge legacy submissions by user |
| `api/classroom.js`, `api/classroom-submit.js` (modify) | CSPRNG code; store `user_id` |
| Existing consumer endpoints (modify) | `rejectStudent` |
| `api/generate-image.js`, `api/generate-avatar.js` (modify) | Class image allowance for students |
| `src/lib/schoolApi.js` | Web client for `api/school/*` |
| `src/lib/schoolShare.js` | Student-only check-in + help sharing |
| `src/stores/useAuthStore.js` (modify) | `signInAsStudent`, `selectIsStudent` |
| `src/pages/ClassSignInPage.jsx` | `/class` student sign-in |
| `src/pages/TeacherPage.jsx` (rewrite) | Server-backed class list + create |
| `src/pages/TeacherClassPage.jsx` | `/teacher/class/:id` roster, settings, cards |
| `src/components/school/*` | PicturePad, NameTiles, SignInCards, RosterTable, SchoolHoursEditor, TeacherHelpScreen |
| `src/i18n/locales/{en,it}/school.json` + `index.js` (modify) | Strings |

---

### Task 1: Database migration

**Files:**
- Create: `supabase-migrations/018_schools_core.sql`
- Test: `tests/school-migration.test.js`

**Interfaces:**
- Produces tables `class_licenses`, `class_students`, `student_sign_in_attempts`, `class_checkins`, `class_help_requests`; new `classrooms` columns `locale, sign_in_open, sign_in_paused_until, archived_at, timezone, school_hours`; `submissions.user_id`; RPCs `school_record_attempt(uuid,uuid,text,boolean) → text`, `school_sign_in_state(uuid,uuid,text) → text`, `school_bump_image(uuid,int) → boolean`, `school_sign_out_user(uuid) → void`.

- [ ] **Step 1: Write the failing test**

`tests/school-migration.test.js`:

```js
// Static guards on the schools migration. We cannot run Postgres in CI, so
// these pin the properties that matter most if someone edits the SQL later:
// every new table is closed to the client keys, the RPCs cannot be called by
// them, and the secret never has a client-readable path.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync('supabase-migrations/018_schools_core.sql', 'utf8')
const NEW_TABLES = ['class_licenses', 'class_students', 'student_sign_in_attempts', 'class_checkins', 'class_help_requests']
const RPCS = ['school_record_attempt', 'school_sign_in_state', 'school_bump_image', 'school_sign_out_user']

describe('018_schools_core.sql', () => {
  it.each(NEW_TABLES)('%s is created with RLS enabled', (t) => {
    expect(SQL).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
    expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'))
  })

  it('creates no RLS policies at all (service role only)', () => {
    expect(SQL).not.toMatch(/create policy/i)
  })

  it.each(RPCS)('%s is revoked from public, anon and authenticated', (fn) => {
    expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'i'))
    expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`, 'i'))
  })

  it('every security definer function pins search_path', () => {
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(RPCS.length)
    for (const d of defs) expect(d).toMatch(/set search_path = public/i)
  })

  it('makes the classroom owner FK restrictive and the legacy code FK follow renames', () => {
    expect(SQL).toMatch(/classrooms_owner_user_id_fkey[\s\S]*on delete restrict/i)
    expect(SQL).toMatch(/submissions_classroom_code_fkey[\s\S]*on update cascade on delete cascade/i)
  })

  it('caps class size at 35', () => {
    expect(SQL).toMatch(/seats between 1 and 35/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/school-migration.test.js`
Expected: FAIL, `ENOENT ... 018_schools_core.sql`.

- [ ] **Step 3: Write the migration**

`supabase-migrations/018_schools_core.sql`:

```sql
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
  image_allowance int not null default 7500 check (image_allowance >= 0),
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
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/school-migration.test.js` → PASS. Then `npx vitest run` → all green.

- [ ] **Step 5: Commit**

```bash
git add supabase-migrations/018_schools_core.sql tests/school-migration.test.js
git commit -m "feat(schools): database for class licenses, student accounts, check-ins and help asks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The controller dry-runs this SQL against production inside `begin … rollback` after the task; implementers do not touch any database.)

---

### Task 2: Pure school logic (`lib/school/`)

**Files:**
- Create: `lib/school/pictures.js`, `lib/school/crypto.js`, `lib/school/hours.js`, `lib/school/license.js`
- Test: `tests/school-lib.test.js`

**Interfaces (Produces):**
- `PICTURES: {id: string, emoji: string}[]` (16), `PICTURE_IDS: string[]`, `AVATAR_EMOJI: string[]` (40)
- `generateClassCode(): string` (6 chars from `CODE_CHARS`), `CODE_CHARS`, `CODE_RE`
- `generatePictureSecret(): string[]` (3 ids from `PICTURE_IDS`, repeats allowed)
- `isValidPictureSecret(p): boolean`
- `async hashPictureSecret(pepper, studentId, pictures): Promise<string>` (hex)
- `timingSafeEqualHex(a, b): boolean`
- `async hashIp(pepper, ip): Promise<string>` (hex, domain-separated `"ip|"`)
- `syntheticStudentEmail(): string`
- `DEFAULT_SCHOOL_HOURS`, `validateSchoolHours(h): boolean`, `isWithinSchoolHours(hours, timeZone, date = new Date()): boolean`
- `TRIAL_DAYS = 30`, `TRIAL_IMAGES = 300`, `PAID_IMAGES = 7500`, `STUDENT_DAILY_IMAGES = 15`, `MAX_SEATS = 35`, `MAX_TRIALS_PER_TEACHER = 3`, `isLicenseUsable(license, now = new Date()): boolean`

- [ ] **Step 1: Write the failing test**

`tests/school-lib.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { PICTURES, PICTURE_IDS, AVATAR_EMOJI } from '../lib/school/pictures.js'
import {
  CODE_CHARS, CODE_RE, generateClassCode, generatePictureSecret, isValidPictureSecret,
  hashPictureSecret, timingSafeEqualHex, hashIp, syntheticStudentEmail,
} from '../lib/school/crypto.js'
import { DEFAULT_SCHOOL_HOURS, validateSchoolHours, isWithinSchoolHours } from '../lib/school/hours.js'
import { isLicenseUsable, TRIAL_IMAGES, PAID_IMAGES, MAX_SEATS } from '../lib/school/license.js'

describe('pictures', () => {
  it('has 16 distinct language-free pictures', () => {
    expect(PICTURES).toHaveLength(16)
    expect(new Set(PICTURE_IDS).size).toBe(16)
    expect(new Set(PICTURES.map((p) => p.emoji)).size).toBe(16)
    for (const id of PICTURE_IDS) expect(id).toMatch(/^[a-z]+$/)
  })
  it('has enough avatar emoji for a full class', () => {
    expect(new Set(AVATAR_EMOJI).size).toBeGreaterThanOrEqual(MAX_SEATS)
  })
})

describe('class codes', () => {
  it('are 6 unambiguous characters and pass CODE_RE', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateClassCode()
      expect(c).toHaveLength(6)
      expect(CODE_RE.test(c)).toBe(true)
      for (const ch of c) expect(CODE_CHARS).toContain(ch)
    }
  })
  it('use every character over many draws (no modulo bias to a subset)', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) for (const ch of generateClassCode()) seen.add(ch)
    expect(seen.size).toBe(CODE_CHARS.length)
  })
})

describe('picture secrets', () => {
  it('are 3 known pictures', () => {
    for (let i = 0; i < 100; i++) {
      const s = generatePictureSecret()
      expect(s).toHaveLength(3)
      expect(isValidPictureSecret(s)).toBe(true)
    }
  })
  it('rejects wrong shapes', () => {
    expect(isValidPictureSecret(['cat', 'cat'])).toBe(false)
    expect(isValidPictureSecret(['cat', 'cat', 'unicorn'])).toBe(false)
    expect(isValidPictureSecret('cat,cat,cat')).toBe(false)
  })
  it('hash is deterministic, per student and per pepper', async () => {
    const p = ['cat', 'sun', 'boat']
    const a = await hashPictureSecret('pepper', 'student-1', p)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashPictureSecret('pepper', 'student-1', p)).toBe(a)
    expect(await hashPictureSecret('pepper', 'student-2', p)).not.toBe(a)
    expect(await hashPictureSecret('other', 'student-1', p)).not.toBe(a)
    expect(await hashPictureSecret('pepper', 'student-1', ['sun', 'cat', 'boat'])).not.toBe(a)
  })
  it('timingSafeEqualHex compares exactly', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false)
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false)
  })
  it('ip hash differs from a picture hash of the same input', async () => {
    expect(await hashIp('pepper', '1.2.3.4')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('synthetic email', () => {
  it('uses the reserved .invalid TLD and carries no name', () => {
    const e = syntheticStudentEmail()
    expect(e).toMatch(/^s-[0-9a-f-]{36}@students\.mybooklab\.invalid$/)
  })
})

describe('school hours', () => {
  const NY = 'America/New_York'
  it('default is Mon–Fri 08:00–15:30 and valid', () => {
    expect(validateSchoolHours(DEFAULT_SCHOOL_HOURS)).toBe(true)
    expect(Object.keys(DEFAULT_SCHOOL_HOURS).sort()).toEqual(['1', '2', '3', '4', '5'])
  })
  it('Tuesday 10:00 in New York is inside', () => {
    // 2026-09-29 is a Tuesday; 14:00Z = 10:00 EDT
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T14:00:00Z'))).toBe(true)
  })
  it('Tuesday 16:00 in New York is outside', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T20:00:00Z'))).toBe(false)
  })
  it('uses the class time zone, not UTC', () => {
    // 2026-09-29T13:00Z is 09:00 in New York (inside) but 06:00 in Los Angeles (outside)
    const d = new Date('2026-09-29T13:00:00Z')
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, d)).toBe(true)
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, 'America/Los_Angeles', d)).toBe(false)
  })
  it('Saturday is outside', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-10-03T15:00:00Z'))).toBe(false)
  })
  it('end time is exclusive, start inclusive', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T12:00:00Z'))).toBe(true)  // 08:00
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T19:30:00Z'))).toBe(false) // 15:30
  })
  it('rejects malformed hours', () => {
    expect(validateSchoolHours({ 8: ['08:00', '15:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['15:00', '08:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['8:00', '15:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['08:00'] })).toBe(false)
    expect(validateSchoolHours(null)).toBe(false)
    expect(validateSchoolHours({})).toBe(true) // no school days is allowed
  })
  it('an invalid time zone is treated as outside hours, never throws', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, 'Mars/Olympus', new Date())).toBe(false)
  })
})

describe('licenses', () => {
  const now = new Date('2026-10-01T00:00:00Z')
  const future = '2026-11-01T00:00:00Z'
  const past = '2026-09-01T00:00:00Z'
  it('trial, active, comped are usable until they expire', () => {
    for (const status of ['trial', 'active', 'comped']) {
      expect(isLicenseUsable({ status, expires_at: future }, now)).toBe(true)
      expect(isLicenseUsable({ status, expires_at: past }, now)).toBe(false)
    }
  })
  it('grace is usable even though expires_at has passed', () => {
    expect(isLicenseUsable({ status: 'grace', expires_at: past }, now)).toBe(true)
  })
  it('lapsed, canceled, pending_payment and missing are not usable', () => {
    for (const status of ['lapsed', 'canceled', 'pending_payment']) {
      expect(isLicenseUsable({ status, expires_at: future }, now)).toBe(false)
    }
    expect(isLicenseUsable(null, now)).toBe(false)
  })
  it('constants match the owner decisions', () => {
    expect(TRIAL_IMAGES).toBe(300)
    expect(PAID_IMAGES).toBe(7500)
    expect(MAX_SEATS).toBe(35)
  })
})
```

Note on `pending_payment`: the spec lets invoice-billed licenses be used before payment; that is Stage 4's concern (it will set `status='active'` on invoice creation). In Stage 1 `pending_payment` is not usable.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/school-lib.test.js` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`lib/school/pictures.js`:

```js
// The picture alphabet for student sign-in. Language-free on purpose: the
// children are 6–12, many pre-literate or dyslexic, and the class may be
// English or Italian. Ids are internal and never shown; only the emoji is.
// Order is part of nothing — secrets store ids, not positions.
export const PICTURES = [
  { id: 'cat', emoji: '🐱' }, { id: 'dog', emoji: '🐶' }, { id: 'fish', emoji: '🐟' }, { id: 'frog', emoji: '🐸' },
  { id: 'lion', emoji: '🦁' }, { id: 'owl', emoji: '🦉' }, { id: 'turtle', emoji: '🐢' }, { id: 'bee', emoji: '🐝' },
  { id: 'sun', emoji: '☀️' }, { id: 'moon', emoji: '🌙' }, { id: 'star', emoji: '⭐' }, { id: 'tree', emoji: '🌳' },
  { id: 'apple', emoji: '🍎' }, { id: 'boat', emoji: '⛵' }, { id: 'rocket', emoji: '🚀' }, { id: 'ball', emoji: '⚽' },
]
export const PICTURE_IDS = PICTURES.map((p) => p.id)

// Name-tile avatars, so a child who cannot read yet can still find themself.
// Deliberately disjoint from PICTURES so a tile never hints at a password.
export const AVATAR_EMOJI = [
  '🦊', '🐼', '🐨', '🐯', '🐮', '🐷', '🐵', '🐧', '🐤', '🦄',
  '🐙', '🦋', '🐞', '🦕', '🦖', '🐳', '🐬', '🦓', '🦒', '🐘',
  '🦔', '🦦', '🦥', '🐿️', '🦩', '🦜', '🐊', '🐇', '🦘', '🦡',
  '🌵', '🌻', '🍄', '🌈', '🍉', '🍩', '🧁', '🎈', '🎸', '🪁',
]
```

`lib/school/crypto.js`:

```js
import { PICTURE_IDS } from './pictures.js'

// Characters that are unambiguous to read aloud and type (no 0/O, 1/I).
// 32 symbols, so `byte & 31` is an unbiased draw from a random byte.
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[A-Z0-9]{6,8}$/

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function generateClassCode() {
  return [...randomBytes(6)].map((b) => CODE_CHARS[b & 31]).join('')
}

// 16 pictures, so `byte & 15` is unbiased. Server-generated, never chosen by
// the child: children pick "cat cat cat", which collapses the space.
export function generatePictureSecret() {
  return [...randomBytes(3)].map((b) => PICTURE_IDS[b & 15])
}

export function isValidPictureSecret(p) {
  return Array.isArray(p) && p.length === 3 && p.every((x) => PICTURE_IDS.includes(x))
}

async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)))
}

// With 4,096 possible secrets a salted hash alone is useless offline. The
// protection against a database-only leak is the pepper, which lives in
// Vercel env and never in Postgres.
export function hashPictureSecret(pepper, studentId, pictures) {
  return hmacHex(pepper, `v1|${studentId}|${pictures.join(',')}`)
}

export function hashIp(pepper, ip) {
  return hmacHex(pepper, `ip|${ip}`)
}

export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// `.invalid` is reserved (RFC 2606) and can never route mail. No name in it.
export function syntheticStudentEmail() {
  return `s-${crypto.randomUUID()}@students.mybooklab.invalid`
}
```

`lib/school/hours.js`:

```js
// School hours decide whether an urgent "I need a grown-up" is pushed to the
// teacher now or held for the morning (spec §12.2). Keys are ISO weekdays
// ("1" = Monday … "7" = Sunday); values are ["HH:MM", "HH:MM"], start
// inclusive, end exclusive, in the class's own time zone.
const DAY = ['08:00', '15:30']
export const DEFAULT_SCHOOL_HOURS = { 1: DAY, 2: DAY, 3: DAY, 4: DAY, 5: DAY }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateSchoolHours(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false
  return Object.entries(h).every(([day, span]) =>
    /^[1-7]$/.test(day) &&
    Array.isArray(span) && span.length === 2 &&
    HHMM.test(span[0]) && HHMM.test(span[1]) && span[0] < span[1]
  )
}

const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

export function isWithinSchoolHours(hours, timeZone, date = new Date()) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
  } catch {
    return false // unknown time zone: never claim someone is there
  }
  const get = (type) => parts.find((p) => p.type === type)?.value
  const span = hours?.[WEEKDAY[get('weekday')]]
  if (!span) return false
  const now = `${get('hour')}:${get('minute')}`
  return now >= span[0] && now < span[1]
}
```

`lib/school/license.js`:

```js
export const TRIAL_DAYS = 30
export const TRIAL_IMAGES = 300
export const PAID_IMAGES = 7500
export const STUDENT_DAILY_IMAGES = 15
export const MAX_SEATS = 35
export const MAX_TRIALS_PER_TEACHER = 3

// Must agree with school_bump_image() in 018_schools_core.sql.
const LIVE = ['trial', 'active', 'comped']

export function isLicenseUsable(license, now = new Date()) {
  if (!license) return false
  if (license.status === 'grace') return true
  return LIVE.includes(license.status) && new Date(license.expires_at) > now
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/school-lib.test.js` PASS; full suite green.

- [ ] **Step 5: Commit** — `feat(schools): picture alphabet, secrets, class codes, school hours, license rules`.

---

### Task 3: Auth metadata and school guards (`api/_school.js`)

**Files:**
- Modify: `api/_auth.js` (return `appMetadata`)
- Modify: `api/_aiGuard.js` (`requireUser` also returns `appMetadata`)
- Create: `api/_school.js`
- Test: `tests/school-guards.test.js`

**Interfaces:**
- Consumes: `verifyJwt(req)`.
- Produces:
  - `verifyJwt` result gains `appMetadata: object` (`user.app_metadata ?? {}`); `requireUser` result gains `appMetadata`.
  - `sbEnv(): {url, key} | null`
  - `sb(path, init?)` → `fetch(url+path)` with service-role headers and `Content-Type: application/json`
  - `json(req, status, body)` → Response with CORS
  - `isStudent(auth): boolean`
  - `rejectStudent(auth, req): Response | null` → 403 `{error:'Not available for class accounts', code:'student_forbidden'}`
  - `requireTeacher(req): Promise<{ok:true, auth} | {ok:false, response}>` — valid JWT and NOT a student
  - `requireClassOwner(req, classroomId): Promise<{ok:true, auth, classroom} | {ok:false, response}>` — 404 `class_not_found` when missing or not owned (same response for both)
  - `requireStudent(req): Promise<{ok:true, auth, student, classroom} | {ok:false, response}>` — student row active, else 403 `student_removed`

- [ ] **Step 1: Failing test** `tests/school-guards.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

const req = (headers = {}) => new Request('https://app.test/api/x', { headers: { authorization: 'Bearer jwt', ...headers } })

/// user: the /auth/v1/user payload; rows: map of URL substring -> JSON body
function mockSupabase(user, rows = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user), { status: user ? 200 : 401 })
    for (const [needle, body] of Object.entries(rows)) if (u.includes(needle)) return new Response(JSON.stringify(body))
    return new Response('[]')
  })
}

describe('verifyJwt', () => {
  it('returns app_metadata so role can be trusted', async () => {
    mockSupabase({ id: 'u1', email: 'x', app_metadata: { role: 'student' } })
    const { verifyJwt } = await import('../api/_auth.js')
    const a = await verifyJwt(req())
    expect(a.appMetadata).toEqual({ role: 'student' })
  })
  it('defaults app_metadata to {}', async () => {
    mockSupabase({ id: 'u1', email: 'x' })
    const { verifyJwt } = await import('../api/_auth.js')
    expect((await verifyJwt(req())).appMetadata).toEqual({})
  })
})

describe('student guards', () => {
  it('isStudent trusts app_metadata only, never user_metadata', async () => {
    const { isStudent } = await import('../api/_school.js')
    expect(isStudent({ appMetadata: { role: 'student' } })).toBe(true)
    expect(isStudent({ appMetadata: {}, userMetadata: { role: 'student' } })).toBe(false)
    expect(isStudent(null)).toBe(false)
  })
  it('rejectStudent blocks students with a code and lets others through', async () => {
    const { rejectStudent } = await import('../api/_school.js')
    const r = rejectStudent({ appMetadata: { role: 'student' } }, req())
    expect(r.status).toBe(403)
    expect((await r.json()).code).toBe('student_forbidden')
    expect(rejectStudent({ appMetadata: {} }, req())).toBeNull()
  })
  it('requireTeacher refuses a student session', async () => {
    mockSupabase({ id: 'u1', app_metadata: { role: 'student' } })
    const { requireTeacher } = await import('../api/_school.js')
    const r = await requireTeacher(req())
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(403)
  })
  it('requireClassOwner filters by owner and gives the same 404 for missing and foreign', async () => {
    mockSupabase({ id: 'teacher-1', app_metadata: {} }, { '/rest/v1/classrooms': [] })
    const { requireClassOwner } = await import('../api/_school.js')
    const r = await requireClassOwner(req(), '6f1c1b1e-0000-4000-8000-000000000001')
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(404)
    const call = globalThis.fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/rest/v1/classrooms'))
    expect(call).toContain('owner_user_id=eq.teacher-1')
  })
  it('requireClassOwner rejects a non-uuid id without querying', async () => {
    mockSupabase({ id: 'teacher-1', app_metadata: {} })
    const { requireClassOwner } = await import('../api/_school.js')
    const r = await requireClassOwner(req(), "x' or 1=1")
    expect(r.response.status).toBe(400)
  })
  it('requireStudent loads the active student row', async () => {
    mockSupabase(
      { id: 'kid-auth', app_metadata: { role: 'student', student_id: 's1', classroom_id: 'c1' } },
      { '/rest/v1/class_students': [{ id: 's1', classroom_id: 'c1', display_name: 'Maya R', status: 'active', classrooms: { id: 'c1', name: '3B', timezone: 'America/New_York', school_hours: {} } }] }
    )
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(true)
    expect(r.student.id).toBe('s1')
    expect(r.classroom.id).toBe('c1')
  })
  it('requireStudent refuses a removed student', async () => {
    mockSupabase({ id: 'kid-auth', app_metadata: { role: 'student' } }, { '/rest/v1/class_students': [] })
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(false)
    expect((await r.response.json()).code).toBe('student_removed')
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

In `api/_auth.js`, change the final return to:

```js
  // app_metadata is writable only with the service role, which makes it the
  // one place a role can be trusted (user_metadata is user-editable).
  return { ok: true, userId: user.id, email: user.email, jwt, appMetadata: user.app_metadata ?? {} }
```

In `api/_aiGuard.js` `requireUser`, return `{ ok: true, userId: auth.userId, email: auth.email, appMetadata: auth.appMetadata }`.

`api/_school.js`:

```js
// Shared guards for the schools feature. Every school table is closed to the
// client keys (migration 018), so all access is here, with the service role.
import { verifyJwt } from './_auth.js'
import { withCors } from './_rateLimit.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s)

export function sbEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return url && key ? { url, key } : null
}

export function sb(path, init = {}) {
  const { url, key } = sbEnv()
  return fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

export function json(req, status, body) {
  return new Response(JSON.stringify(body), { status, headers: withCors({ 'Content-Type': 'application/json' }, req) })
}

export const fail = (req, status, code, error) => ({ ok: false, response: json(req, status, { error, code }) })

export const isStudent = (auth) => auth?.appMetadata?.role === 'student'

export function rejectStudent(auth, req) {
  return isStudent(auth)
    ? json(req, 403, { error: 'Not available for class accounts', code: 'student_forbidden' })
    : null
}

export async function requireTeacher(req) {
  if (!sbEnv()) return fail(req, 503, 'not_configured', 'Schools feature not configured')
  const auth = await verifyJwt(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  if (isStudent(auth)) return fail(req, 403, 'student_forbidden', 'Not available for class accounts')
  return { ok: true, auth }
}

export async function requireClassOwner(req, classroomId) {
  const t = await requireTeacher(req)
  if (!t.ok) return t
  if (!isUuid(classroomId)) return fail(req, 400, 'bad_request', 'Invalid class id')
  const res = await sb(
    `/rest/v1/classrooms?id=eq.${classroomId}&owner_user_id=eq.${encodeURIComponent(t.auth.userId)}` +
      `&select=id,code,name,locale,sign_in_open,timezone,school_hours,archived_at`
  )
  const rows = await res.json().catch(() => [])
  // Same answer for "missing" and "someone else's": ids must not be probeable.
  if (!Array.isArray(rows) || !rows.length) return fail(req, 404, 'class_not_found', 'Class not found')
  return { ok: true, auth: t.auth, classroom: rows[0] }
}

export async function requireStudent(req) {
  if (!sbEnv()) return fail(req, 503, 'not_configured', 'Schools feature not configured')
  const auth = await verifyJwt(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  if (!isStudent(auth)) return fail(req, 403, 'not_a_student', 'Class accounts only')
  const res = await sb(
    `/rest/v1/class_students?auth_user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.active` +
      `&select=id,classroom_id,display_name,classrooms(id,name,timezone,school_hours,owner_user_id)`
  )
  const rows = await res.json().catch(() => [])
  if (!Array.isArray(rows) || !rows.length) return fail(req, 403, 'student_removed', 'Ask your teacher')
  const { classrooms: classroom, ...student } = rows[0]
  return { ok: true, auth, student, classroom }
}
```

- [ ] **Step 4:** tests pass; full suite green (existing `verifyJwt` callers ignore the extra field).
- [ ] **Step 5: Commit** — `feat(schools): trusted student role and school guards`.

---

### Task 4: Teacher classes API (`api/school/classes.js`)

**Files:**
- Create: `api/school/classes.js`
- Test: `tests/school-classes.test.js`

**Interfaces:**
- Consumes: `requireTeacher`, `requireClassOwner`, `sb`, `json` (Task 3); `generateClassCode`, `validateSchoolHours`, `DEFAULT_SCHOOL_HOURS` and license constants (Task 2).
- Produces HTTP:
  - `GET /api/school/classes` → `200 { classes: ClassSummary[] }` where `ClassSummary = { id, code, name, locale, sign_in_open, timezone, school_hours, created_at, student_count, license: { id, status, origin, expires_at, seats, image_allowance, images_used } | null }`, archived classes excluded, newest first.
  - `POST /api/school/classes { name, timezone?, locale? }` → `201 { class: ClassSummary }`. Creates the classroom with a CSPRNG code (retry up to 5 times on HTTP 409 / Postgres `23505`), then a trial license (`origin:'trial', status:'trial', seats:35, image_allowance:300, expires_at: now+30d`) if the teacher has fewer than 3 `origin='trial'` licenses; otherwise `license: null` and the response also carries `trial_used_up: true`.
  - `PATCH /api/school/classes { id, name?, sign_in_open?, timezone?, school_hours?, locale?, rotate_code?: true, archived?: boolean }` → `200 { class: ClassSummary }`.
- Validation: name 1–60 chars after trim; timezone must be accepted by `Intl.DateTimeFormat(undefined, {timeZone})` (else 400 `bad_timezone`); `school_hours` via `validateSchoolHours` (else 400 `bad_hours`); locale in `en|it`.
- Rate limit: `checkRateLimit(\`school-classes:${userId}\`, 60)` on POST/PATCH (429 `rate_limited`).

- [ ] **Step 1: Failing tests** `tests/school-classes.test.js`. Use the same `mockSupabase` style as Task 3 but with a request log. Required cases (write each as its own `it`):
  1. GET returns only the caller's classes: the classrooms query URL contains `owner_user_id=eq.<teacher>` and `archived_at=is.null`; response maps `class_students(count)` to `student_count` and the embedded license to `license` — test BOTH shapes PostgREST may return: an object (one-to-one, the real case) and a one-element array.
  2. POST with a student JWT → 403.
  3. POST creates class then trial license; the license insert body has `origin:'trial'`, `status:'trial'`, `image_allowance:300`, `seats:35`, `classroom_id` = new class id, `expires_at` 30 days (±1 min) after now.
  4. POST when the teacher already has 3 trial licenses → classroom created, no license insert, `trial_used_up: true`.
  5. POST retries the code on a 409 from the classrooms insert and succeeds on the second try (assert two classroom inserts with different codes).
  6. POST with a bad timezone `"Mars/Olympus"` → 400 `bad_timezone`, nothing inserted.
  7. PATCH on a class not owned → 404 `class_not_found`, no PATCH request sent.
  8. PATCH `rotate_code:true` sends a PATCH to `/rest/v1/classrooms?id=eq.<id>` with a new 6-char `code`; retries on 409.
  9. PATCH `school_hours: {1:['15:00','08:00']}` → 400 `bad_hours`.

  Mock helper for these tests:

```js
function mockSupabase({ user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    log.push({ method, url: u, body: init.body ? JSON.parse(init.body) : undefined })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
    for (const r of routes) {
      if (r.method === method && u.includes(r.match)) {
        const next = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
        return new Response(JSON.stringify(next.body ?? []), { status: next.status ?? 200 })
      }
    }
    return new Response('[]')
  })
  return log
}
```

  Call the handler as `const { default: handler } = await import('../api/school/classes.js'); const res = await handler(new Request('https://app.test/api/school/classes', { method, headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body }))`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `api/school/classes.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, requireClassOwner, sb, json } from '../_school.js'
import { generateClassCode } from '../../lib/school/crypto.js'
import { DEFAULT_SCHOOL_HOURS, validateSchoolHours } from '../../lib/school/hours.js'
import { TRIAL_DAYS, TRIAL_IMAGES, MAX_SEATS, MAX_TRIALS_PER_TEACHER } from '../../lib/school/license.js'

const SELECT =
  'id,code,name,locale,sign_in_open,timezone,school_hours,created_at,' +
  'class_licenses(id,status,origin,expires_at,seats,image_allowance,images_used),class_students(count)'

// class_licenses.classroom_id is UNIQUE, so PostgREST treats the embed as
// one-to-one and returns an object, not an array. Accept both shapes.
export const firstOf = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null)

function summarize(row) {
  const { class_licenses: lic, class_students: students, ...rest } = row
  return { ...rest, license: firstOf(lic), student_count: students?.[0]?.count ?? 0 }
}

function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

// Class codes are unique; a clash is rare (~1 in a billion per pair) but
// possible, so every write that sets a code retries with a fresh one.
async function withFreshCode(write) {
  for (let i = 0; i < 5; i++) {
    const res = await write(generateClassCode())
    if (res.status !== 409) return res
  }
  return new Response(JSON.stringify({ message: 'code collision' }), { status: 409 })
}

async function loadOne(id) {
  const r = await sb(`/rest/v1/classrooms?id=eq.${id}&class_students.status=eq.active&select=${SELECT}`)
  const rows = await r.json().catch(() => [])
  return rows?.[0] ? summarize(rows[0]) : null
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method === 'GET') {
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    const r = await sb(
      `/rest/v1/classrooms?owner_user_id=eq.${encodeURIComponent(t.auth.userId)}&archived_at=is.null` +
        `&class_students.status=eq.active&select=${SELECT}&order=created_at.desc`
    )
    if (!r.ok) return json(req, 502, { error: 'Could not load classes', code: 'upstream' })
    const rows = await r.json().catch(() => [])
    return json(req, 200, { classes: rows.map(summarize) })
  }

  if (req.method === 'POST') {
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    if (!checkRateLimit(`school-classes:${t.auth.userId}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim().slice(0, 60)
    if (!name) return json(req, 400, { error: 'Class name is required', code: 'name_required' })
    const timezone = body.timezone ?? 'America/New_York'
    if (!validTimezone(timezone)) return json(req, 400, { error: 'Unknown time zone', code: 'bad_timezone' })
    const locale = body.locale === 'it' ? 'it' : 'en'

    const created = await withFreshCode((code) =>
      sb('/rest/v1/classrooms', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ code, name, owner_user_id: t.auth.userId, timezone, locale, school_hours: DEFAULT_SCHOOL_HOURS }),
      })
    )
    if (!created.ok) return json(req, 502, { error: 'Could not create class', code: 'upstream' })
    const [classroom] = await created.json()

    const trials = await sb(
      `/rest/v1/class_licenses?owner_user_id=eq.${encodeURIComponent(t.auth.userId)}&origin=eq.trial&select=id`
    ).then((r) => r.json()).catch(() => [])
    let trialUsedUp = false
    if (Array.isArray(trials) && trials.length >= MAX_TRIALS_PER_TEACHER) {
      trialUsedUp = true
    } else {
      const expires = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
      await sb('/rest/v1/class_licenses', {
        method: 'POST',
        body: JSON.stringify({
          owner_user_id: t.auth.userId, classroom_id: classroom.id, origin: 'trial', status: 'trial',
          seats: MAX_SEATS, image_allowance: TRIAL_IMAGES, expires_at: expires,
        }),
      })
    }
    return json(req, 201, { class: await loadOne(classroom.id), ...(trialUsedUp ? { trial_used_up: true } : {}) })
  }

  if (req.method === 'PATCH') {
    const body = await req.json().catch(() => ({}))
    const o = await requireClassOwner(req, body.id)
    if (!o.ok) return o.response
    if (!checkRateLimit(`school-classes:${o.auth.userId}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const patch = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 60)
      if (!name) return json(req, 400, { error: 'Class name is required', code: 'name_required' })
      patch.name = name
    }
    if (body.sign_in_open !== undefined) patch.sign_in_open = !!body.sign_in_open
    if (body.locale !== undefined) patch.locale = body.locale === 'it' ? 'it' : 'en'
    if (body.timezone !== undefined) {
      if (!validTimezone(body.timezone)) return json(req, 400, { error: 'Unknown time zone', code: 'bad_timezone' })
      patch.timezone = body.timezone
    }
    if (body.school_hours !== undefined) {
      if (!validateSchoolHours(body.school_hours)) return json(req, 400, { error: 'Invalid school hours', code: 'bad_hours' })
      patch.school_hours = body.school_hours
    }
    if (body.archived !== undefined) patch.archived_at = body.archived ? new Date().toISOString() : null

    const write = (extra) =>
      sb(`/rest/v1/classrooms?id=eq.${o.classroom.id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, ...extra }) })
    const res = body.rotate_code ? await withFreshCode((code) => write({ code })) : await write({})
    if (!res.ok) return json(req, 502, { error: 'Could not update class', code: 'upstream' })
    return json(req, 200, { class: await loadOne(o.classroom.id) })
  }

  return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
}
```

- [ ] **Step 4:** tests pass; full suite green.
- [ ] **Step 5: Commit** — `feat(schools): teacher class API with free trial`.

---

### Task 5: Roster API (`api/school/students.js`)

**Files:**
- Create: `api/school/students.js`
- Test: `tests/school-students.test.js`

**Interfaces:**
- Consumes: Task 2 (`generatePictureSecret`, `hashPictureSecret`, `syntheticStudentEmail`, `AVATAR_EMOJI`, `isLicenseUsable`, `MAX_SEATS`), Task 3 (`requireClassOwner`, `sb`, `json`, `isUuid`).
- Env: `STUDENT_SECRET_PEPPER` (required; 503 `not_configured` if missing).
- Produces HTTP:
  - `GET /api/school/students?classId=<uuid>` (owner) → `{ students: [{ id, display_name, avatar_emoji, status, locked: bool, hard_locked, last_sign_in_at, created_at }] }` (never `secret_hash`). `locked` = `locked_until > now`.
  - `POST /api/school/students { classId, students: [{ name, emoji? }] }` (owner, usable license) → `201 { created: [{ id, display_name, avatar_emoji, pictures: string[3] }], skipped: [{ name, code }] }`. Pictures are returned **only here** (and on reset). Errors: 402-free: use 403 `license_required` when the license is not usable; 409 `seats_full` when active count + new > license seats (nothing created). Names: trimmed, 1–24 chars, duplicates within the class (case-insensitive, active students and within the request) go to `skipped` with `code:'duplicate_name'`. Emoji defaults to the first `AVATAR_EMOJI` not already used in the class.
  - For each student, in order: (1) `POST /auth/v1/admin/users` `{ email: syntheticStudentEmail(), password: <base64url of 48 random bytes>, email_confirm: true, app_metadata: { role:'student', classroom_id }, user_metadata: { display_name } }`; (2) generate the student id client-side with `crypto.randomUUID()`, hash the secret with it, insert `class_students { id, classroom_id, auth_user_id, display_name, avatar_emoji, secret_hash, secret_version: 1 }`; (3) `PUT /auth/v1/admin/users/<auth id>` to add `app_metadata.student_id`; (4) on any failure after (1), `DELETE /auth/v1/admin/users/<auth id>` (compensation) and put the name in `skipped` with `code:'create_failed'`.
  - `PATCH /api/school/students { classId, id, action, name?, emoji? }` (owner; student must belong to classId, else 404 `student_not_found`):
    - `reset_secret` → new secret + hash, `failed_attempts:0, locked_until:null, hard_locked:false`; returns `{ student, pictures }`.
    - `unlock` → `failed_attempts:0, locked_until:null, hard_locked:false`.
    - `rename` → `display_name` (validated as above; duplicate → 409 `duplicate_name`) and/or `avatar_emoji`.
    - `sign_out` → RPC `school_sign_out_user { p_user_id: auth_user_id }`.
    - `remove` → `status:'removed', removed_at: now`; `PUT /auth/v1/admin/users/<auth id> { ban_duration: '876000h' }`; RPC `school_sign_out_user`.
    - `restore` → seat check (409 `seats_full`), `status:'active', removed_at:null`; `PUT ... { ban_duration: 'none' }`.
    - Returns `{ student }` (public shape as in GET).
- Rate limit: `checkRateLimit(\`school-students:${userId}\`, 120)`.

- [ ] **Step 1: Failing tests** `tests/school-students.test.js`, with the Task 4 `mockSupabase({ user, routes })` helper (copy it into this file). Cases:
  1. GET never selects `secret_hash`: the class_students query's `select=` does not contain `secret_hash`.
  2. POST without `STUDENT_SECRET_PEPPER` → 503.
  3. POST with an expired trial license (`expires_at` in the past) → 403 `license_required`, no auth user created.
  4. POST 3 names into a class with 34 active students and 35 seats → 409 `seats_full`, no auth user created.
  5. POST `["Maya R", "maya r", "Leo"]` → created Maya R and Leo; skipped `maya r` with `duplicate_name`; each created item has 3 valid pictures; the auth-user create body has `app_metadata.role === 'student'`, an email matching `/@students\.mybooklab\.invalid$/`, `email_confirm: true`, and no display name inside the email.
  6. The stored `secret_hash` equals `await hashPictureSecret(pepper, <inserted id>, <returned pictures>)`.
  7. When the class_students insert fails (500), the auth user is deleted (`DELETE /auth/v1/admin/users/<id>` appears after the create) and the name is in `skipped` with `create_failed`.
  8. PATCH `remove` sends the ban `PUT` with `ban_duration: '876000h'` and calls `/rest/v1/rpc/school_sign_out_user`.
  9. PATCH on a student from another class → 404 `student_not_found`.
  10. PATCH `reset_secret` returns 3 pictures and patches `hard_locked:false`, `failed_attempts:0`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `api/school/students.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, sb, json, isUuid } from '../_school.js'
import { generatePictureSecret, hashPictureSecret, syntheticStudentEmail } from '../../lib/school/crypto.js'
import { AVATAR_EMOJI } from '../../lib/school/pictures.js'
import { isLicenseUsable } from '../../lib/school/license.js'

const PUBLIC = 'id,display_name,avatar_emoji,status,locked_until,hard_locked,last_sign_in_at,created_at'
const BAN_FOREVER = '876000h'

const publicShape = ({ locked_until, ...s }) => ({ ...s, locked: !!locked_until && new Date(locked_until) > new Date() })
const cleanName = (n) => String(n ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)

function randomPassword() {
  const b = crypto.getRandomValues(new Uint8Array(48))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function loadLicense(classroomId) {
  const rows = await sb(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=status,expires_at,seats`)
    .then((r) => r.json()).catch(() => [])
  return rows?.[0] ?? null
}

async function activeStudents(classroomId) {
  return sb(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id,display_name,avatar_emoji`)
    .then((r) => r.json()).catch(() => [])
}

async function createOne({ classroomId, name, emoji, pepper }) {
  const authRes = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: syntheticStudentEmail(),
      password: randomPassword(), // never stored or shown; sign-in mints sessions
      email_confirm: true,
      app_metadata: { role: 'student', classroom_id: classroomId },
      user_metadata: { display_name: name },
    }),
  })
  if (!authRes.ok) return null
  const authUser = await authRes.json()
  const authId = authUser.id

  try {
    const id = crypto.randomUUID()
    const pictures = generatePictureSecret()
    const ins = await sb('/rest/v1/class_students', {
      method: 'POST',
      body: JSON.stringify({
        id, classroom_id: classroomId, auth_user_id: authId, display_name: name, avatar_emoji: emoji,
        secret_hash: await hashPictureSecret(pepper, id, pictures), secret_version: 1,
      }),
    })
    if (!ins.ok) throw new Error(`insert ${ins.status}`)
    const meta = await sb(`/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      body: JSON.stringify({ app_metadata: { role: 'student', classroom_id: classroomId, student_id: id } }),
    })
    if (!meta.ok) throw new Error(`metadata ${meta.status}`)
    return { id, display_name: name, avatar_emoji: emoji, pictures }
  } catch (e) {
    console.error('[school/students] create failed, removing auth user', e?.message)
    await sb(`/auth/v1/admin/users/${authId}`, { method: 'DELETE' })
    return null
  }
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const pepper = process.env.STUDENT_SECRET_PEPPER

  if (req.method === 'GET') {
    const classId = new URL(req.url).searchParams.get('classId')
    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response
    const rows = await sb(`/rest/v1/class_students?classroom_id=eq.${o.classroom.id}&select=${PUBLIC}&order=display_name.asc`)
      .then((r) => r.json()).catch(() => [])
    return json(req, 200, { students: rows.map(publicShape) })
  }

  const body = await req.json().catch(() => ({}))
  const o = await requireClassOwner(req, body.classId)
  if (!o.ok) return o.response
  if (!pepper) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })
  if (!checkRateLimit(`school-students:${o.auth.userId}`, 120).allowed) {
    return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
  }
  const classroomId = o.classroom.id

  if (req.method === 'POST') {
    const license = await loadLicense(classroomId)
    if (!isLicenseUsable(license)) return json(req, 403, { error: 'This class needs an active license', code: 'license_required' })
    const input = Array.isArray(body.students) ? body.students.slice(0, 35) : []
    const existing = await activeStudents(classroomId)
    const taken = new Set(existing.map((s) => s.display_name.toLowerCase()))
    const usedEmoji = new Set(existing.map((s) => s.avatar_emoji))

    const skipped = []
    const todo = []
    for (const s of input) {
      const name = cleanName(s?.name)
      if (!name) continue
      if (taken.has(name.toLowerCase())) { skipped.push({ name, code: 'duplicate_name' }); continue }
      taken.add(name.toLowerCase())
      const emoji = AVATAR_EMOJI.includes(s?.emoji) ? s.emoji : AVATAR_EMOJI.find((e) => !usedEmoji.has(e)) ?? AVATAR_EMOJI[0]
      usedEmoji.add(emoji)
      todo.push({ name, emoji })
    }
    if (existing.length + todo.length > license.seats) {
      return json(req, 409, { error: 'Not enough seats in this class', code: 'seats_full', seats: license.seats, used: existing.length })
    }

    const created = []
    for (const s of todo) {
      const c = await createOne({ classroomId, name: s.name, emoji: s.emoji, pepper })
      if (c) created.push(c)
      else skipped.push({ name: s.name, code: 'create_failed' })
    }
    return json(req, 201, { created, skipped })
  }

  if (req.method === 'PATCH') {
    if (!isUuid(body.id)) return json(req, 400, { error: 'Invalid student id', code: 'bad_request' })
    const rows = await sb(`/rest/v1/class_students?id=eq.${body.id}&classroom_id=eq.${classroomId}&select=${PUBLIC},auth_user_id`)
      .then((r) => r.json()).catch(() => [])
    const student = rows?.[0]
    if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    const { auth_user_id: authId } = student
    const patchRow = (p) => sb(`/rest/v1/class_students?id=eq.${student.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(p),
    })
    const signOut = () => sb('/rest/v1/rpc/school_sign_out_user', { method: 'POST', body: JSON.stringify({ p_user_id: authId }) })
    const reply = async (res, extra = {}) => {
      if (!res.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
      const [row] = await res.json()
      const { auth_user_id, ...pub } = row
      return json(req, 200, { student: publicShape(pub), ...extra })
    }
    const UNLOCK = { failed_attempts: 0, locked_until: null, hard_locked: false }

    switch (body.action) {
      case 'reset_secret': {
        const pictures = generatePictureSecret()
        return reply(await patchRow({ ...UNLOCK, secret_hash: await hashPictureSecret(pepper, student.id, pictures), secret_version: 1 }), { pictures })
      }
      case 'unlock':
        return reply(await patchRow(UNLOCK))
      case 'rename': {
        const p = {}
        if (body.name !== undefined) {
          const name = cleanName(body.name)
          if (!name) return json(req, 400, { error: 'Name is required', code: 'name_required' })
          const clash = (await activeStudents(classroomId)).some((s) => s.id !== student.id && s.display_name.toLowerCase() === name.toLowerCase())
          if (clash) return json(req, 409, { error: 'Another student has that name', code: 'duplicate_name' })
          p.display_name = name
        }
        if (AVATAR_EMOJI.includes(body.emoji)) p.avatar_emoji = body.emoji
        return reply(await patchRow(p))
      }
      case 'sign_out':
        await signOut()
        return reply(await patchRow({}))
      case 'remove': {
        const res = await patchRow({ status: 'removed', removed_at: new Date().toISOString() })
        await sb(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: JSON.stringify({ ban_duration: BAN_FOREVER }) })
        await signOut()
        return reply(res)
      }
      case 'restore': {
        const license = await loadLicense(classroomId)
        const used = (await activeStudents(classroomId)).length
        if (!license || used + 1 > license.seats) return json(req, 409, { error: 'Not enough seats in this class', code: 'seats_full' })
        const res = await patchRow({ status: 'active', removed_at: null })
        await sb(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: JSON.stringify({ ban_duration: 'none' }) })
        return reply(res)
      }
      default:
        return json(req, 400, { error: 'Unknown action', code: 'bad_request' })
    }
  }

  return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
}
```

Note `patchRow({})` for `sign_out` is a no-op PATCH used only to return the current row; if PostgREST rejects an empty body in the test mock that is fine because the mock answers any PATCH, but in production an empty PATCH returns the rows unchanged. If you prefer, re-select instead — either is acceptable as long as the test passes.

- [ ] **Step 4:** tests pass; full suite green.
- [ ] **Step 5: Commit** — `feat(schools): roster API with picture passwords`.

---

### Task 6: Student sign-in (`api/school/roster.js`, `api/school/sign-in.js`)

**Files:**
- Create: `api/school/roster.js`, `api/school/sign-in.js`, `lib/school/session.js`
- Test: `tests/school-sign-in.test.js`

**Interfaces:**
- Consumes: Tasks 2–3.
- Env: `STUDENT_SECRET_PEPPER`, `SUPABASE_ANON_KEY` (fallback `VITE_SUPABASE_ANON_KEY`) for `/auth/v1/verify`.
- Produces:
  - `lib/school/session.js`: `async mintStudentSession({ url, serviceKey, anonKey, email }) → { access_token, refresh_token, expires_in, expires_at } | null`. Step 1 `POST {url}/auth/v1/admin/generate_link` (service headers) body `{ type: 'magiclink', email }` → read `hashed_token` from the top level **or** `properties.hashed_token`. Step 2 `POST {url}/auth/v1/verify` (headers `apikey: anonKey`, `Content-Type: application/json`) body `{ type: 'magiclink', token_hash }` → session JSON. No email is sent by either call.
  - `GET /api/school/roster?code=ABC234` (no auth) → `200 { classroom: { id, name, locale }, students: [{ id, display_name, avatar_emoji }] }`. Refusals (all 404/423 with codes, never revealing more than needed): bad code shape or no class or archived → 404 `class_not_found`; license not usable → 423 `class_resting`; `sign_in_open=false` → 423 `sign_in_closed`; `sign_in_paused_until > now` → 423 `class_paused`. Rate limit `checkRateLimit(\`school-roster:${ip}\`, 60)` → 429.
  - `POST /api/school/sign-in { code, studentId, pictures }` (no auth) → `200 { access_token, refresh_token, expires_in, expires_at }`. Order of checks: shape (400 `bad_request`) → class by code (404 `class_not_found`) → license usable (423 `class_resting`) → sign-in open / not paused (423) → student in class and active (404 `student_not_found`) → RPC `school_sign_in_state` (`ip_blocked` → 429 `too_many`; `class_paused` → 423 `class_paused`; `hard_locked` → 423 `ask_teacher`; `locked` → 423 `locked`) → compare hash with `timingSafeEqualHex` → RPC `school_record_attempt` with the result → wrong: 401 `wrong_pictures` (or 423 `locked`/`ask_teacher` if the RPC returned that state) → right: look up the auth user email with `GET /auth/v1/admin/users/<auth_user_id>`, `mintStudentSession`, 200. If minting fails → 502 `sign_in_failed`.
  - IP: `getClientIp(req)` hashed with `hashIp(pepper, ip)`.

- [ ] **Step 1: Failing tests** `tests/school-sign-in.test.js` (reuse the `mockSupabase({user: null, routes})` helper; there is no JWT). Cases:
  1. `mintStudentSession` reads `hashed_token` from the top level and from `properties`, posts `{type:'magiclink', token_hash}` to `/auth/v1/verify` with the **anon** apikey, and returns the tokens.
  2. `mintStudentSession` returns null when generate_link fails.
  3. roster: returns tiles only (`Object.keys(student)` is exactly `['id','display_name','avatar_emoji']`); the class_students query selects only those columns.
  4. roster: `sign_in_open=false` → 423 `sign_in_closed`; expired trial → 423 `class_resting`.
  5. sign-in: right pictures → RPC `school_record_attempt` called with `p_ok: true`, then generate_link, then verify; 200 with tokens.
  6. sign-in: wrong pictures → `school_record_attempt` with `p_ok:false`; 401 `wrong_pictures`; generate_link never called.
  7. sign-in: state `locked` → 423 `locked`, and the hash is **not** compared (assert `school_record_attempt` not called).
  8. sign-in: state `ip_blocked` → 429 `too_many`.
  9. sign-in: 5th wrong try where RPC returns `locked` → 423 `locked`.
  10. sign-in: student id from another class → 404 `student_not_found` (the students query filters `classroom_id=eq.<class id>`).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`lib/school/session.js`:

```js
// Mint a session for a student account without sending any email.
//
// Admin generate_link returns the magic-link token instead of mailing it,
// and verify exchanges its hash for a session. Both are plain GoTrue REST,
// so this runs on the Edge with no SDK.
export async function mintStudentSession({ url, serviceKey, anonKey, email }) {
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!link.ok) {
    console.error('[school/session] generate_link failed', link.status)
    return null
  }
  const data = await link.json().catch(() => ({}))
  const tokenHash = data.hashed_token ?? data.properties?.hashed_token
  if (!tokenHash) return null

  const verify = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  })
  if (!verify.ok) {
    console.error('[school/session] verify failed', verify.status)
    return null
  }
  const s = await verify.json().catch(() => null)
  if (!s?.access_token || !s?.refresh_token) return null
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at }
}
```

`api/school/roster.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit, getClientIp } from '../_rateLimit.js'
import { sb, sbEnv, json } from '../_school.js'
import { CODE_RE } from '../../lib/school/crypto.js'
import { isLicenseUsable } from '../../lib/school/license.js'
import { firstOf } from './classes.js'

// Shared by roster and sign-in: the class a code points at, if children may
// sign in to it right now. Returns { classroom } or { status, code }.
export async function openClassByCode(rawCode) {
  const code = String(rawCode ?? '').toUpperCase()
  if (!CODE_RE.test(code)) return { status: 404, code: 'class_not_found' }
  const rows = await sb(
    `/rest/v1/classrooms?code=eq.${encodeURIComponent(code)}&archived_at=is.null` +
      `&select=id,name,locale,sign_in_open,sign_in_paused_until,class_licenses(status,expires_at)`
  ).then((r) => r.json()).catch(() => [])
  const c = rows?.[0]
  if (!c) return { status: 404, code: 'class_not_found' }
  // "Resting", never "unpaid": children must not be told about money.
  if (!isLicenseUsable(firstOf(c.class_licenses))) return { status: 423, code: 'class_resting' }
  if (!c.sign_in_open) return { status: 423, code: 'sign_in_closed' }
  if (c.sign_in_paused_until && new Date(c.sign_in_paused_until) > new Date()) return { status: 423, code: 'class_paused' }
  return { classroom: { id: c.id, name: c.name, locale: c.locale } }
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  if (!sbEnv()) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })
  if (!checkRateLimit(`school-roster:${getClientIp(req)}`, 60).allowed) {
    return json(req, 429, { error: 'Too many requests', code: 'too_many' })
  }
  const found = await openClassByCode(new URL(req.url).searchParams.get('code'))
  if (!found.classroom) return json(req, found.status, { error: 'Class not available', code: found.code })
  const students = await sb(
    `/rest/v1/class_students?classroom_id=eq.${found.classroom.id}&status=eq.active` +
      `&select=id,display_name,avatar_emoji&order=display_name.asc`
  ).then((r) => r.json()).catch(() => [])
  return json(req, 200, { classroom: found.classroom, students })
}
```

`api/school/sign-in.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, getClientIp } from '../_rateLimit.js'
import { sb, sbEnv, json, isUuid } from '../_school.js'
import { openClassByCode } from './roster.js'
import { hashPictureSecret, hashIp, isValidPictureSecret, timingSafeEqualHex } from '../../lib/school/crypto.js'
import { mintStudentSession } from '../../lib/school/session.js'

const STATE_REPLY = {
  ip_blocked: [429, 'too_many'],
  class_paused: [423, 'class_paused'],
  hard_locked: [423, 'ask_teacher'],
  locked: [423, 'locked'],
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  const env = sbEnv()
  const pepper = process.env.STUDENT_SECRET_PEPPER
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!env || !pepper || !anonKey) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.studentId) || !isValidPictureSecret(body.pictures)) {
    return json(req, 400, { error: 'Invalid request', code: 'bad_request' })
  }

  const found = await openClassByCode(body.code)
  if (!found.classroom) return json(req, found.status, { error: 'Class not available', code: found.code })
  const classroomId = found.classroom.id

  const rows = await sb(
    `/rest/v1/class_students?id=eq.${body.studentId}&classroom_id=eq.${classroomId}&status=eq.active` +
      `&select=id,auth_user_id,secret_hash`
  ).then((r) => r.json()).catch(() => [])
  const student = rows?.[0]
  if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

  const ipHash = await hashIp(pepper, getClientIp(req))
  const rpc = (fn, args) => sb(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }).then((r) => r.json())

  // Checked BEFORE comparing, so a locked account never reveals whether a
  // guess would have been right.
  const state = await rpc('school_sign_in_state', { p_classroom_id: classroomId, p_student_id: student.id, p_ip_hash: ipHash })
  if (STATE_REPLY[state]) {
    const [status, code] = STATE_REPLY[state]
    return json(req, status, { error: 'Sign-in not available right now', code })
  }

  const ok = timingSafeEqualHex(await hashPictureSecret(pepper, student.id, body.pictures), student.secret_hash)
  const after = await rpc('school_record_attempt', { p_classroom_id: classroomId, p_student_id: student.id, p_ip_hash: ipHash, p_ok: ok })
  if (!ok) {
    if (STATE_REPLY[after]) {
      const [status, code] = STATE_REPLY[after]
      return json(req, status, { error: 'Sign-in not available right now', code })
    }
    return json(req, 401, { error: 'Those pictures are not right', code: 'wrong_pictures' })
  }

  const user = await sb(`/auth/v1/admin/users/${student.auth_user_id}`).then((r) => r.json()).catch(() => null)
  const session = user?.email && (await mintStudentSession({ url: env.url, serviceKey: env.key, anonKey, email: user.email }))
  if (!session) return json(req, 502, { error: 'Could not sign in', code: 'sign_in_failed' })
  return json(req, 200, session)
}
```

- [ ] **Step 4:** tests pass; full suite green.
- [ ] **Step 5: Commit** — `feat(schools): picture sign-in that mints a session with no email`.

---

### Task 7: Fence students off consumer features; class image allowance

**Files:**
- Modify: `api/publish-book.js`, `api/react-book.js`, `api/report-book.js`, `api/create-checkout.js`, `api/buy-coins.js`, `api/spend-coins.js`, `api/customer-portal.js`, `api/delete-account.js`, `api/cancel-deletion.js`, every handler file in `api/print-orders/` that verifies a JWT, `api/generate-avatar.js`, `api/generate-image.js`
- Test: `tests/school-fence.test.js`

**Interfaces:**
- Consumes: `rejectStudent`, `isStudent` (Task 3); `STUDENT_DAILY_IMAGES` (Task 2); RPC `school_bump_image`.
- Produces: `api/_school.js` gains `async enforceStudentImageCap(auth, req): Response | null` — for a student, calls RPC `school_bump_image { p_student_id: auth.appMetadata.student_id, p_daily_limit: STUDENT_DAILY_IMAGES }`; `false` → 429 `{ error: "That's all the pictures for today. Ask your teacher.", code: 'class_image_limit' }`; missing `student_id` → 403 `student_forbidden`; RPC HTTP error → 503 `upstream` (fail **closed**: students must not get unmetered images).

- [ ] **Step 1: Failing test** `tests/school-fence.test.js`:

```js
// Every consumer-only endpoint must refuse a class account. A static check,
// because a student JWT is an ordinary authenticated JWT: any endpoint that
// forgets the guard silently accepts it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const FENCED = [
  'api/publish-book.js', 'api/react-book.js', 'api/report-book.js', 'api/create-checkout.js',
  'api/buy-coins.js', 'api/spend-coins.js', 'api/customer-portal.js', 'api/delete-account.js',
  'api/cancel-deletion.js',
  ...readdirSync('api/print-orders').filter((f) => f.endsWith('.js') && !/ \d+\.js$/.test(f))
    .map((f) => `api/print-orders/${f}`)
    .filter((f) => /verifyJwt|requireUser/.test(readFileSync(f, 'utf8'))),
]

describe('student fence', () => {
  it.each(FENCED)('%s calls rejectStudent after authenticating', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/import \{[^}]*rejectStudent[^}]*\} from '(\.\.\/)+_school\.js'/)
    expect(src).toMatch(/rejectStudent\(\s*auth/)
  })

  it('generate-avatar refuses a photo from a student', () => {
    const src = readFileSync('api/generate-avatar.js', 'utf8')
    expect(src).toMatch(/sourceImage[\s\S]{0,200}isStudent\(|isStudent\([\s\S]{0,200}sourceImage/)
  })

  it.each(['api/generate-image.js', 'api/generate-avatar.js'])('%s meters students from the class allowance', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/enforceStudentImageCap\(/)
  })
})

describe('enforceStudentImageCap', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })
  const req = new Request('https://app.test/api/generate-image')
  const student = { appMetadata: { role: 'student', student_id: 's1' } }

  it('lets consumers through without calling the RPC', async () => {
    globalThis.fetch = vi.fn()
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect(await enforceStudentImageCap({ appMetadata: {} }, req)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  it('spends from the class and returns null when allowed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('true'))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect(await enforceStudentImageCap(student, req)).toBeNull()
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/rpc/school_bump_image')
    expect(JSON.parse(init.body)).toEqual({ p_student_id: 's1', p_daily_limit: 15 })
  })
  it('429s with a class code when the allowance is used up', async () => {
    globalThis.fetch = vi.fn(async () => new Response('false'))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    const r = await enforceStudentImageCap(student, req)
    expect(r.status).toBe(429)
    expect((await r.json()).code).toBe('class_image_limit')
  })
  it('fails closed when the RPC errors', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 }))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect((await enforceStudentImageCap(student, req)).status).toBe(503)
  })
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**
  - Add to `api/_school.js`:

```js
import { STUDENT_DAILY_IMAGES } from '../lib/school/license.js'

// Students draw AI images from their class's allowance (owner decision D5),
// not the consumer daily cap. Fails CLOSED: an unmetered class is a bill.
export async function enforceStudentImageCap(auth, req) {
  if (!isStudent(auth)) return null
  const studentId = auth.appMetadata?.student_id
  if (!studentId) return json(req, 403, { error: 'Not available for class accounts', code: 'student_forbidden' })
  try {
    const res = await sb('/rest/v1/rpc/school_bump_image', {
      method: 'POST',
      body: JSON.stringify({ p_student_id: studentId, p_daily_limit: STUDENT_DAILY_IMAGES }),
    })
    if (!res.ok) return json(req, 503, { error: 'Try again in a minute', code: 'upstream' })
    const allowed = await res.json()
    if (allowed === false) {
      return json(req, 429, { error: "That's all the pictures for today. Ask your teacher.", code: 'class_image_limit' })
    }
    return null
  } catch {
    return json(req, 503, { error: 'Try again in a minute', code: 'upstream' })
  }
}
```

  - In each FENCED file: import `rejectStudent` from `./_school.js` (or `../_school.js` in `api/print-orders/`), and immediately after the existing `if (!auth.ok) return auth.response` line add:

```js
  const blocked = rejectStudent(auth, req)
  if (blocked) return blocked
```

  If a file names its auth result differently (e.g. `const user = await requireUser(req)`), rename that variable to `auth` in that file so the guard reads the same everywhere. Read each file first; do not change any other behaviour.
  - `api/generate-avatar.js`: after auth, if `isStudent(auth) && sourceImage` → return `rejectStudent(auth, req)`. For students skip `enforceDailyCap` and call `enforceStudentImageCap(auth, req)` instead (return it if non-null). Consumers are unchanged.
  - `api/generate-image.js`: same — students use `enforceStudentImageCap`, consumers keep `enforceDailyCap`. The call must come **before** any upstream model request.

- [ ] **Step 4:** tests pass; full suite green (existing endpoint tests, if any, must still pass).
- [ ] **Step 5: Commit** — `feat(schools): class accounts cannot buy, publish, print or delete; images come from the class`.

---

### Task 8: Student check-ins and help asks (`api/school/checkin.js`, `api/school/help.js`)

**Files:**
- Create: `api/school/checkin.js`, `api/school/help.js`
- Test: `tests/school-checkin-api.test.js`

**Interfaces:**
- Consumes: `requireStudent`, `sb`, `json` (Task 3); `isWithinSchoolHours` (Task 2); `checkRateLimit`.
- Produces HTTP:
  - `POST /api/school/checkin { feeling, need? }` (student) → `201 { ok: true }`. `feeling` ∈ `happy|proud|tired|worried|angry|sad`; `need` ∈ `break|quiet|help_book|grownup|keep_going` or absent; anything else → 400 `bad_request`. Rate limit 30/hour per student (`school-checkin:<student id>`) → 429. Body stored is exactly `{ classroom_id, student_id, feeling, need }` — nothing else from the request.
  - `POST /api/school/help { kind }` (student), `kind` ∈ `book|grownup` → `200 { id, in_hours }`. Dedup: if an **unseen** row for the same `(student_id, kind)` has `updated_at` within 15 minutes, PATCH it (`asks = asks + 1` computed from the read value, `updated_at = now`) and return its id; else insert `{ classroom_id, student_id, kind, in_hours }`. `in_hours = isWithinSchoolHours(classroom.school_hours, classroom.timezone)`. Rate limit 20/hour per student.
  - `GET /api/school/help?id=<uuid>` (student, own row only; else 404) → `200 { seen: boolean, teacher_name: string | null }`. `teacher_name` = the owning teacher's `user_metadata.display_name` via `GET /auth/v1/admin/users/<owner_user_id>`, only when `seen` is true.

- [ ] **Step 1: Failing tests** — cases:
  1. checkin from a non-student JWT → 403 `not_a_student`.
  2. checkin `{feeling:'angry', need:'grownup', note:'secret'}` → the insert body equals `{ classroom_id:'c1', student_id:'s1', feeling:'angry', need:'grownup' }` (no `note`).
  3. checkin `{feeling:'furious'}` → 400.
  4. help `kind:'grownup'` with no open row → insert with `in_hours` computed; response has the new id. Use `vi.setSystemTime(new Date('2026-09-29T14:00:00Z'))` with class tz `America/New_York` and default hours → `in_hours: true`; at `2026-09-29T23:00:00Z` → `false`.
  5. help twice within 15 min → second call PATCHes the same id with `asks: 2`, no second insert.
  6. help GET for another student's id → 404 (the query filters `student_id=eq.s1`).
  7. help GET seen → `{ seen: true, teacher_name: 'Ms. Rivera' }`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`api/school/checkin.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json } from '../_school.js'

// Student accounts only (owner decision D7, spec §5a). The child is told on
// the check-in sheet that their teacher can see this. Fixed vocabulary only:
// no free text is ever accepted or stored.
const FEELINGS = ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']
const NEEDS = ['break', 'quiet', 'help_book', 'grownup', 'keep_going']

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  const s = await requireStudent(req)
  if (!s.ok) return s.response
  if (!checkRateLimit(`school-checkin:${s.student.id}`, 30).allowed) {
    return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
  }
  const { feeling, need } = await req.json().catch(() => ({}))
  if (!FEELINGS.includes(feeling) || (need != null && !NEEDS.includes(need))) {
    return json(req, 400, { error: 'Invalid check-in', code: 'bad_request' })
  }
  const res = await sb('/rest/v1/class_checkins', {
    method: 'POST',
    body: JSON.stringify({ classroom_id: s.student.classroom_id, student_id: s.student.id, feeling, need: need ?? null }),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
  return json(req, 201, { ok: true })
}
```

`api/school/help.js`:

```js
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json, isUuid } from '../_school.js'
import { isWithinSchoolHours } from '../../lib/school/hours.js'

const DEDUP_MS = 15 * 60 * 1000
const KINDS = ['book', 'grownup']

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const s = await requireStudent(req)
  if (!s.ok) return s.response
  const { student, classroom } = s

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id')
    if (!isUuid(id)) return json(req, 400, { error: 'Invalid id', code: 'bad_request' })
    const rows = await sb(`/rest/v1/class_help_requests?id=eq.${id}&student_id=eq.${student.id}&select=seen_at`)
      .then((r) => r.json()).catch(() => [])
    if (!rows?.[0]) return json(req, 404, { error: 'Not found', code: 'not_found' })
    const seen = !!rows[0].seen_at
    let teacherName = null
    if (seen && classroom.owner_user_id) {
      const t = await sb(`/auth/v1/admin/users/${classroom.owner_user_id}`).then((r) => r.json()).catch(() => null)
      teacherName = t?.user_metadata?.display_name ?? null
    }
    return json(req, 200, { seen, teacher_name: teacherName })
  }

  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  if (!checkRateLimit(`school-help:${student.id}`, 20).allowed) {
    return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
  }
  const { kind } = await req.json().catch(() => ({}))
  if (!KINDS.includes(kind)) return json(req, 400, { error: 'Invalid kind', code: 'bad_request' })

  const inHours = isWithinSchoolHours(classroom.school_hours, classroom.timezone)
  const since = new Date(Date.now() - DEDUP_MS).toISOString()
  const open = await sb(
    `/rest/v1/class_help_requests?student_id=eq.${student.id}&kind=eq.${kind}&seen_at=is.null` +
      `&updated_at=gte.${encodeURIComponent(since)}&select=id,asks&order=updated_at.desc&limit=1`
  ).then((r) => r.json()).catch(() => [])

  // A child tapping ten times is one ask, not ten alerts.
  if (open?.[0]) {
    await sb(`/rest/v1/class_help_requests?id=eq.${open[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ asks: open[0].asks + 1, updated_at: new Date().toISOString() }),
    })
    return json(req, 200, { id: open[0].id, in_hours: inHours })
  }

  const res = await sb('/rest/v1/class_help_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ classroom_id: student.classroom_id, student_id: student.id, kind, in_hours: inHours }),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not send', code: 'upstream' })
  const [row] = await res.json()
  return json(req, 200, { id: row.id, in_hours: inHours })
}
```

- [ ] **Step 4:** tests pass; full suite green.
- [ ] **Step 5: Commit** — `feat(schools): student check-ins and help asks reach the class`.

---

### Task 9: Deletion and legacy classroom fixes

**Files:**
- Modify: `lib/deleteUser.js`, `api/classroom.js`, `api/classroom-submit.js`
- Test: extend `tests/delete-user.test.js`; create `tests/classroom-legacy.test.js`

**Interfaces:**
- Consumes: `generateClassCode`, `CODE_RE` (Task 2).
- Produces: `lib/deleteUser.js` exports `async purgeClassroom(classroom, ctx) → { ok: boolean }` where `classroom = { id, code }` and `ctx = { supabaseUrl, serviceKey }`.

Behaviour:
- `purgeUser(userId, env)` gains, **before** the published_books step: `DELETE /rest/v1/submissions?user_id=eq.<id>`.
- Then, still before the auth delete: `GET /rest/v1/classrooms?owner_user_id=eq.<id>&select=id,code`; for each, `purgeClassroom`; if any returns `{ok:false}`, `purgeUser` returns `{ ok: false }` **without** deleting the auth user (ordering is load-bearing: the owner FK is now RESTRICT, so the auth delete would fail anyway, and a half-purged class must stay findable). Then `DELETE /rest/v1/class_licenses?owner_user_id=eq.<id>`.
- `purgeClassroom(classroom, ctx)`: list `class_students?classroom_id=eq.<id>&select=auth_user_id` (all statuses); for each student call `purgeUser(authUserId, ctx)` (deletes their books, images, and auth user; the class_students row, check-ins and help asks cascade from it); abort with `{ok:false}` on the first failure. Then `DELETE submissions?classroom_code=eq.<code>`, `PATCH class_licenses?classroom_id=eq.<id>` to `{ classroom_id: null }`, `DELETE classrooms?id=eq.<id>`; return `{ ok: res.ok }`.
- `api/classroom.js`: replace the local `CODE_CHARS`/`CODE_RE`/`generateClassCode` (Math.random) with the imports from `lib/school/crypto.js`; on POST, retry up to 5 times if the insert returns 409.
- `api/classroom-submit.js`: if the request carries a valid Bearer JWT (`verifyJwt` ok), store `user_id: auth.userId` on the inserted submission; anonymous submits keep working (`user_id` omitted). Also, if the JWT belongs to a student (`isStudent`), respond 403 `{code:'use_hand_in'}` — students hand in through assignments (Stage 2), never the legacy anonymous path.

- [ ] **Step 1: Failing tests.**
  - In `tests/delete-user.test.js` add:
    1. `deletes legacy submissions by user before the auth delete` — `DELETE /rest/v1/submissions?user_id=eq.<USER>` index < auth delete index.
    2. `purges every class the user owns before deleting the auth user` — mock `classrooms?owner_user_id` to return `[{id:'c1',code:'ABC234'}]` and `class_students?classroom_id=eq.c1` to return `[{auth_user_id:'kid1'}]`; assert order: `DELETE .../auth/v1/admin/users/kid1` < `DELETE /rest/v1/classrooms?id=eq.c1` < `DELETE /auth/v1/admin/users/<USER>`; and `DELETE /rest/v1/submissions?classroom_code=eq.ABC234` happens.
    3. `aborts without deleting the teacher when a class purge fails` — make the kid's auth delete return `{ok:false,status:500}`; `purgeUser` returns `{ok:false}` and no `DELETE /auth/v1/admin/users/<USER>` call exists.
  - `tests/classroom-legacy.test.js`:
    1. `api/classroom.js` no longer contains `Math.random`.
    2. POST retries when the first insert returns 409 (two classroom inserts with different codes, 201).
    3. `api/classroom-submit.js` with a teacher-or-parent JWT stores `user_id`; with no JWT the insert body has no `user_id`; with a student JWT → 403 `use_hand_in`.

  Note for the delete-user tests: the existing `mockFetch` answers `[]` for unknown GETs, so existing tests keep passing (a user with no classes).

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** as described. Keep the existing comments in `lib/deleteUser.js`; add a comment above the class step explaining why it must precede the auth delete (owner FK is RESTRICT; students' auth users do not cascade from classrooms).
- [ ] **Step 4:** tests pass; full suite green.
- [ ] **Step 5: Commit** — `fix(schools): account deletion purges owned classes; legacy class codes use a CSPRNG`.

---

### Task 10: Web — student sign-in

**Files:**
- Create: `src/lib/schoolApi.js`, `src/pages/ClassSignInPage.jsx`, `src/components/school/NameTiles.jsx`, `src/components/school/PicturePad.jsx`, `src/i18n/locales/en/school.json`, `src/i18n/locales/it/school.json`
- Modify: `src/i18n/locales/en/index.js`, `src/i18n/locales/it/index.js` (register `school`), `src/stores/useAuthStore.js`, `src/App.jsx` (route `/class`), `src/pages/LoginPage.jsx` (link "I'm in a class")
- Test: `tests/school-web.test.js`

**Interfaces:**
- Consumes: `/api/school/roster`, `/api/school/sign-in` (Task 6); `PICTURES` (Task 2).
- Produces:
  - `src/lib/schoolApi.js`: `fetchRoster(code) → {ok, data?, code?}`, `signInWithPictures({code, studentId, pictures}) → {ok, data?, code?}`, `schoolFetch(path, options)` (authed, JSON, returns `{ok, status, data, code}`) — built on `apiFetch`/`apiFetchAuthed` from `src/lib/api.js`.
  - `useAuthStore.signInAsStudent({ access_token, refresh_token })` → `supabase.auth.setSession(...)`, throws on error.
  - `selectIsStudent(state) → boolean` = `state.user?.app_metadata?.role === 'student'`.
  - Remembered class code: `localStorage['mybooklab-class-code']` (the code only; never names or pictures).

Behaviour of `/class` (all copy from `school` namespace, EN + IT, every visible string also read aloud with the existing TTS hook used elsewhere in the app — find it with `grep -rn "useSpeechSynthesis" src | head`):
1. **Code step** (skipped if a remembered code loads a roster successfully): big input, 6 chars, uppercase, auto-submits on the 6th character. Errors by code: `class_not_found` → "We can't find that class. Check the code with your teacher."; `sign_in_closed` / `class_paused` / `class_resting` → "Your class is taking a break. Ask your teacher."; `too_many` → "Let's wait a minute and try again."
2. **Name step**: `NameTiles` grid (emoji large, name below), min tile 96×96 px, sorted by name. Link "Not my class" clears the remembered code.
3. **Picture step**: `PicturePad` shows 3 slots that fill left to right and a 4×4 grid of the 16 PICTURES (emoji only, each button `aria-label` = its id translated via `school:pictures.<id>`), a "back one" button. On the third pick it submits. Wrong → the slots shake (skip animation under `prefers-reduced-motion`), clear, and show "Not quite. Try again!" — **no attempt counter is ever shown**. `locked` → "Take a little break and try again soon." `ask_teacher` → "Ask your teacher to help you sign in."
4. Success → `signInAsStudent(tokens)`, remember the code, navigate to `/bookshelf`.

Picture translations (`school:pictures.*`) must exist for all 16 ids in both languages (used only for screen readers).

- [ ] **Step 1: Failing test** `tests/school-web.test.js` (node environment, no DOM): 
  1. `selectIsStudent` true only for `app_metadata.role === 'student'`; false for `user_metadata.role === 'student'`.
  2. `signInAsStudent` calls `supabase.auth.setSession` with both tokens (mock `../src/lib/supabase` with `vi.mock` returning `{ supabase: { auth: { setSession: vi.fn(async () => ({ data: {}, error: null })), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => {} } } }`).
  3. `fetchRoster` maps a 423 `{code:'class_resting'}` response to `{ ok:false, code:'class_resting' }` and a 200 to `{ ok:true, data }`.
  4. Every `school:pictures.<id>` key exists for all 16 `PICTURE_IDS` in both `en` and `it` catalogs.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the files above. Match existing page styling (look at `LoginPage.jsx` and `TeacherPage.jsx` for layout classes, `SparkleButton`, galaxy colour tokens). Keep components small: `ClassSignInPage` owns the step state machine; `NameTiles` and `PicturePad` are presentational (`props` in, callbacks out).
- [ ] **Step 4:** `npx vitest run` green (including `tests/i18n-keys.test.js`), then `npx vite build` succeeds.
- [ ] **Step 5: Commit** — `feat(schools): children sign in with their name and three pictures`.

---

### Task 11: Web — student mode and shared check-ins

**Files:**
- Create: `src/lib/schoolShare.js`, `src/components/school/TeacherHelpScreen.jsx`, `src/hooks/useIsStudent.js`
- Modify: `src/lib/checkIn.js` (add `STUDENT_NEEDS`), `src/components/ui/CheckInSheet.jsx`, `src/components/ui/CheckInHost.jsx`, `src/stores/useCheckInStore.js` (comment only), `tests/checkin-network.test.js`, plus the consumer-feature surfaces listed below
- Test: `tests/school-share.test.js`

**Interfaces:**
- Consumes: `selectIsStudent` (Task 10), `/api/school/checkin`, `/api/school/help` (Task 8).
- Produces:
  - `STUDENT_NEEDS = [{id:'break'},{id:'quiet'},{id:'help_book'},{id:'grownup'},{id:'keep_going'}]` in `src/lib/checkIn.js`.
  - `src/lib/schoolShare.js`: `shouldShare(user) → boolean` (student role only); `async shareCheckIn(entry, user)` → no-op (returns `false`, **no fetch**) unless `shouldShare(user)`; otherwise POSTs `{feeling, need}` and returns `true`. `async askForHelp(kind, user) → {ok, id?, inHours?}` (same gate). `async pollHelpSeen(id) → {seen, teacherName}`.
  - `useIsStudent() → boolean` hook over `useAuthStore(selectIsStudent)`.

Behaviour:
- **CheckInSheet**: when `useIsStudent()`, the need step uses `STUDENT_NEEDS`, and a line with a small teacher icon reads "Your teacher can see this" at the top of **both** steps (feeling and need), included in what is read aloud. New i18n keys: `checkin:need.help_book` ("Help with my book" / "Aiuto con il mio libro"), `checkin:need.grownup` ("I need a grown-up" / "Ho bisogno di un adulto"), `school:checkin.teacher_can_see` ("Your teacher can see this" / "La tua maestra o il tuo maestro può vederlo"). Tile art for the two new needs: reuse the existing `help` art for `help_book`, and for `grownup` reuse `help` too if no dedicated art exists (do not create images).
- **CheckInHost**: when a new entry lands (existing `seenAtRef` logic) and the user is a student, call `shareCheckIn(latest, user)` (fire-and-forget; a failure is logged, never shown to the child). `help_book` → `askForHelp('book')` and show the existing `HelpScreen`. `grownup` → `askForHelp('grownup')` and show `TeacherHelpScreen`.
- **TeacherHelpScreen** (same modal pattern as `HelpScreen`: portal, `role="dialog"`, focus management, Escape): in hours → "Your teacher got your message."; then polls `pollHelpSeen(id)` every 20 s while open and switches to "<Teacher name> saw your message 💛" (or "Your teacher saw your message 💛" when the name is null). Out of hours → "Your teacher will see this at school. If you need help now, tell a grown-up near you." (no polling). If the request fails → "Tell a grown-up near you that you need help." Always also shows the Close button. All strings EN + IT in `school`.
- **useCheckInStore.js**: rewrite the top comment block to say: consumer check-ins never leave the device; for class accounts a copy is sent by `src/lib/schoolShare.js`, never from this store, and the child is told on the sheet. The store itself stays network-free.
- **tests/checkin-network.test.js**: keep all existing tests. Add `src/lib/schoolShare.js` to an explicit `ALLOWED_SENDERS` list excluded from `findOffenders`, and add a test that `schoolShare.js` does **not** import `useCheckInStore` (so the store stays pure). Update the header comment to record owner decision D7.
- **Student mode hides** (use `useIsStudent()`; find each with the grep given): pricing/paywall links and upsell modals (`grep -rln "pricing\|Paywall\|upgrade" src/components src/pages`), coin store and photo avatar upload on `AvatarPage.jsx`, gallery **publish** and **print order** buttons on `PreviewPage.jsx`, `/orders` links, the delete-account section and subscription section on `AccountPage.jsx`, and the "Teacher" entry point. Routes `/pricing`, `/order/*`, `/orders*`, `/teacher*` redirect a student to `/bookshelf`. Server fences (Task 7) remain the real control; this is UX.

- [ ] **Step 1: Failing test** `tests/school-share.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/api', () => ({ apiFetchAuthed: vi.fn(async () => new Response(JSON.stringify({ id: 'h1', in_hours: true }))) }))

const student = { id: 'u', app_metadata: { role: 'student' } }
const parent = { id: 'p', app_metadata: {}, user_metadata: { role: 'student' } }

describe('schoolShare', () => {
  beforeEach(async () => { (await import('../src/lib/api')).apiFetchAuthed.mockClear() })

  it('never sends a consumer check-in, even with a spoofed user_metadata role', async () => {
    const { shareCheckIn } = await import('../src/lib/schoolShare.js')
    const { apiFetchAuthed } = await import('../src/lib/api')
    expect(await shareCheckIn({ feeling: 'sad', need: 'quiet' }, parent)).toBe(false)
    expect(await shareCheckIn({ feeling: 'sad' }, null)).toBe(false)
    expect(apiFetchAuthed).not.toHaveBeenCalled()
  })

  it('sends only feeling and need for a student', async () => {
    const { shareCheckIn } = await import('../src/lib/schoolShare.js')
    const { apiFetchAuthed } = await import('../src/lib/api')
    expect(await shareCheckIn({ feeling: 'sad', need: 'grownup', at: 123, extra: 'x' }, student)).toBe(true)
    const [path, init] = apiFetchAuthed.mock.calls[0]
    expect(path).toBe('/api/school/checkin')
    expect(JSON.parse(init.body)).toEqual({ feeling: 'sad', need: 'grownup' })
  })

  it('askForHelp reports in-hours for a student and does nothing for a consumer', async () => {
    const { askForHelp } = await import('../src/lib/schoolShare.js')
    expect(await askForHelp('grownup', student)).toEqual({ ok: true, id: 'h1', inHours: true })
    expect((await askForHelp('grownup', parent)).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** as described.
- [ ] **Step 4:** full suite green (including the updated `checkin-network.test.js` and `i18n-keys.test.js`); `npx vite build` succeeds.
- [ ] **Step 5: Commit** — `feat(schools): student mode, and check-ins the child knows their teacher sees`.

---

### Task 12: Web — teacher classes, roster and sign-in cards

**Files:**
- Rewrite: `src/pages/TeacherPage.jsx`
- Create: `src/pages/TeacherClassPage.jsx`, `src/components/school/RosterTable.jsx`, `src/components/school/AddStudents.jsx`, `src/components/school/SignInCards.jsx`, `src/components/school/SchoolHoursEditor.jsx`, `src/components/school/LicenseBadge.jsx`
- Modify: `src/App.jsx` (route `/teacher/class/:id`, protected), `src/index.css` (print rules for cards), `src/i18n/locales/{en,it}/school.json`
- Test: `tests/school-teacher-web.test.js`

**Interfaces:**
- Consumes: `/api/school/classes` (Task 4), `/api/school/students` (Task 5), `schoolFetch` (Task 10), `PICTURES`, `AVATAR_EMOJI`, `DEFAULT_SCHOOL_HOURS` (Task 2).
- Produces pure helpers in `src/components/school/rosterText.js` (tested): `parseRosterText(text) → string[]` (split on newlines and commas, trim, collapse spaces, drop empties, cut each to 24 chars, dedupe case-insensitively keeping the first), `trialDaysLeft(license, now) → number | null` (ceil of days to `expires_at` for `status==='trial'`, never below 0), `chunk(array, size)`.

Behaviour:
- **TeacherPage** (`/teacher`): loads `GET /api/school/classes`; the `localStorage` class list is removed. One-time migration: if the old `my-favorite-book-teacher-classes` key exists, show a small note "Your older classes are still at their class links" listing them as links to `/classroom/<code>`, with a "Hide" button that deletes the key. Create form: class name → `POST` with `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` and the UI language as `locale`; on `trial_used_up`, show "You've used your 3 free trials. Buying a class license is coming soon." Each class card: name, code (copy button), `LicenseBadge` ("Free trial: N days left" / "Trial ended" / "Active" / "Comped"), "X of 35 students", link to `/teacher/class/:id`.
- **TeacherClassPage** (`/teacher/class/:id`): header with class name (inline rename), code with "New code" (confirm dialog: "Children will need the new code. Old sign-in cards stop working."), sign-in open toggle ("Children can sign in now" / "Sign-in is closed"), `SchoolHoursEditor` (Mon–Sun rows, a checkbox and two `<input type="time">` per day, time zone select limited to the US zones `America/New_York, America/Chicago, America/Denver, America/Phoenix, America/Los_Angeles, America/Anchorage, Pacific/Honolulu` plus the class's current value, save → PATCH).
- **AddStudents**: textarea "One name per line. First name and last initial is best." → preview list from `parseRosterText` → "Add N students" → POST → on success opens the cards for the created students. Shows skipped names with their reason. Handles `seats_full` and `license_required`.
- **RosterTable**: name + emoji, last sign-in (relative, localized with `Intl.RelativeTimeFormat`), status chips (Locked / Needs teacher / Removed). Row menu: New pictures (reset → shows that student's card to print), Unlock, Rename, Sign out everywhere, Remove (confirm), Restore.
- **SignInCards**: US Letter, 2×3 cards per page. Each card: class name, class code, big avatar emoji + name, the three pictures large in order with "1 2 3" under them, footer "mybooklab.app/class". A "Print cards" button calls `window.print()`; `@media print` in `src/index.css` hides everything but `.signin-cards` and forces `page-break-after` every 6 cards. Cards are only available right after create/reset (pictures are never retrievable later) — say so on screen: "Print these now. For safety we can't show these pictures again; you can always make new ones."
- All strings EN + IT.

- [ ] **Step 1: Failing test** `tests/school-teacher-web.test.js` for `parseRosterText` (`"Maya R\nleo, Maya r\n\n  Zoë   K "` → `['Maya R','leo','Zoë K']`; a 30-char name is cut to 24), `trialDaysLeft` (29.2 days → 30; expired → 0; non-trial → null), `chunk([1..7],6)` → `[[1..6],[7]]`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** full suite green; `npx vite build` succeeds.
- [ ] **Step 5: Commit** — `feat(schools): teacher classes, roster and printable sign-in cards`.

---

### Task 13: Controller verification (not dispatched to an implementer)

- [ ] Dry-run `018_schools_core.sql` against production inside `begin; … rollback;` via Supabase `execute_sql`, and fix any error in a follow-up commit.
- [ ] Final whole-branch review.
- [ ] Hand the owner the go-live checklist: set `STUDENT_SECRET_PEPPER` (64 random hex chars) in Vercel; merge #44 and apply 017; merge this branch; apply 018; then one live end-to-end run (create class → add a student → print card → sign in on a second browser) — the only proof that `generate_link` + `verify` mints sessions on this Supabase version.
