export const config = { runtime: 'edge' }

// POST /api/spend-coins — atomically debit the authed user's coin balance.
// Returns 402 if the user doesn't have enough.
//
// Two kinds of spend. A PURCHASE (kind + id) is charged the price in
// lib/catalog.js and nothing else: the client's amount must match it, so a
// direct API call can no longer buy a 15-coin style for 1 coin. An ACTION
// spend (no kind — e.g. re-rolling an avatar) debits the amount sent; it buys
// nothing that is kept, so there is nothing to under-price.

import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'
import { priceOf } from '../lib/catalog.js'

const MAX_SPEND = 1000

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }, req) })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Coins not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  const { allowed } = checkRateLimit(`spend-coins:${auth.userId}`, 120)
  if (!allowed) return json(429, { error: 'Too many requests' })

  const { amount, kind, id } = await req.json().catch(() => ({}))
  const n = Number(amount)
  if (!Number.isInteger(n) || n < 1 || n > MAX_SPEND) {
    return json(400, { error: 'Invalid amount' })
  }

  // Optionally record WHAT was bought, in the same transaction as the
  // spend. Previously the client marked ownership locally, so anything
  // could be granted free by editing local storage.
  const purchaseKind = kind === 'style' || kind === 'item' ? kind : null
  const purchaseId =
    purchaseKind && typeof id === 'string' && id.length > 0 && id.length <= 64 ? id : null
  if (purchaseKind && !purchaseId) {
    return json(400, { error: 'Invalid item id' })
  }
  if (purchaseKind) {
    const price = priceOf(purchaseKind, purchaseId)
    if (price === null) return json(400, { error: 'Not for sale' })
    // Refuse rather than silently charge the catalog price: a mismatch means
    // the client is showing the child a different price than they'd pay.
    if (n !== price) return json(400, { error: 'Price mismatch', price })
  }

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/spend_coins_for`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user_id: auth.userId,
      p_amount: n,
      p_kind: purchaseKind,
      p_id: purchaseId,
    }),
  })
  if (!rpc.ok) return json(500, { error: 'Failed to spend coins' })

  const balance = await rpc.json()
  if (balance === null) return json(402, { error: 'Not enough coins' })

  return json(200, { balance })
}
