# Recoverable Account Deletion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate, irreversible account deletion with a 7-day **scheduled** deletion the user can cancel; add the full Delete-Account UI to the iOS app (also closing the App Store 5.1.1(v) in-app-deletion gap).

**Architecture:** A new `account_deletions` table holds a row per pending deletion. `POST /api/delete-account` schedules (idempotent), `GET` reports status, `POST /api/cancel-deletion` cancels. A daily Vercel Cron (`/api/cron/purge-deletions`, gated by `CRON_SECRET`) hard-deletes rows older than 7 days via a shared `lib/deleteUser.js#purgeUser`. iOS gets a type-`DELETE` confirm + a "scheduled for deletion" banner with Cancel. The web delete button auto-schedules via the changed endpoint.

**Tech Stack:** Vercel edge functions (ESM `api/*.js`), Supabase (PostgREST + auth admin API), SwiftUI (`ios-native/MyBookLab`), React (`src/`).

**Verification model:** This repo has **no API test harness and no iOS test target**. Per-task verification is `node --check` (API), `xcodebuild` (iOS), valid-JSON checks, and the manual flows noted. The migration is applied via the Supabase MCP/dashboard.

---

## File structure

- Create: `supabase-migrations/011_account_deletions.sql` — the table + RLS.
- Create: `lib/deleteUser.js` — `purgeUser()` (the only hard-delete path).
- Modify: `api/delete-account.js` — repurpose to **schedule** (POST) + **status** (GET); no inline delete.
- Create: `api/cancel-deletion.js` — cancel a pending deletion.
- Create: `api/cron/purge-deletions.js` — daily purge, `CRON_SECRET`-gated.
- Modify: `vercel.json` — add the cron schedule.
- Modify: `ios-native/MyBookLab/Services/APIClient.swift` — 3 methods + response types.
- Modify: `ios-native/MyBookLab/Views/AccountView.swift` — Delete-Account action + confirm sheet + pending banner.
- Modify: `src/pages/AccountPage.jsx` — success copy ("scheduled", not "deleted").

---

## Task 1: Migration — `account_deletions`

