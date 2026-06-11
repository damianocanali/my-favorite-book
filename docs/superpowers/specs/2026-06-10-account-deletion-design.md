# Recoverable Account Deletion (soft-delete with grace)

**Date:** 2026-06-10
**Status:** Approved
**Targets:** Vercel API (`/api`, `/lib`), Supabase migration, native iOS app (`ios-native/MyBookLab`), minimal web copy change.

## Goal

Replace the current immediate, irreversible account deletion with a **recoverable, scheduled** deletion: a stolen or lingering JWT (or an accidental tap) must not be able to permanently destroy an account and all its books with no way back. Also closes an App Store compliance gap — the **native app currently has no in-app account deletion at all**, which Apple Guideline 5.1.1(v) requires for apps with account creation.

## Approved decisions

- **Grace model:** "stays usable + cancel banner." Requesting deletion schedules it; the account keeps working normally during the window; a persistent banner offers to cancel. A daily cron hard-deletes after the window. (GitHub/Google style.)
- **Grace window:** 7 days.
- **Stripe cancellation:** at purge time (not at request), so a user who cancels keeps their subscription.
- **Client scope:** full UI in the **iOS** app now (the App Store submission). The **web** delete control auto-schedules via the changed endpoint; only its success copy is updated this pass (full web banner/confirm deferred).

## Components

### 1. Data — migration `011_account_deletions.sql`
```sql
CREATE TABLE IF NOT EXISTS account_deletions (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
-- Users may read ONLY their own pending-deletion row (for the banner).
CREATE POLICY "read own deletion" ON account_deletions
  FOR SELECT USING (auth.uid() = user_id);
-- No insert/update/delete policies: all writes go through the server
-- endpoints using the service-role key.
```
A row's existence = "pending deletion." `scheduled_for = requested_at + 7 days`.

### 2. Shared hard-delete helper — `lib/deleteUser.js`
Extract today's irreversible delete sequence out of `api/delete-account.js` **verbatim** into `purgeUser(userId, { supabaseUrl, serviceKey })`:
1. If the user has a Stripe subscription, cancel it at Stripe (best-effort, logged — don't block on failure).
2. Delete `user_books` and `subscriptions` for the user (as the current code does).
3. Delete the Supabase auth user via the admin API. This **cascades** the remaining per-user rows (`user_coins`, `user_badges`, `account_deletions`, `daily_generation_counts`, and nulls/removes `classrooms.owner_user_id`) via their `ON DELETE CASCADE` FKs — so no separate cleanup of those is required.
Returns `{ ok }` so callers can log/react. This keeps request-time and purge-time logic from drifting (only the cron calls it).

### 3. Endpoints (edge; `userId` always from `verifyJwt`, never the body)
- **`POST /api/delete-account`** *(repurposed)* — **request**: upsert a row into `account_deletions` (idempotent — re-request returns the existing schedule). Returns `{ scheduled: true, scheduled_for }`. No longer deletes anything inline.
- **`GET /api/delete-account`** *(new branch)* — **status**: after `verifyJwt`, reads `account_deletions` with the service-role key filtered to `user_id = eq.<verified userId>` and returns `{ pending, requested_at, scheduled_for }`. (The RLS SELECT policy is defense-in-depth in case a client ever reads the row directly; the API path uses the service key scoped to the verified id.)
- **`POST /api/cancel-deletion`** *(new)* — **cancel**: delete the caller's row (idempotent; ok if none). Returns `{ cancelled: true }`.
- **`GET /api/cron/purge-deletions`** *(new)* — **purge**: protected by `CRON_SECRET` (constant-time compare, fail-closed). Selects rows with `requested_at < now() - interval '7 days'`, calls `purgeUser` for each inside its own try/catch (one failure doesn't block the batch; a failed row is left for the next run), logs results.

### 4. Cron + config
- `vercel.json`: add
  ```json
  "crons": [{ "path": "/api/cron/purge-deletions", "schedule": "0 3 * * *" }]
  ```
  (daily 03:00 UTC; the `/api/` path is already excluded from the SPA rewrite).
- New env **`CRON_SECRET`** — Vercel injects it as the cron request's `Authorization: Bearer <CRON_SECRET>`. The endpoint rejects anything else.

### 5. iOS (`ios-native/MyBookLab`)
- `APIClient`: `requestAccountDeletion()`, `cancelAccountDeletion()`, `deletionStatus() -> { pending, scheduledFor }`.
- `AccountView`:
  - **Delete Account** action (destructive) → a confirmation sheet that requires typing **`DELETE`** to enable the confirm button → calls request → success copy: "Scheduled for <date> — you can cancel anytime before then."
  - On appear, fetch status; when pending, show a prominent **banner**: "Your account is scheduled for deletion on <date>" + a **"Keep my account"** button that calls cancel and clears the banner.

### 6. Web (minimal)
The existing web delete control already POSTs `/api/delete-account`, so it now schedules with grace automatically. Only change: update its success message so it says "scheduled" rather than "deleted." (Full web banner/confirm UI deferred.)

## Data flow

Request → `account_deletions` row (account still works) → banner shown from status → either **Cancel** (row deleted, fully restored) or **7 days elapse** → cron `purgeUser` (Stripe cancel + data + auth user removed). All identity from the verified JWT; cron gated by `CRON_SECRET`.

## Error handling

- Request/cancel are **idempotent**.
- Purge: per-user try/catch; failures logged and retried next run; partial failure never blocks other users.
- Cron auth **fails closed** when `CRON_SECRET` is unset.
- Status read failure → treat as "not pending" (don't block the account screen).

## Security

- No IDOR: `userId` derived from `verifyJwt`; `account_deletions` RLS allows a user to read only their own row.
- The destructive `purgeUser` runs only from the cron (secret-gated) — never directly from a user request.
- Typed `DELETE` confirmation is the client-side guard against accidental taps; the server still requires a valid session.

## Verification

- API: `node --check` on all changed/new files; manual flow against a preview deploy (request → status shows pending → cancel → status clears); manually invoke the cron with the `CRON_SECRET` header and confirm an aged row is purged.
- iOS: build to the simulator; via the debug harness, render `AccountView` in the **pending** state (banner + Cancel) and exercise the type-`DELETE` confirm sheet. Confirm iPhone + iPad.

## Out of scope (YAGNI)

- Web banner/confirm UI (deferred; web still gets the grace via the endpoint).
- Email notifications about the scheduled deletion.
- Admin tooling to view/cancel pending deletions.
- "Re-login clears deletion" (we use the explicit Cancel button instead).
