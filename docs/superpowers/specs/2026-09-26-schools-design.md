# Schools: class licenses, student sign-in, assignments, feedback — Design

Date: 2026-09-26 · Status: draft for owner review · Scope: web (`src/`, `api/`, `lib/`), Supabase, iOS (`ios-native/MyBookLab`)

Goal: turn the thin classroom feature into something a school pays for. Fixed decisions: per-class yearly
license bought by a teacher on the web (Stripe, card or invoice); v1 ships student logins without email,
assignments, and review & feedback; teacher dashboard is web-first; students use web and iOS.

---

## 1. What exists today

| Piece | File | What it does | Gap |
|---|---|---|---|
| Teacher dashboard | `src/pages/TeacherPage.jsx` | Create a class (name → 6-char code). The class list lives **only in `localStorage`** (`my-favorite-book-teacher-classes`) | A new browser or device loses every class. No server-side "my classes" list |
| Class view | `src/pages/ClassroomPage.jsx` | `/classroom/:code`, a grid of submitted books, read-only preview | **Unauthenticated**: anyone with the code (i.e. every student) reads every classmate's book. No roster, no status, no feedback |
| Class API | `api/classroom.js` | `POST` creates a class (JWT required, `owner_user_id` set). `GET ?code=` is public and returns the class plus all submissions | Uses the **anon key** for insert and select. The code comes from `Math.random` (not a CSPRNG). No retry on a code collision. No delete/rename |
| Submit API | `api/classroom-submit.js` | Anonymous `POST {code, book}`, strips `coverImage`/`illustrationData`, caps size at 200 KB, inserts into `submissions` | **No user id is stored**, so `purgeUser` cannot find a child's rows. Anonymous, IP-rate-limited only |
| Submit UI | `src/components/classroom/SubmitToClassModal.jsx` (from `PreviewPage.jsx`) | Child types a code and submits | Uses `apiFetch` (no auth). Not on iOS at all |
| Owner column | `supabase-migrations/010_classroom_owner.sql` | `classrooms.owner_user_id → auth.users ON DELETE CASCADE`, nullable | Cascading a classroom delete would orphan anything keyed only by `classroom_code` |
| Plans | `src/lib/plans.js`, `api/create-checkout.js` | `teacher` plan ($13.99/mo, $109.99/yr, 14-day trial) sets `classroom: true` and 200 images/day | This is a per-teacher consumer subscription. Nothing is per class or per seat |
| Stripe webhook | `api/stripe-webhook.js` | `checkout.session.completed` / `subscription.*` upsert `subscriptions` **`on_conflict=user_id`** (one row per user). Unknown plans default to `'family'` | A second product would fall through and **overwrite the teacher's personal plan row**. It needs its own branch and table |
| Account deletion | `lib/deleteUser.js` `purgeUser` | Deletes `user_books`, `subscriptions`, `published_books` (before auth delete, which matters because of SET NULL), illustrations, then the auth user | Doesn't touch `submissions` (can't, no user id) or classrooms/students |
| Auth (server) | `api/_auth.js` `verifyJwt` | Calls `/auth/v1/user`, returns `{userId, email, jwt}` | Doesn't expose `app_metadata`, so there is no way to tell a student from a teacher |
| Auth (web) | `src/stores/useAuthStore.js` | Email/password + OAuth. `selectRole` reads **`user_metadata.role`** | `user_metadata` is **user-writable** (`supabase.auth.updateUser({data})`). The role is fine for UI but must never gate anything |
| Auth (iOS) | `ios-native/MyBookLab/Stores/AuthStore.swift` | Email, Apple, Google. Face ID stored-session login via `supabase.auth.setSession(...)` | No classroom features on iOS. `SubscriptionStore` maps a RevenueCat `classroom` entitlement to a plan key the web calls `teacher` |
| Rate limit | `api/_rateLimit.js` | Upstash if configured, otherwise an in-memory limiter per instance | **Upstash is unset in prod**, so the limits are per-instance and bypassable. Too weak for guarding picture passwords |