**Files:** Create `supabase-migrations/011_account_deletions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Run this in Supabase Dashboard > SQL Editor (or via MCP apply_migration).
--
-- Backs the recoverable account-deletion flow: a row's existence means the
-- account is scheduled for deletion; scheduled_for = requested_at + 7 days.

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- A user may read ONLY their own pending-deletion row. All writes go through
-- the server endpoints with the service-role key (no write policies here).
DROP POLICY IF EXISTS "read own deletion" ON account_deletions;
CREATE POLICY "read own deletion" ON account_deletions
  FOR SELECT USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply it to Supabase**

Apply via the Supabase MCP `apply_migration` (project `ydpblgmirurobwdhzbqj`, name `account_deletions`) or paste into the SQL editor.
Expected: success; `account_deletions` appears in `list_tables` with `rls_enabled: true`.

- [ ] **Step 3: Commit**

```bash
git add supabase-migrations/011_account_deletions.sql
git commit -m "feat(db): account_deletions table for recoverable deletion"
```

---

## Task 2: Shared hard-delete helper — `lib/deleteUser.js`

**Files:** Create `lib/deleteUser.js`

- [ ] **Step 1: Write the helper (extracted verbatim from the current delete-account flow)**

```js
// Irreversible hard-delete of a user and all their data. Called ONLY by the
// purge cron after the grace window — never directly from a user request.
export async function purgeUser(userId, { supabaseUrl, serviceKey, stripeSecretKey }) {
  const sb = (path, init = {}) =>
    fetch(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(init.headers || {}),
      },
    })

  // 1. Cancel the Stripe subscription first (best-effort; never block deletion).
  if (stripeSecretKey) {
    try {
      const subsRes = await sb(
        `/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id`
      )
      const rows = await subsRes.json().catch(() => [])
      const stripeSubId = rows?.[0]?.stripe_subscription_id
      if (stripeSubId) {
        const cancelRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        )
        if (!cancelRes.ok) {
          console.warn('[purgeUser] Stripe cancel failed', cancelRes.status, await cancelRes.text().catch(() => ''))
        }
      }
    } catch (e) {
      console.warn('[purgeUser] Stripe cancel threw', e?.message)
    }
  }

  // 2. Delete the user's data rows.
  await sb(`/rest/v1/user_books?user_id=eq.${userId}`, { method: 'DELETE' })
  await sb(`/rest/v1/subscriptions?user_id=eq.${userId}`, { method: 'DELETE' })

  // 3. Delete the auth user — cascades user_coins, user_badges,
  //    account_deletions, daily_generation_counts via ON DELETE CASCADE FKs.
  const deleteRes = await sb(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
  if (!deleteRes.ok) {
    console.error('[purgeUser] auth delete failed', deleteRes.status, await deleteRes.text().catch(() => ''))
    return { ok: false }
  }
  return { ok: true }
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check lib/deleteUser.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add lib/deleteUser.js
git commit -m "feat(api): shared purgeUser hard-delete helper"
```

---

## Task 3: Repurpose `api/delete-account.js` (schedule + status)

**Files:** Modify `api/delete-account.js` (replace the whole file)

- [ ] **Step 1: Replace the file contents**

```js
export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Recoverable deletion: POST schedules it (idempotent), GET reports status.
// The actual hard delete happens later in the purge cron (lib/deleteUser.js).
const GRACE_DAYS = 7

function json(status, obj, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
}

function scheduledFor(requestedAt) {
  return new Date(new Date(requestedAt).getTime() + GRACE_DAYS * 86400000).toISOString()
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Not configured' }, req)

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const { userId } = auth

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // GET — current status.
  if (req.method === 'GET') {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/account_deletions?user_id=eq.${userId}&select=requested_at`,
      { headers }
    )
    const rows = await res.json().catch(() => [])
    const requested_at = rows?.[0]?.requested_at ?? null
    return json(
      200,
      requested_at
        ? { pending: true, requested_at, scheduled_for: scheduledFor(requested_at) }
        : { pending: false },
      req
    )
  }

  // POST — schedule deletion. Idempotent: a re-request keeps the original
  // requested_at (does not extend the window).
  if (req.method === 'POST') {
    const res = await fetch(`${supabaseUrl}/rest/v1/account_deletions?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!res.ok) {
      console.error('[delete-account] schedule failed', res.status, await res.text().catch(() => ''))
      return json(500, { error: 'Could not schedule deletion' }, req)
    }
    // ignore-duplicates returns [] on conflict; fetch the existing row for the date.
    let rows = await res.json().catch(() => [])
    if (!rows?.length) {
      const get = await fetch(
        `${supabaseUrl}/rest/v1/account_deletions?user_id=eq.${userId}&select=requested_at`,
        { headers }
      )
      rows = await get.json().catch(() => [])
    }
    const requested_at = rows?.[0]?.requested_at ?? new Date().toISOString()
    return json(200, { scheduled: true, scheduled_for: scheduledFor(requested_at) }, req)
  }

  return json(405, { error: 'Method not allowed' }, req)
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check api/delete-account.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/delete-account.js
git commit -m "feat(api): delete-account now schedules deletion + reports status"
```

---

## Task 4: `api/cancel-deletion.js`

**Files:** Create `api/cancel-deletion.js`

- [ ] **Step 1: Write the endpoint**

```js
export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), {
      status: s,
      headers: withCors({ 'Content-Type': 'application/json' }, req),
    })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  const res = await fetch(`${supabaseUrl}/rest/v1/account_deletions?user_id=eq.${auth.userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok && res.status !== 404) {
    console.error('[cancel-deletion] failed', res.status, await res.text().catch(() => ''))
    return json(500, { error: 'Could not cancel deletion' })
  }
  return json(200, { cancelled: true })
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check api/cancel-deletion.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/cancel-deletion.js
git commit -m "feat(api): cancel-deletion endpoint"
```

---

## Task 5: Purge cron + `vercel.json`

**Files:** Create `api/cron/purge-deletions.js`; Modify `vercel.json`

- [ ] **Step 1: Write the cron endpoint**

```js
export const config = { runtime: 'edge' }

import { purgeUser } from '../../lib/deleteUser.js'

const CRON_SECRET = process.env.CRON_SECRET
const GRACE_DAYS = 7

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export default async function handler(req) {
  // Fail closed: only Vercel Cron (Authorization: Bearer $CRON_SECRET) may run this.
  const header = req.headers.get('authorization') || ''
  if (!CRON_SECRET || !safeEqual(header, `Bearer ${CRON_SECRET}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000).toISOString()
  const res = await fetch(
    `${supabaseUrl}/rest/v1/account_deletions?requested_at=lt.${encodeURIComponent(cutoff)}&select=user_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = await res.json().catch(() => [])

  let purged = 0
  let failed = 0
  for (const row of rows || []) {
    try {
      const { ok } = await purgeUser(row.user_id, { supabaseUrl, serviceKey, stripeSecretKey })
      if (ok) purged++
      else failed++
    } catch (e) {
      failed++
      console.error('[purge-deletions] error for a user:', e?.message)
    }
  }

  return new Response(JSON.stringify({ considered: rows?.length ?? 0, purged, failed }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Add the cron schedule to `vercel.json`**

Current `vercel.json`:
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```
Replace with (adds the `crons` array):
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "crons": [
    { "path": "/api/cron/purge-deletions", "schedule": "0 3 * * *" }
  ],
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Syntax / JSON checks**

Run: `node --check api/cron/purge-deletions.js`
Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`
Expected: exit 0; `vercel.json OK`.

- [ ] **Step 4: Commit**

```bash
git add api/cron/purge-deletions.js vercel.json
git commit -m "feat(api): daily purge-deletions cron (CRON_SECRET-gated)"
```

---

## Task 6: iOS APIClient methods

**Files:** Modify `ios-native/MyBookLab/Services/APIClient.swift`

- [ ] **Step 1: Add response types + 3 methods**

Add inside the `APIClient` type (e.g. right after the `askStoryBuddy` method, before the closing brace of the class):

```swift
    // MARK: - Account deletion (recoverable)

    struct DeletionStatus: Decodable {
        let pending: Bool
        let scheduled_for: String?
    }
    private struct DeletionScheduled: Decodable { let scheduled_for: String? }
    private struct CancelResult: Decodable { let cancelled: Bool? }

    /// Schedules account deletion (7-day grace). Returns the ISO date it's
    /// scheduled for, if the server provided one.
    @discardableResult
    func requestAccountDeletion(bearerToken: String) async throws -> String? {
        let res: DeletionScheduled = try await request(
            method: "POST", path: "/api/delete-account", bearerToken: bearerToken)
        return res.scheduled_for
    }

    /// Cancels a pending account deletion.
    func cancelAccountDeletion(bearerToken: String) async throws {
        let _: CancelResult = try await request(
            method: "POST", path: "/api/cancel-deletion", bearerToken: bearerToken)
    }

    /// Returns whether the account is scheduled for deletion (and when).
    func deletionStatus(bearerToken: String) async throws -> DeletionStatus {
        try await request(method: "GET", path: "/api/delete-account", bearerToken: bearerToken)
    }
```

- [ ] **Step 2: Build**

Run:
```bash
cd ios-native && xcodebuild -project MyBookLab.xcodeproj -scheme MyBookLab \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' -configuration Debug build 2>&1 | tail -3
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Commit**

```bash
git add ios-native/MyBookLab/Services/APIClient.swift
git commit -m "feat(ios-native): APIClient account-deletion methods"
```

---

## Task 7: iOS AccountView — Delete Account action + type-DELETE confirm

**Files:** Modify `ios-native/MyBookLab/Views/AccountView.swift`

> Read the file first; it composes cards in a `ScrollView`/`VStack` and ends with `signOutCard` (around line 227). Add the new state, a `deleteAccountCard`, and a confirmation sheet. Place the card right after `signOutCard` in the body.

- [ ] **Step 1: Add state to the `AccountView` struct (near the other `@State` / `@Environment` properties)**

```swift
    @State private var showDeleteConfirm = false
    @State private var deleteConfirmText = ""
    @State private var deleteBusy = false
    @State private var deletionScheduledFor: String?   // ISO date when pending
    @State private var deleteError: String?
```

- [ ] **Step 2: Add the card + confirm sheet**

Add this card to the signed-in body, right after `signOutCard`:

```swift
                deleteAccountCard
```

Add these members to `AccountView`:

```swift
    private var deleteAccountCard: some View {
        Button(role: .destructive) {
            deleteConfirmText = ""
            deleteError = nil
            showDeleteConfirm = true
        } label: {
            Text("Delete account")
                .frame(maxWidth: .infinity)
        }
        .padding(.vertical, 6)
        .sheet(isPresented: $showDeleteConfirm) {
            deleteConfirmSheet
                .presentationDetents([.medium])
        }
    }

    private var deleteConfirmSheet: some View {
        VStack(spacing: 16) {
            Text("Delete your account?")
                .font(.system(.title3, design: .rounded).bold())
            Text("Your account and all your books will be scheduled for deletion. You'll have 7 days to change your mind before anything is permanently removed.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Text("Type DELETE to confirm")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("DELETE", text: $deleteConfirmText)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .multilineTextAlignment(.center)
                .padding(12)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            if let deleteError {
                Text(deleteError).font(.footnote).foregroundStyle(.red)
            }
            Button(role: .destructive) {
                Task { await scheduleDeletion() }
            } label: {
                HStack {
                    if deleteBusy { ProgressView() }
                    Text("Schedule deletion")
                }
                .frame(maxWidth: .infinity).padding(12)
            }
            .background(.red.opacity(deleteConfirmText == "DELETE" ? 0.8 : 0.3), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
            .disabled(deleteConfirmText != "DELETE" || deleteBusy)

            Button("Keep my account") { showDeleteConfirm = false }
                .padding(.top, 4)
            Spacer()
        }
        .padding()
    }

    private func scheduleDeletion() async {
        guard let token = auth.accessToken else { return }
        deleteBusy = true; deleteError = nil
        defer { deleteBusy = false }
        do {
            let scheduledFor = try await APIClient.shared.requestAccountDeletion(bearerToken: token)
            deletionScheduledFor = scheduledFor ?? ""
            showDeleteConfirm = false
        } catch {
            deleteError = "Couldn't schedule deletion. Please try again."
        }
    }
```

- [ ] **Step 3: Build**

Run:
```bash
cd ios-native && xcodebuild -project MyBookLab.xcodeproj -scheme MyBookLab \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' -configuration Debug build 2>&1 | tail -3
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add ios-native/MyBookLab/Views/AccountView.swift
git commit -m "feat(ios-native): Delete Account action with type-DELETE confirm"
```

---

## Task 8: iOS AccountView — pending banner + Cancel

**Files:** Modify `ios-native/MyBookLab/Views/AccountView.swift`

- [ ] **Step 1: Add a banner shown when a deletion is pending**

Add this view + helper to `AccountView`:

```swift
    @ViewBuilder
    private var deletionBanner: some View {
        if let scheduledFor = deletionScheduledFor, !scheduledFor.isEmpty {
            VStack(spacing: 8) {
                Text("Your account is scheduled for deletion\(deletionDateText(scheduledFor)).")
                    .font(.subheadline.bold())
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                Button {
                    Task { await cancelDeletion() }
                } label: {
                    Text(deleteBusy ? "Cancelling…" : "Keep my account")
                        .font(.footnote.bold())
                        .padding(.vertical, 8).padding(.horizontal, 16)
                        .background(.white.opacity(0.2), in: Capsule())
                        .foregroundStyle(.white)
                }
                .disabled(deleteBusy)
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(.red.opacity(0.7), in: RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal)
        }
    }

    private func deletionDateText(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        guard let date = f.date(from: iso) else { return "" }
        let out = DateFormatter(); out.dateStyle = .medium
        return " on " + out.string(from: date)
    }

    private func cancelDeletion() async {
        guard let token = auth.accessToken else { return }
        deleteBusy = true
        defer { deleteBusy = false }
        do {
            try await APIClient.shared.cancelAccountDeletion(bearerToken: token)
            deletionScheduledFor = nil
        } catch {
            deleteError = "Couldn't cancel. Please try again."
        }
    }

    private func loadDeletionStatus() async {
        guard let token = auth.accessToken else { return }
        if let status = try? await APIClient.shared.deletionStatus(bearerToken: token) {
            deletionScheduledFor = status.pending ? (status.scheduled_for ?? "") : nil
        }
    }
```

- [ ] **Step 2: Show the banner at the top of the signed-in content and load status on appear**

In the signed-in body, put `deletionBanner` as the first element of the content stack, and add `.task { await loadDeletionStatus() }` to the signed-in view.

- [ ] **Step 3: Build**

Run:
```bash
cd ios-native && xcodebuild -project MyBookLab.xcodeproj -scheme MyBookLab \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' -configuration Debug build 2>&1 | tail -3
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Visual check (debug harness)**

Temporarily seed `deletionScheduledFor = "2026-06-20T00:00:00Z"` (or use the env-var DebugHarness pattern) and screenshot `AccountView` on the iPad sim; confirm the red banner + "Keep my account" renders and the type-DELETE sheet enables its button only when "DELETE" is typed. Revert the seed.

- [ ] **Step 5: Commit**

```bash
git add ios-native/MyBookLab/Views/AccountView.swift
git commit -m "feat(ios-native): pending-deletion banner + cancel"
```

---

## Task 9: Web copy — schedule, not delete

**Files:** Modify `src/pages/AccountPage.jsx` (around line 76, the `apiFetchAuthed('/api/delete-account', …)` handler)

- [ ] **Step 1: Update the success handling copy**

Read the handler around line 76. The `POST /api/delete-account` now returns `{ scheduled: true, scheduled_for }` instead of `{ deleted: true }`. Update the success branch so the user-facing message says the account is **scheduled for deletion (you have 7 days to cancel)** rather than "deleted", and does not immediately sign the user out / navigate away as if gone. (Keep it minimal — full web banner/confirm is out of scope.)

- [ ] **Step 2: Verify**

Run: `grep -n "scheduled\|delete-account" src/pages/AccountPage.jsx`
Expected: the success copy references "scheduled".

- [ ] **Step 3: Commit**

```bash
git add src/pages/AccountPage.jsx
git commit -m "fix(web): account deletion now reads as scheduled, not immediate"
```

---

## Task 10: Handoff (config + deploy)

**Files:** none (documentation/actions)

- [ ] **Step 1: Add `CRON_SECRET` in Vercel**

Project → Settings → Environment Variables → `CRON_SECRET` = a long random string (Production). Vercel injects it into cron requests as `Authorization: Bearer <CRON_SECRET>`.

- [ ] **Step 2: Confirm migration 011 is applied** (Task 1, Step 2).

- [ ] **Step 3: Deploy**

```bash
git push origin main
```
Then verify in Vercel: the cron `purge-deletions` shows under the project's Crons; a manual run returns `{ considered, purged, failed }`.

- [ ] **Step 4: Manual end-to-end check**

Signed in: request deletion → `GET /api/delete-account` shows `pending: true` + a date → cancel → `pending: false`. (Optionally insert a row with `requested_at` 8 days ago and hit the cron with the secret to confirm purge.)

---

## Notes for the implementer

- **Identity always from the token.** Every endpoint derives `userId` from `verifyJwt` — never the request body.
- **`purgeUser` runs only from the cron.** The user-facing endpoints never hard-delete.
- **Idempotency:** re-requesting deletion must not reset `requested_at`; cancelling a non-existent pending row is a success.
- **Line numbers drift** — re-read the AccountView/AccountPage regions before editing; match on surrounding code.
- **No `@Environment` outside a View** and keep `auth.accessToken` access on the main actor (it already is in these view methods).
