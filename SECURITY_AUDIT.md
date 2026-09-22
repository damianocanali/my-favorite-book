# My Book Lab — Security Audit

**Repo:** `damianocanali/my-favorite-book`
**Date:** 2026-06-10
**Scope:** Vercel serverless API (`/api`, `/lib`), Supabase migrations, iOS native layer (`/ios-native`). Web/native client reviewed for secret exposure only.
**Method:** Static review. No dynamic testing or live credential checks were performed — items marked *"verify in prod"* depend on environment configuration that can't be confirmed from source.

---

## Summary

| # | Severity | Finding | Primary file(s) |
|---|----------|---------|-----------------|
| 1 | Critical | AI generation endpoints have no auth; only bypassable IP rate limiting | `api/generate-image.js`, `api/generate-avatar.js`, `api/story-buddy.js`, `api/_rateLimit.js` |
| 2 | Critical | No content moderation on prompts or generated images | image/avatar pipeline |
| 3 | High | Classroom submissions exposed to anyone with a short, brute-forceable code | `api/classroom.js`, `api/classroom-submit.js` |
| 4 | High | User-supplied `sourceImage` passed to Together as `image_url` (SSRF passthrough) | `api/generate-image.js`, `api/generate-avatar.js` |
| 5 | Medium | `vercel.json` forces `Access-Control-Allow-Origin: *`, overriding per-origin logic | `vercel.json` |
| 6 | Medium | Raw upstream error bodies leaked to clients | `api/coins.js`, `api/admin/usage.js` |
| 7 | Medium | `delete-account` is irreversible on JWT alone, no re-auth/confirm | `api/delete-account.js` |
| 8 | Medium | Lulu webhook guesses signature scheme and logs full PII body on miss | `api/webhooks/lulu.js` |
| 9 | Medium | Avatars/state in unencrypted `UserDefaults` (tokens correctly in Keychain) | `ios-native/.../Stores/`, `Services/BiometricCredentials.swift` |

---

## Critical

### 1. AI generation endpoints are unauthenticated — uncapped billable spend

`generate-image`, `generate-avatar`, and `story-buddy` never call `verifyJwt`. The only gate is `checkRateLimit(...:${ip}, ...)`.

`api/_rateLimit.js` documents its own fallback as unreliable:

> In-memory Map (fallback) — per-instance only. Under Vercel's serverless scaling, each cold instance has its own counters, so a determined attacker can bypass the limit by spraying requests across regions. Fine for casual abuse protection; **do NOT rely on it for anything billable.**

These endpoint URLs ship in the public JS bundle, so anyone can call your Together/Anthropic credits directly, from any number of IPs, with no account. This is uncapped spend on your payment method.

**Fix**
- Require `verifyJwt` on `generate-image`, `generate-avatar`, `story-buddy`.
- Change the rate-limit key from `${ip}` to `${userId}`.
- Confirm Upstash is configured in prod (`UPSTASH_REDIS_REST_URL` + `_TOKEN`); log a loud startup warning when `HAS_UPSTASH` is false so a missing env var can't silently leave you on the bypassable limiter. *(verify in prod)*
- Add a per-user **daily generation cap** enforced in the DB (a row/counter), not just an hourly window — defense against a single compromised account draining credits.

---

### 2. No content moderation on prompts or generated images

A child's free text goes straight into the FLUX prompt, and `generate-image` accepts an arbitrary `sourceImage`. There is no moderation on input or output anywhere in the image pipeline. The Story Buddy **text** prompts carry safety rules in the system prompt, but the **image** path has none. For an app placed in front of children, a single inappropriate generated image is an App Review removal and a reputational incident.