**Schema note.** `classrooms` and `submissions` were created in the dashboard, not by migrations. The code
implies `classrooms(code text unique, name text, owner_user_id uuid null, …)` and
`submissions(id, classroom_code text, book jsonb, submitted_at timestamptz)`. Because `api/classroom*.js` reads and
writes both tables **with the anon key**, RLS must be off or have permissive anon policies. If so, anyone holding the
public anon key can `GET /rest/v1/submissions?select=*` and read **every class's books**, bypassing the code and
the rate limit. **Verify with Supabase `list_tables`/advisors before Stage 0.** Stage 0 captures the real DDL
as migration `017_classroom_baseline.sql`.

## 2. Non-goals for v1

- School/district admin accounts, multi-teacher classes, co-teachers (one owner teacher per class).
- SSO (Google Classroom, Microsoft, ClassLink/Clever) and roster import (CSV paste is enough).
- Grades or rubrics. Feedback is a comment and/or sticker only.
- Teacher dashboard on iOS. Teachers on iOS keep today's app, and **no license purchase UI appears on iOS**.
- Student-to-student visibility (no class gallery, no peer comments).
- Parent accounts or a parent portal.
- Per-seat pricing above 30. One license = one class ≤ 30 students (see open questions).
- Migrating legacy code-only classes into licensed classes automatically.

## 3. Data model

New migration files `017`–`021` (numbered after `016_book_reports.sql`). **Every write goes through
`api/` with the service role**, the same pattern as `user_books`/`published_books`. RLS is the safety net and is
read-only for clients.

### 3.1 Tables

**`class_licenses`**: one row per purchased class seat-block. Kept separate from `subscriptions` because that table is one row per user.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK default `gen_random_uuid()` | |
| owner_user_id | uuid → `auth.users` **ON DELETE RESTRICT** | The purchasing teacher. `purgeUser` must clean up licenses explicitly |
| classroom_id | uuid → `classrooms.id` null, unique | Null until the teacher attaches it to a class |
| seats | int not null default 30, check 1–30 | |
| status | text check in (`pending_payment`,`active`,`grace`,`lapsed`,`canceled`,`comped`) | `comped` = pilot schools granted by hand |
| billing_method | text check in (`card`,`invoice`,`manual`) | |
| starts_at / expires_at | timestamptz | `expires_at` drives the lifecycle (§6) |
| stripe_customer_id, stripe_subscription_id, stripe_price_id | text null | |
| school_name, billing_country, tax_id | text null | Needed for invoices and VAT |
| dpa_version, dpa_accepted_at, dpa_accepted_by | text / timestamptz / uuid | Checkout requires the DPA click-through (§5) |
| created_at, updated_at | timestamptz | |

**`classrooms`** (existing, altered)

