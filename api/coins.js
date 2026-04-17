export const config = { runtime: 'edge' }

// GET /api/coins — return the authed user's coin balance from the server.
// The DB row may not exist yet for new users, in which case the balance is 0.

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Coins not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_coins?user_id=eq.${encodeURIComponent(auth.userId)}&select=balance`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )
  if (!res.ok) return json(500, { error: 'Failed to load balance' })
  const rows = await res.json()
  const balance = rows?.[0]?.balance ?? 0
  return json(200, { balance })
}
