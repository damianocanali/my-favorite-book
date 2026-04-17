export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'

// Kept in sync with the allowlist inside the increment_reaction RPC so we
// can reject obvious bad input without a round-trip to the DB.
const ALLOWED_STICKERS = ['❤️', '⭐', '😍', '🎉', '👏', '🦄', '🌈', '🔥', '💎', '🫶']

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  // The RPC is SECURITY DEFINER and granted to anon, so the anon key is enough.
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Not configured' })

  const ip = getClientIp(req)
  const { slug, sticker } = await req.json().catch(() => ({}))

  if (!slug || !sticker) return json(400, { error: 'slug and sticker required' })
  if (!ALLOWED_STICKERS.includes(sticker)) return json(400, { error: 'Invalid sticker' })

  const { allowed } = checkRateLimit(`react:${ip}`, 30)
  if (!allowed) return json(429, { error: 'Slow down! Try again later.' })

  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_reaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ p_slug: slug, p_sticker: sticker }),
  })

  if (!rpcRes.ok) {
    const err = await rpcRes.json().catch(() => ({}))
    return json(rpcRes.status === 404 ? 404 : 500, {
      error: err?.message || 'Failed to save reaction',
    })
  }

  const reaction_counts = await rpcRes.json()
  // The RPC returns NULL when the slug didn't match any row.
  if (reaction_counts === null) return json(404, { error: 'Book not found' })

  return json(200, { reaction_counts })
}
