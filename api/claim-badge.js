export const config = { runtime: 'edge' }

// POST /api/claim-badge — records that the user earned a badge and credits
// the badge's coin reward, exactly once. The coin value for each badge is
// defined server-side so a client can't declare "I earned a 10-coin badge
// worth 10,000 coins."

import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Keep this in sync with src/stores/useRewardsStore.js BADGE_DEFINITIONS.
const BADGE_COINS = {
  first_page: 10,
  first_book: 25,
  three_books: 30,
  five_books: 50,
  ten_books: 100,
  used_voice: 10,
  used_buddy: 10,
  added_illustration: 15,
  submitted_class: 20,
  five_pages: 20,
}

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

  const { allowed } = checkRateLimit(`claim-badge:${auth.userId}`, 30)
  if (!allowed) return json(429, { error: 'Too many requests' })

  const { badgeId } = await req.json().catch(() => ({}))
  const coins = BADGE_COINS[badgeId]
  if (coins === undefined) return json(400, { error: 'Unknown badge' })

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_badge`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: auth.userId, p_badge_id: badgeId, p_coins: coins }),
  })
  if (!rpc.ok) return json(500, { error: 'Failed to claim badge' })

  const balance = await rpc.json()
  if (balance === null) {
    return json(200, { alreadyClaimed: true })
  }

  return json(200, { alreadyClaimed: false, coinsEarned: coins, balance })
}
