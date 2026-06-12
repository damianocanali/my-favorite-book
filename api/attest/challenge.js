export const config = { runtime: 'edge' }

// POST /api/attest/challenge — issues a one-time challenge for App
// Attest key registration. The iOS app embeds its hash in the
// attestation object, which /api/attest/register verifies and consumes.

import { checkRateLimit, handleCors, withCors } from '../_rateLimit.js'
import { verifyJwt } from '../_auth.js'

function base64url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }, req) })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'App Attest not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  // Registration happens ~once per install; anything chattier is abuse.
  const { allowed } = checkRateLimit(`attest-challenge:${auth.userId}`, 10)
  if (!allowed) return json(429, { error: 'Too many requests' })

  const challenge = base64url(crypto.getRandomValues(new Uint8Array(32)))

  const res = await fetch(`${supabaseUrl}/rest/v1/app_attest_challenges`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: auth.userId, challenge }),
  })
  if (!res.ok) return json(500, { error: 'Failed to create challenge' })

  const rows = await res.json().catch(() => [])
  const id = rows?.[0]?.id
  if (!id) return json(500, { error: 'Failed to create challenge' })

  return json(200, { challengeId: id, challenge })
}
