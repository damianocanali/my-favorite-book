export const config = { runtime: 'edge' }

// POST /api/spend-coins — atomically debit the authed user's coin balance.
// Returns 402 if the user doesn't have enough. The client sends the amount
// it wants to spend; the server is agnostic to the reason and only enforces
// that the user has the balance.

import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

const MAX_SPEND = 1000

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Coins not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  const { allowed } = checkRateLimit(`spend-coins:${auth.userId}`, 120)
  if (!allowed) return json(429, { error: 'Too many requests' })

  const { amount } = await req.json().catch(() => ({}))
  const n = Number(amount)
  if (!Number.isInteger(n) || n < 1 || n > MAX_SPEND) {
    return json(400, { error: 'Invalid amount' })
  }

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/spend_coins`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: auth.userId, p_amount: n }),
  })
  if (!rpc.ok) return json(500, { error: 'Failed to spend coins' })

  const balance = await rpc.json()
  if (balance === null) return json(402, { error: 'Not enough coins' })

  return json(200, { balance })
}