**Fix**
- Moderate the prompt before generation (e.g. OpenAI's free moderation endpoint, or a Together classifier). Reject + log on a hit.
- Ideally screen the output image as well before returning it.
- Add a **"report this illustration"** action in the UI — cheap to build, and a strong trust signal for the clinician/teacher audience.

---

## High

### 3. Classroom submissions exposed via a short, brute-forceable code

`CODE_RE = /^[A-Z0-9]{4,8}$/`. The `classroom` **GET** handler returns every submission's full book for a given code with **no authentication** — the code is treated as a bearer secret. A 4-char code over 36 symbols is ~1.7M combinations (not the "≈1B" the comment claims), brute-forceable given the rate limiter weakness in #1. This leaks children's names and their writing.

**Fix**
- Raise the minimum to 6–8 chars in `CODE_RE` (both `classroom.js` and `classroom-submit.js`).
- Gate `classroom` GET behind the **teacher's JWT** and verify that user owns the classroom, instead of relying on code-as-secret.
- If codeless student access is a hard requirement, at minimum lengthen the code and apply real (Upstash-backed, per-user where possible) rate limiting.

---

### 4. `sourceImage` passed to Together as `image_url` — SSRF passthrough

`generate-image` and `generate-avatar` forward user-supplied `sourceImage` directly as `image_url`. If a URL (rather than a `data:` URI) is accepted, you're asking Together to fetch an arbitrary URL on your behalf. Current clients may only send base64, but the endpoint doesn't enforce it.

**Fix**
- Validate `sourceImage.startsWith('data:image/')` and reject anything else.
- Cap the decoded payload size.

---

## Medium

### 5. `vercel.json` wildcard CORS overrides your per-origin logic

`vercel.json` sets `Access-Control-Allow-Origin: *` on all `/api/*` routes, defeating the `ALLOWED_ORIGINS` allowlist in `_rateLimit.js` (`resolveAllowedOrigin`). Combined with #1, any website can invoke the unauthenticated AI endpoints from a browser. Authenticated endpoints remain protected by the JWT, so practical risk concentrates on the no-auth endpoints — but it nullifies the abuse control you wrote.

**Fix**
- Remove the CORS header block from `vercel.json` and let per-handler `withCors(headers, req)` own it, **or** make the static header reflect real origins.

---

### 6. Raw upstream error bodies leaked to clients

- `api/coins.js` returns `detail: body.slice(0, 300)` from Supabase errors.
- `api/admin/usage.js` returns `String(err?.message ?? err)`.

These can expose schema or internal details.

**Fix**
- Return a generic message to the client; log the detail server-side.

---

### 7. `delete-account` is irreversible on JWT alone

Deletion proceeds on a valid JWT with no re-authentication or explicit confirmation. A stolen or lingering token can irreversibly destroy an account and all books.

**Fix**
- Require a recent re-auth or a typed confirmation.
- Consider a soft-delete with a short grace window before hard deletion.

---

### 8. Lulu webhook guesses signature scheme and logs full PII body on miss

`verifyAny` tries multiple header/secret/encoding combinations, and on no match logs the full header set plus a body prefix — bodies that contain shipping PII — before returning 401. The fail-closed behavior is correct; the guessing + PII logging is the smell.

**Fix**
- Once Lulu's actual signing scheme is confirmed, pin to it and remove the alternatives.
- Stop logging full bodies; log only what's needed to debug a signature mismatch.

---

### 9. iOS: tokens correctly in Keychain, but some state in unencrypted `UserDefaults`

Token storage is sound — the Supabase Swift SDK persists session tokens to the Keychain, and `BiometricCredentials.swift` gates saved credentials behind `.biometryCurrentSet`. However, avatars and some app state live in `UserDefaults` (`AuthStore.swift`, `CoinsStore.swift`), which is unencrypted. Not sensitive today.

**Fix**
- Keep it that way: never let tokens or PII drift into `UserDefaults` as features grow.

---

## Already done right (don't regress these)

- Server-side API keys; `.env` gitignored, `.env.example` only.
- `verifyJwt` derives `userId` from the token, never the request body — no IDOR in `sync-books`, `coins`, `spend-coins`.
- Server-authoritative print pricing in `lib/print/pricing.js`; client cannot set the price.
- Coins credited only from the verified Stripe/RevenueCat webhook, never a client redirect.
- Stripe webhook: signature verification with 5-min timestamp tolerance and constant-time compare.
- RevenueCat webhook secret is now fail-closed (rejects when the env var is unset).
- RLS enabled on user tables; atomic coin ops via `SECURITY DEFINER` RPCs (`spend_coins`, `add_coins`).
- Print order input validated: format allowlist, quantity bounded 1–10, required shipping fields, US-only guard, book-size cap.

---

## Suggested fix order

1. **#1 + #2** — money + store-removal risk. Do these first, together.
2. **#3 + #4** — child-data exposure and SSRF.
3. **#5** — restores the abuse control behind #1.
4. **#6 / #7 / #8** — hardening.
5. **#9** — hygiene / future-proofing.