| Change | Why |
|---|---|
| add `id uuid` PK/unique default `gen_random_uuid()` if absent | New tables reference a stable id, not the code (codes can be rotated) |
| keep `code` unique; generate with `crypto.getRandomValues`, retry on 23505 | CSPRNG plus collision handling |
| add `license_id uuid → class_licenses.id` null | Null = legacy code-only class (today's behaviour, no student accounts) |
| add `locale text check in ('en','it')`, `sign_in_open bool default true`, `archived_at timestamptz` | Class language; teacher can pause sign-in; soft archive |
| change `owner_user_id` FK to **ON DELETE RESTRICT** | A cascade would delete classrooms but leave student auth users alive. Teacher purge must run in order (§5.4) |

**`class_students`**: the roster. Every row is backed by a server-created auth user.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| classroom_id | uuid → `classrooms.id` ON DELETE RESTRICT | Deleting a class goes through the purge function, never a cascade |
| auth_user_id | uuid unique → `auth.users` ON DELETE CASCADE | Synthetic account (§4) |
| display_name | text, 1–24 chars | Teacher-entered. Guidance is first name + initial. Unique per class, case-insensitive |
| avatar_emoji | text | Shown on name tiles so non-readers can find themselves |
| secret_hash | text | HMAC of the picture password (§4.3) |
| secret_version | smallint | Pepper/scheme version |
| failed_attempts | smallint default 0 | Reset on success |
| locked_until | timestamptz null | Soft lock |
| hard_locked | bool default false | Only the teacher can clear it |
| status | text check in (`active`,`removed`) | |
| removed_at, last_sign_in_at, created_at | timestamptz | |

**`student_sign_in_attempts`**: a durable throttle, because the in-memory limiter can't be trusted (Upstash is unset).
Columns: `id bigint identity`, `classroom_id`, `student_id null`, `ip_hash text` (HMAC of IP, not the raw IP), `ok bool`,
`created_at`. Index `(classroom_id, created_at)`, `(ip_hash, created_at)`. The daily cron purges rows older than 30 days.

**`assignments`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| classroom_id | uuid → classrooms ON DELETE CASCADE | |
| title | text ≤ 80 | |
| prompt | text ≤ 1000 | The writing prompt shown to kids (TTS-friendly) |
| due_at | timestamptz null | |
| status | text check in (`draft`,`published`,`closed`) | Students see `published` and `closed` |
| allow_late | bool default true | |
| created_at, updated_at | timestamptz | |

**`class_submissions`**: replaces `submissions` for licensed classes and fixes the missing user id.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| classroom_id | uuid → classrooms | |
| assignment_id | uuid → assignments ON DELETE CASCADE, null | Null = free submission |
| student_id | uuid → class_students ON DELETE CASCADE | |
| **user_id** | uuid → **auth.users ON DELETE CASCADE** | Account deletion now removes the rows. `purgeUser` also deletes them explicitly |
| book_id | text | `user_books.book_id` it was made from |
| book_snapshot | jsonb (≤ 200 KB, same stripping as `classroom-submit.js`) | Frozen at submit. Illustration **URLs** from `book-illustrations` are kept, data URIs dropped |
| version | int default 1 | Resubmission bumps it (unique `(assignment_id, student_id)` upsert) |
| submitted_at | timestamptz | `late` is derived from `due_at` |

**`submission_feedback`**: `id uuid`, `submission_id → class_submissions ON DELETE CASCADE`, `author_user_id` (teacher),
`comment text ≤ 500 null`, `sticker text null check in (<fixed list, e.g. 'star','rocket','heart','wow','keep_going'>)`,
`created_at`, `seen_at null`. Check that at least one of comment/sticker is set. Stickers are a fixed set, so they localize and
need no moderation.

**Legacy `submissions`**: add `user_id uuid → auth.users ON DELETE CASCADE null`. `classroom-submit.js` fills it
from an **optional** JWT. Existing rows cannot be backfilled (the link never existed). Retention for them is an open question.

### 3.2 RLS (safety net; the service role bypasses it)

Helpers (`SECURITY DEFINER`, `STABLE`, `search_path=public`):
`is_class_owner(cid uuid)` → `exists(select 1 from classrooms where id=cid and owner_user_id=auth.uid())`;
`my_student_id()` → `select id from class_students where auth_user_id=auth.uid() and status='active'`.

| Table | SELECT policy | Writes |
|---|---|---|
| class_licenses | `owner_user_id = auth.uid()` | none (service role) |
| classrooms | `is_class_owner(id)` or `id = (select classroom_id from class_students where auth_user_id=auth.uid())` | none. **Drop any anon policies** |
| class_students | owner: `is_class_owner(classroom_id)`. Student: `auth_user_id = auth.uid()`. **`secret_hash` is excluded** through a view `class_students_public` or column grants | none |
| student_sign_in_attempts | none | none |
| assignments | owner: all. Student: `classroom_id` = own class and `status <> 'draft'` | none |
| class_submissions | owner: `is_class_owner(classroom_id)`. Student: `student_id = my_student_id()` | none |
| submission_feedback | owner via submission's class. Student via own submission | none |
| submissions (legacy) | **no anon policy**. Owner via `classroom_code` → owned class | none |

## 4. Student accounts without email

### 4.1 Account creation (teacher adds roster)
`POST /api/school/students` (teacher JWT, owner of a licensed class, seats not exceeded), for each name:
1. `POST /auth/v1/admin/users` (service role) with
   `email: "s-<uuidv4>@students.mybooklab.invalid"` (`.invalid` is reserved by RFC 2606 and can never route mail),
   `password: <64 random bytes, discarded>`, `email_confirm: true`,
   `app_metadata: {role: 'student', classroom_id, student_id}`, `user_metadata: {display_name}`.
   The email contains **no name**. The random password is never stored or shown.
2. Insert `class_students` with a **server-generated** picture password (§4.3). It is returned once to the teacher for the printable card.
3. On any failure, delete the auth user (compensating action).

`app_metadata` is writable only by the service role, so it is the **only** trusted source of `role`.
`verifyJwt` gains `appMetadata` in its return value, and a new `requireTeacherOf(classroomId)` / `requireStudent()` pair lives in `api/_school.js`.

### 4.2 Sign-in (mints a session with no email)
`POST /api/school/sign-in {classCode, studentId, pictures:[p1,p2,p3]}` (no auth, strict throttle §4.4):
1. Check the class exists, `sign_in_open`, license in `active|grace|comped`, student `active`, not locked.
2. Constant-time compare `HMAC(pepper, …)` with `secret_hash`. On failure, record the attempt and bump counters.
3. On success: `POST /auth/v1/admin/generate_link {type:'magiclink', email:<synthetic>}` → take `hashed_token`,
   then `POST /auth/v1/verify {type:'magiclink', token_hash}` → `{access_token, refresh_token}`. **No email is sent**
   (admin `generate_link` only returns the link). Return the tokens to the client.
4. Web: new `useAuthStore.signInAsStudent()` → `supabase.auth.setSession(tokens)`. iOS: new `AuthStore.signInAsStudent()`
   → `supabase.auth.setSession(accessToken:refreshToken:)` (the same call the Face ID path already uses).
   **Stage 1 starts with a spike** that confirms this flow on the current Supabase version. The fallback is to rotate the
   random password server-side on each sign-in and call `/auth/v1/token?grant_type=password`.

### 4.3 Picture password storage
- Alphabet: 16 language-free pictures (animals/objects, no letters: works for dyslexic and pre-literate kids, EN and IT).
  The secret is an ordered sequence of 3 with repeats allowed, giving 16³ = **4,096** combinations (~12 bits). That is a PIN, not a password.
- **Server-generated, not kid-chosen.** Kids pick "cat cat cat" or their favourite animal, which collapses the space.
- Stored as `HMAC-SHA256(STUDENT_SECRET_PEPPER, "v1|" + student_id + "|" + p1,p2,p3)`, hex, via WebCrypto (Edge-safe).
  Honest note: with only 4,096 values, **salted hashing alone is useless offline**. The protection against a DB-only leak is
  the **pepper held in Vercel env, not in Postgres**. If the pepper also leaks, every secret is recoverable instantly, so the
  response is "reset all" (a bulk-regenerate endpoint and `secret_version` exist for that).
- The teacher never sees stored secrets. Reset = regenerate + reprint. There is no "show password".

### 4.4 Brute-force controls (all in Postgres; the in-memory limiter is not trusted)
| Control | Rule |
|---|---|
| Per student | 5 failures → `locked_until = now()+15 min`. 10 consecutive failures → `hard_locked` until the teacher unlocks it |
| Per class | > 20 failures across the class in 10 min → class sign-in paused 10 min + dashboard alert |
| Per IP (hashed) | > 30 failures/hour across all classes → 429 for that IP |
| Roster fetch | `GET /api/school/roster?code=` limited per IP. Returns only `{id, display_name, avatar_emoji}` |
| Class code | 6 chars over 32 symbols (~1 B). Teacher can **rotate** it. `sign_in_open` lets teachers close sign-in outside lessons |

Worst case under these rules: an attacker who holds the class code gets ~20 guesses per 10-minute window per class,
which is 20/4096 ≈ 0.5% of one child's secret per window. Lockouts and alerts make sustained attempts visible. A successful
guess exposes one child's school stories and feedback, with no contact data (none is stored). **Security review item:** the
roster reveals first names to anyone with the code. That is why names are first name + initial and the code is rotatable.

### 4.5 Guarding every existing endpoint against student sessions
A student JWT is a normal `authenticated` JWT. Every existing endpoint would accept it, so add `rejectStudent()` to:
`publish-book.js`, `react-book.js`, `report-book.js` (student reports go to the teacher instead), `create-checkout.js`,
`buy-coins.js`, `customer-portal.js`, `print-orders/*`, `delete-account.js` (erasure goes through the school), and
`generate-avatar.js` **photo mode** (`sourceImage` sends a child's photo to a model; students get feature-based avatars only).
AI endpoints (`story-buddy.js`, `generate-image.js`) stay open to students, with caps taken from the class license (open question on numbers).
Web students on school Chromebooks are unattested, so `DAILY_IMAGE_LIMIT_UNATTESTED` applies to them (see ATTEST_MODE caps note).
iOS: hide `PaywallView`, `CoinStoreView`, print orders, `GalleryView` publish, and the Face ID "save login" (shared devices) when `role == student`.

### 4.6 Leaving, expiry, reset
| Event | Effect |
|---|---|
| Teacher resets password | New secret, `failed_attempts=0`, lock cleared. Existing sessions stay valid (same child) |
| Teacher "sign out everywhere" | Service-role RPC deletes the user's `auth.sessions` rows (verify in the spike; fallback: short `ban_duration`) |
| Student removed | `status='removed'`, auth user **banned** (`ban_duration`), seat freed. After 30 days (restorable window) → purge: `class_submissions`, feedback, `user_books`, illustrations (`purgeStoredImages`), auth user |
| License enters `lapsed` | Sign-in refused ("Your class is taking a break. Ask your teacher."). Existing sessions: API returns 403 on school routes, UI shows the same screen. After 90 days lapsed → full class purge (warning emails to the teacher at 30 and 7 days) |
| Teacher deletes the class | Immediate purge in order: students → submissions/feedback → assignments → classroom |

## 5. Children's privacy & compliance (flags, not legal conclusions)

- **Roles.** The school (or the teacher acting for it) is **controller**; My Book Lab is **processor** for student data (GDPR Art. 28).
  That requires a **DPA**: subject matter, instructions-only processing, confidentiality, security, sub-processor list with notice of
  changes, assistance with DSARs and DPIAs, deletion/return at end, audits. Sub-processors today: Supabase, Vercel, Anthropic
  (Story Buddy), Together (images), OpenAI (moderation), Apple (iOS attest). Stripe processes **teacher** billing data only.
  **Lawyer:** DPA text, international transfers (US AI providers: SCCs/DPF), whether a teacher can bind the school.
- **GDPR Art. 8** (parental consent, age 14 in Italy under D.Lgs. 196/2003 art. 2-quinquies) covers *consent-based* services offered
  directly to a child. In the school model the lawful basis is the school's (likely public task or contract), not child consent.
  **Lawyer:** confirm the basis per country and whether schools will expect a DPIA (likely: children plus AI). We should ship a DPIA support pack.
- **COPPA (US).** FTC guidance lets a school authorize collection **in place of parents** only when the data is used solely for the
  educational purpose, with no other commercial use. The operator must give the school full notice and let it review and delete data.
  Consequence for design: **no upsell, coin store, ads, or marketing to student accounts**, and no use of student content for anything else.
  **Lawyer:** current FTC position after the 2025 Rule amendments, and state student-privacy laws (e.g. SOPIPA-style).
- **Minimization.** No email, no age, no photo, no surname (first name + initial, teacher-chosen). IP stored only as an HMAC in the
  attempts table (30 days). Check-in feelings (`useCheckInStore`) remain device-only and are cleared on sign-out, which already happens.
  **Open question:** disable check-in for students entirely.
- **Public gallery must be off for student accounts.** Publishing a book to the gallery (`published_books`, publicly readable RLS
  `USING (true)`, shows `author_name`/`author_age`) would disclose a pupil's name and work to the world. The school, as controller,
  has not instructed that, and under COPPA it would be a use outside the educational purpose. Enforce it server-side in
  `publish-book.js` via `app_metadata.role`, not only in the UI.
- **Illustrations bucket is public-read** (`014_illustration_storage.sql`, unguessable paths). Acceptable for v1 only if the DPA
  says so. Otherwise move student images to a private bucket with signed URLs (open question).
- **Retention & deletion**: §4.6, plus:
  - `purgeUser` gains, **before** the auth delete: `DELETE class_submissions?user_id=eq.<id>`, `DELETE submissions?user_id=eq.<id>`.
  - Teacher purge: licenses → for each owned class run the class purge (students first, since their auth users don't cascade from `classrooms`)
    → legacy `submissions?classroom_code=in.(…)` → `classrooms`. Abort on any failure, keeping the account-deletion defect's "ordering is load-bearing" rule.
  - Legacy anonymous `submissions` rows have no owner. Proposed rule: deleted with their classroom, and all legacy rows purged at a fixed date (owner decision).
- **Apple.** The iOS app shows no purchase path, price, or link for class licenses (see §6).

## 6. Licensing & payment

**App Store Guideline 3.1.3(c) Enterprise Services:** "If your app sells services directly to an organization or group for its
employees or students (for example professional databases and classroom management tools), the app may allow enterprise users to
access previously-purchased content or subscriptions. Consumer, single user, or family sales must use in-app purchase."
**Condition we must hold to:** the license is sold to a school or class (a group, for its students), never to a single child or
family. The iOS app only lets those users *access* it: no buy button, price, or external purchase link on iOS, and family/consumer
plans stay on RevenueCat IAP. A teacher paying personally for "their class" is a grey area. Invoice to the school is the clean case.

| Item | Shape |
|---|---|
| Stripe Product | "My Book Lab Class License" |
| Prices | Yearly recurring, per class (`quantity` = number of classes), **EUR and USD** (today `plans.js` is USD-only; Italian schools pay EUR). Stripe Tax for VAT; collect `tax_id` |
| Card | `POST /api/school/checkout` → Checkout `mode: 'subscription'`, `metadata[type]=class_license`, `subscription_data[metadata][type]=class_license`, `…[owner_user_id]`. Auto-renew **on**; the teacher can cancel in the Customer Portal |
| Invoice | `POST /api/school/invoice-request` → create Customer + Subscription with `collection_method=send_invoice`, `days_until_due=30`. Licenses start `pending_payment` and are **usable immediately** for 30 days, then `lapsed` if unpaid |
| Webhook | In `api/stripe-webhook.js`, branch on `metadata.type === 'class_license'` **first** in `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid`, `invoice.payment_failed`, so it never reaches `upsertSubscription` (which would clobber the teacher's `subscriptions` row). Create/extend `quantity` license rows. Idempotency through `processed_webhook_events` (migration 008) |
| Pilot | `comped` licenses set by the owner via SQL/admin endpoint, so Stages 1–3 are sellable before Stripe self-serve |

**What a license unlocks:** a class with up to 30 student accounts, assignments, review grid, feedback, student AI caps pooled per
class, and student iOS access. The owning teacher also gets `teacher`-plan features while any license is active (no double-billing).
Legacy code-only classes keep working for existing `teacher` subscribers.

**Lifecycle:** `active` → at `expires_at` → `grace` (14 days, everything works, teacher banner and emails) → `lapsed` (students
blocked, teacher can read and **export** books as PDF/JSON, no new assignments) → after 90 days → purge. Renewal at any point before
purge restores everything. **Students never see prices or "your school didn't pay"**, only the neutral "class is taking a break" screen.

## 7. UX

**Teacher (web, `/teacher`, rebuilt on the server-side list, with `localStorage` removed):**
1. *Classes*: cards per class (name, code, seats used/30, license status and expiry, "Buy license" / "Attach license").
2. *Buy*: choose number of classes, card or invoice, school name, country, tax id, **accept DPA** → Stripe Checkout or invoice confirmation.
3. *Roster*: paste names (one per line) → preview → create. Emoji picker per student. **Print sign-in cards** (A4, 6 per page: name, emoji,
   class code, 3 pictures). Row actions: reset pictures, unlock, sign out everywhere, remove. Toggle "sign-in open". Rotate code.
4. *Assignments*: create (title, prompt, due date, allow late), publish, close.
5. *Review grid* (`/teacher/class/:id`): rows = students, columns = assignments. Cells: not started / draft / submitted / late / reviewed.
   Clicking a cell opens the book (existing `BookPreview`) with a feedback panel: comment + sticker row → Send.
6. Alerts: locked students, class sign-in paused, license expiring.

**Student (web and iOS, same flow; EN/IT; big targets, pictures, TTS where available):**
1. "I'm in a class" on the sign-in screen → enter class code (remembered on the device after first use).
2. Name tiles (emoji + name) → tap self → 3-picture pad (16 tiles, shows 3 slots filling) → in. Wrong → gentle shake, no counter shown. Locked → "Ask your teacher".
3. Home shows **My assignments** (prompt read aloud, due date, status) above the normal bookshelf. "Start writing" creates a book tagged with `assignment_id`.
4. Preview page: **Hand in** replaces the code-typing `SubmitToClassModal` for students. Resubmit allowed until closed.
5. Feedback: sticker animation on the book card + teacher comment (read aloud). Marked `seen_at`.
6. Hidden for students: gallery publish, coins store, paywall, print, account deletion, photo avatars, Face ID save.
   iOS: new `ClassSignInView`, `AssignmentsView`, feedback on `BookDetailView`, gated in `MainTabView`.

## 8. API endpoints

New endpoints live under `api/school/` (service role, `requireTeacherOf` / `requireStudent` from new `api/_school.js`).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/school/classes` | teacher | Owned classes + license status (replaces `localStorage`) |
| POST / PATCH / DELETE | `/api/school/classes` | teacher (owner) | Create, rename, rotate code, toggle `sign_in_open`, attach license, delete (purge) |
| POST | `/api/school/checkout` | teacher (not student) | Stripe Checkout for N class licenses |
| POST | `/api/school/invoice-request` | teacher | Invoice-billed subscription |
| POST | `/api/school/students` | teacher (owner, licensed) | Bulk create roster. Returns picture secrets once |
| PATCH | `/api/school/students/:id` | teacher (owner) | Rename, emoji, `reset_secret`, `unlock`, `sign_out_all`, `remove`/`restore` |
| GET | `/api/school/roster?code=` | none, throttled | Name tiles for sign-in |
| POST | `/api/school/sign-in` | none, throttled | Picture check → session tokens |
| GET / POST / PATCH | `/api/school/assignments` | teacher (owner) for writes. Student read | CRUD, publish, close |
| POST | `/api/school/submit` | student | Upsert `class_submissions` for `(assignment, student)` |
| GET | `/api/school/grid?classId=` | teacher (owner) | Students × assignments status matrix |
| GET | `/api/school/submissions/:id` | teacher (owner) or owning student | Book snapshot + feedback |
| POST | `/api/school/feedback` | teacher (owner) | Comment/sticker |
| POST | `/api/school/feedback/:id/seen` | student | Mark seen |
| GET | `/api/school/export?classId=` | teacher | Zip/JSON export (lapse and year end) |
| changed | `api/stripe-webhook.js` | Stripe sig | `class_license` branches (§6) |
| changed | `api/classroom.js` | — | Service role. `GET` requires teacher owner JWT (no more public reads). CSPRNG code with retry |
| changed | `api/classroom-submit.js` | optional JWT | Service role. Stores `user_id`. Rejects licensed classes (use `/api/school/submit`) |
| changed | `api/_auth.js` | — | Return `appMetadata` |
| changed | `lib/deleteUser.js`, `api/cron/purge-deletions.js` | cron | New deletes + class purge. Same cron also runs the license lifecycle, removed-student purge, attempts cleanup |
| changed | publish/react/report/checkout/coins/portal/print/delete-account/generate-avatar | — | `rejectStudent()` (§4.5) |

## 9. Delivery stages

| # | Stage | Independently useful because | Size |
|---|---|---|---|
| 0 | **Hardening, no new features.** Baseline migration for `classrooms`/`submissions`, lock RLS, service role in `classroom*.js`, owner-only `GET`, `submissions.user_id` + `purgeUser` fix, CSPRNG codes, server-side class list | Closes the data-exposure and deletion gaps for today's users | S |
| 1 | **Licenses (comped) + roster + picture sign-in (web).** Spike on session minting first. `class_licenses`, `class_students`, attempts, `_school.js`, `rejectStudent`, printable cards | Pilot schools (comped) get email-free student accounts | L |
| 2 | **Assignments + hand-in (web)** | Teachers set work, kids hand in against it | M |
| 3 | **Review grid + feedback (web)** | Completes the teacher loop. The first sellable product | M |
| 4 | **Stripe self-serve.** Card checkout, invoice path, webhook branches, lifecycle cron, emails, export, DPA click-through | Revenue without the owner in the loop | M |
| 5 | **iOS student.** `ClassSignInView`, assignments, hand-in, feedback, student gating, EN/IT strings | Classes with iPads | L |

Relative total ≈ S + L + M + M + M + L. Stages 2 and 5 can overlap once Stage 1's APIs are stable.

## 10. Risks & open questions

**Risks**
- Session minting via `generate_link`/`verify` depends on Supabase behaviour (the Stage 1 spike removes this risk). A student could call
  `supabase.auth.updateUser({password})` and later sign in with synthetic email + password, bypassing lockouts. The email is an
  unguessable UUID, but enable "secure password change" / block it with an auth hook if available.
- Picture passwords are ~12 bits. Safety rests on the DB throttle and the pepper (§4.3–4.4). Needs review by someone other than the author.
- Italian **public** schools usually buy via MEPA/Consip and require e-invoicing through SDI (FatturaPA, CIG, split payment). Stripe
  invoices do not satisfy that. Without a solution, the Italian public-school market may be closed.
- Existing `teacher` subscribers and the iOS RevenueCat `classroom` entitlement overlap with the new license, which could confuse customers or trigger double billing.
- Rate limiting elsewhere is still per-instance (Upstash unset). The school endpoints avoid it by using Postgres counters.
- Student AI usage on web is unattested and hits the halved caps (ATTEST_MODE note). A 30-kid class may hit caps in one lesson.

**Open questions for the owner**
1. Price per class per year, in EUR and USD? Trial for schools (e.g. 30 days comped)?
2. Class size above 30: a second license, or seat add-ons?
3. Invoice path: allow use before payment (30 days proposed)? Support SDI/MEPA for Italian public schools, or target private schools and the US first?
4. What happens to the existing `teacher` plan: keep, grandfather, or fold into "teacher with ≥1 license"? And the iOS `classroom` IAP entitlement?
5. Student AI caps per class per day (images, Story Buddy)?
6. Grace (14 days) and post-lapse retention (90 days) and removed-student window (30 days): acceptable?
7. Legacy anonymous `submissions` rows with no user id: purge on a fixed date, or keep until each classroom is deleted?
8. Disable the emotional check-in for student accounts?
9. Keep student illustrations in the public bucket, or move to private + signed URLs?
10. Who signs the DPA: can a teacher accept it for the school, or do we require a school officer? Budget for a lawyer (DPA, COPPA, transfers)?
11. Printable QR sign-in cards (faster for 6-year-olds, but a lost card = access): v1 or later?
