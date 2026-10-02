// Verifies a Supabase JWT by calling /auth/v1/user. Edge-runtime friendly —
// avoids pulling in a JWT library just for this.
//
// Usage:
//   const auth = await verifyJwt(req)
//   if (!auth.ok) return auth.response
//   const { userId, email } = auth

import { withCors } from './_rateLimit.js'

// Takes req so the 401 carries the same origin-aware CORS headers as every
// other response. Without it the browser reports an opaque CORS failure
// instead of the 401, which is the harder bug to diagnose of the two.
function unauthorized(req, message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
}

export async function verifyJwt(req) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 503,
        headers: withCors({ 'Content-Type': 'application/json' }, req),
      }),
    }
  }

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return { ok: false, response: unauthorized(req, 'Missing bearer token') }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) return { ok: false, response: unauthorized(req, 'Invalid session') }

  const user = await res.json().catch(() => null)
  if (!user?.id) return { ok: false, response: unauthorized(req, 'Could not identify user') }

  // app_metadata is writable only with the service role, which makes it the
  // one place a role can be trusted (user_metadata is user-editable).
  //
  // aal / mfaEnrolled (2-step sign-in, review §7 item 15): GoTrue has just
  // accepted this token, so its `aal` claim can be read without re-checking
  // the signature. mfaEnrolled = the account has a VERIFIED factor.
  const mfaEnrolled = Array.isArray(user.factors) && user.factors.some((f) => f?.status === 'verified')
  return {
    ok: true, userId: user.id, email: user.email, jwt,
    // Teacher verification (lib/school/teacherVerification.js) needs a
    // CONFIRMED address: an unconfirmed one proves nothing about the domain.
    emailConfirmed: !!(user.email_confirmed_at || user.confirmed_at),
    appMetadata: user.app_metadata ?? {}, userMetadata: user.user_metadata ?? {},
    aal: jwtClaim(jwt, 'aal') ?? 'aal1', mfaEnrolled,
  }
}

/// One claim from a JWT's payload (no signature check: callers only use it
/// on a token GoTrue has already validated). Null when unreadable.
export function jwtClaim(jwt, name) {
  try {
    const part = String(jwt).split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))))
    return payload?.[name] ?? null
  } catch {
    return null
  }
}
