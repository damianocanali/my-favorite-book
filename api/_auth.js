// Verifies a Supabase JWT by calling /auth/v1/user. Edge-runtime friendly —
// avoids pulling in a JWT library just for this.
//
// Usage:
//   const auth = await verifyJwt(req)
//   if (!auth.ok) return auth.response
//   const { userId, email } = auth

import { withCors } from './_rateLimit.js'

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: withCors({ 'Content-Type': 'application/json' }),
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
        headers: withCors({ 'Content-Type': 'application/json' }),
      }),
    }
  }

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return { ok: false, response: unauthorized('Missing bearer token') }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) return { ok: false, response: unauthorized('Invalid session') }

  const user = await res.json().catch(() => null)
  if (!user?.id) return { ok: false, response: unauthorized('Could not identify user') }

  return { ok: true, userId: user.id, email: user.email, jwt }
}
