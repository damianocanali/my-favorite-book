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
