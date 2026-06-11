// Shared guards for the paid AI endpoints (generate-image, generate-avatar,
// story-buddy). These endpoints spend real money on the operator's
// Together/Anthropic keys, so every call MUST be authenticated, size-bounded,
// SSRF-safe, and (for free-text prompts) moderated.
import { verifyJwt } from './_auth.js'
import { withCors } from './_rateLimit.js'

// Generous caps — large enough for legitimate kid content, small enough to
// stop a single request from ballooning cost or memory.
const MAX_PROMPT_CHARS = 4000
// base64 data: URI length. ~8MB of base64 ≈ ~6MB binary — plenty for a photo.
const MAX_SOURCE_IMAGE_CHARS = 8 * 1024 * 1024

function aiError(status, message, req) {
  return new Response(JSON.stringify({ error: message }), {
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
  return { ok: true, userId: auth.userId, email: auth.email }
}

/**
 * SSRF + size guard for a client-supplied source image. It MUST be an inline
 * data:image/ URI — never a remote URL, which the upstream model would fetch
 * on our behalf (SSRF to internal/metadata hosts). Returns an error Response
 * to return, or null when valid/absent.
 */
export function validateSourceImage(sourceImage, req) {
  if (sourceImage == null) return null // optional
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
  if (prompt.length > MAX_PROMPT_CHARS) return aiError(413, 'Prompt is too long', req)
  return null
}

/**
 * Moderate free-text before it reaches the image/story model, using OpenAI's
 * (free) moderation endpoint. Returns an error Response to BLOCK, or null to
 * allow. If OPENAI_API_KEY is unset we log loudly and allow (so a missing env
 * var is visible rather than silently disabling protection); on a transient
 * provider error we fail-open and log, to avoid blocking legitimate kids.
 */
export async function moderatePrompt(text, req) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    console.warn('[moderation] OPENAI_API_KEY is unset — prompt moderation is DISABLED')
    return null
  }
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: String(text).slice(0, 8000) }),
    })
    if (!res.ok) {
      console.error('[moderation] OpenAI moderation request failed:', res.status)
      return null
    }
    const data = await res.json().catch(() => null)
    if (data?.results?.[0]?.flagged) {
      console.warn('[moderation] prompt flagged and rejected')
      return aiError(400, "Let's keep our story kind and friendly — try different words!", req)
    }
    return null
  } catch (e) {
    console.error('[moderation] error:', e?.message)
    return null
  }
}
