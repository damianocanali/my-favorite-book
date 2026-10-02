// Shared guards for the paid AI endpoints (generate-image, generate-avatar,
// story-buddy). These endpoints spend real money on the operator's
// Together/Anthropic keys, so every call MUST be authenticated, size-bounded,
// SSRF-safe, and (for free-text prompts) moderated.
import { verifyJwt } from './_auth.js'
import { withCors } from './_rateLimit.js'
import { isOwnStoredIllustration } from './_imageStore.js'

// Generous caps — large enough for legitimate kid content, small enough to
// stop a single request from ballooning cost or memory.
const MAX_PROMPT_CHARS = 4000
// base64 data: URI length. ~8MB of base64 ≈ ~6MB binary — plenty for a photo.
const MAX_SOURCE_IMAGE_CHARS = 8 * 1024 * 1024

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DAILY_IMAGE_LIMIT = Number(process.env.DAILY_IMAGE_LIMIT || 50)
const MODERATION_TIMEOUT_MS = 3000

// `code` is what the apps map to copy in the child's language
// (src/lib/aiErrors.js, iPad APIError.friendly); `message` stays for logs
// and older clients.
function aiError(status, message, req, code) {
  return new Response(JSON.stringify(code ? { error: message, code } : { error: message }), {
    status,
    headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
}

/**
 * Require a valid Supabase session. Returns { ok, userId } on success, or
 * { ok: false, response } with a 401 to return immediately.
 */
export async function requireUser(req) {
  const auth = await verifyJwt(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  return { ok: true, userId: auth.userId, email: auth.email, appMetadata: auth.appMetadata }
}

/**
 * SSRF + size guard for a client-supplied source image. It MUST be an inline
 * data:image/ URI — never an arbitrary remote URL, which the upstream model
 * would fetch on our behalf (SSRF to internal/metadata hosts). Returns an
 * error Response to return, or null when valid/absent.
 *
 * The one exception, opt-in via `storedFor: userId` (generate-image edits):
 * the public URL of an illustration that user stored in OUR bucket — see
 * isOwnStoredIllustration for how strict that match is. Saved pictures are
 * URLs now, so without this "tweak" on a saved picture always 400'd.
 */
export function validateSourceImage(sourceImage, req, { storedFor = null } = {}) {
  if (sourceImage == null) return null // optional
  if (storedFor && isOwnStoredIllustration(sourceImage, storedFor)) return null
  if (typeof sourceImage !== 'string' || !sourceImage.startsWith('data:image/')) {
    return aiError(400, 'sourceImage must be an inline data:image/ URI', req)
  }
  if (sourceImage.length > MAX_SOURCE_IMAGE_CHARS) {
    return aiError(413, 'sourceImage is too large', req)
  }
  return null
}

/** Reject empty/oversized prompts. Returns an error Response or null. */
export function validatePrompt(prompt, req) {
  if (typeof prompt !== 'string' || !prompt.trim()) return aiError(400, 'Missing prompt', req)
  if (prompt.length > MAX_PROMPT_CHARS) return aiError(413, 'Prompt is too long', req, 'prompt_too_long')
  return null
}

/**
 * Atomically bump and check the caller's per-day image-generation count.
 * Returns a 429 Response when the daily limit is exceeded, else null. Fails
 * open (allows) if the service env is missing — the auth + hourly limiter are
 * still in front — but logs so the misconfiguration is visible.
 */
export async function enforceDailyCap(userId, req, limit = DAILY_IMAGE_LIMIT) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[daily-cap] Supabase service env missing — daily cap DISABLED')
    return null
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_generation`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_user_id: userId, p_limit: limit }),
    })
    if (!res.ok) {
      console.error('[daily-cap] rpc error', res.status)
      return null
    }
    const allowed = await res.json().catch(() => true)
    if (allowed === false) {
      return aiError(429, "You've reached today's creation limit — come back tomorrow!", req, 'daily_limit')
    }
    return null
  } catch (e) {
    console.error('[daily-cap] error', e?.message)
    return null
  }
}

/// The "try again" answer when moderation can't run for a caller that must
/// fail CLOSED (students). The apps map the code to their own "try again"
/// copy (src/lib/aiErrors.js, iPad APIError.friendly).
export function moderationUnavailable(req) {
  return aiError(503, "We couldn't check that just now. Please try again in a moment.", req, 'moderation_unavailable')
}

/**
 * Moderate free-text before it reaches the image/story model, using OpenAI's
 * (free) moderation endpoint. Returns an error Response to BLOCK, or null to
 * allow.
 *
 * When moderation can't run (key unset, timeout, provider error):
 *  - default (adults): log loudly and allow — a missing env var is visible
 *    rather than silently blocking every family.
 *  - `failClosed: true` (student accounts, review §7 item 10): refuse with a
 *    503 `moderation_unavailable` so unscreened text never reaches a model
 *    on a child's school account.
 */
export async function moderatePrompt(text, req, { failClosed = false } = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    console.warn('[moderation] OPENAI_API_KEY is unset — prompt moderation is DISABLED')
    return failClosed ? moderationUnavailable(req) : null
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: String(text).slice(0, 8000) }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[moderation] OpenAI moderation request failed:', res.status)
      return failClosed ? moderationUnavailable(req) : null
    }
    const data = await res.json().catch(() => null)
    if (!Array.isArray(data?.results)) {
      console.error('[moderation] unreadable moderation response')
      return failClosed ? moderationUnavailable(req) : null
    }
    if (data.results[0]?.flagged) {
      console.warn('[moderation] prompt flagged and rejected')
      return aiError(400, "Let's keep our story kind and friendly — try different words!", req, 'unkind')
    }
    return null
  } catch (e) {
    console.error('[moderation] error:', e?.name === 'AbortError' ? 'timeout' : e?.message)
    return failClosed ? moderationUnavailable(req) : null
  } finally {
    clearTimeout(timer)
  }
}

// ── Output-image moderation (review §7 item 11) ─────────────────────────────
//
// Every generated picture is screened with OpenAI omni-moderation (image
// input, same OPENAI_API_KEY as prompt moderation) BEFORE it is stored or
// returned. A flagged picture is never stored. When the check can't run,
// students fail CLOSED and adults fail open (logged), like moderatePrompt.

export const IMAGE_MODERATION_TIMEOUT_MS = 4000

/// Screens a base64 PNG. Returns 'ok', 'flagged' or 'unavailable' (no key,
/// timeout, provider error, unreadable answer). Never throws.
export async function checkImage(b64, { timeoutMs = IMAGE_MODERATION_TIMEOUT_MS, mime = 'image/png' } = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    console.warn('[moderation] OPENAI_API_KEY is unset — image moderation is DISABLED')
    return 'unavailable'
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error('[moderation] image moderation request failed:', res.status)
      return 'unavailable'
    }
    const data = await res.json().catch(() => null)
    if (!Array.isArray(data?.results)) {
      console.error('[moderation] unreadable image moderation response')
      return 'unavailable'
    }
    if (data.results.some((r) => r?.flagged)) {
      console.warn('[moderation] generated image flagged — not stored')
      return 'flagged'
    }
    return 'ok'
  } catch (e) {
    console.error('[moderation] image error:', e?.name === 'AbortError' ? 'timeout' : e?.message)
    return 'unavailable'
  } finally {
    clearTimeout(timer)
  }
}

export const IMAGE_FLAGGED_MESSAGE = "That picture didn't turn out right. Try again with different words."

/// Screens a generated picture and returns the Response to send instead of
/// it (400 image_flagged, or 503 moderation_unavailable when failing
/// closed), or null to go ahead and store/return it.
export async function moderateImage(b64, req, { failClosed = false, timeoutMs } = {}) {
  const verdict = await checkImage(b64, { timeoutMs })
  if (verdict === 'flagged') return aiError(400, IMAGE_FLAGGED_MESSAGE, req, 'image_flagged')
  if (verdict === 'unavailable') {
    if (failClosed) return moderationUnavailable(req)
    console.warn('[moderation] image moderation unavailable — allowing (adult account)')
  }
  return null
}
