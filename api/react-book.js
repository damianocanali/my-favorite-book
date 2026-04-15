export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'

const ALLOWED_STICKERS = ['❤️', '⭐', '😍', '🎉', '👏', '🦄', '🌈', '🔥', '💎', '🫶']

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  }
  const json = (s, o) => new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  const ip = getClientIp(req)
  const { slug, sticker } = await req.json()

  if (!slug || !sticker) return json(400, { error: 'slug and sticker required' })
  if (!ALLOWED_STICKERS.includes(sticker)) return json(400, { error: 'Invalid sticker' })

  // Rate limit: 30 reactions per hour per IP
  const { allowed } = checkRateLimit(`react:${ip}`, 30)
  if (!allowed) return json(429, { error: 'Slow down! Try again later.' })

  // Fetch current reaction counts
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/published_books?slug=eq.${slug}&select=reaction_counts`,
    { headers }
  )
  const rows = await fetchRes.json()
  if (!rows?.length) return json(404, { error: 'Book not found' })

  const counts = rows[0].reaction_counts || {}
  counts[sticker] = (counts[sticker] || 0) + 1

  // Update counts
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/published_books?slug=eq.${slug}`,
    {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ reaction_counts: counts }),
    }
  )

  if (!updateRes.ok) return json(500, { error: 'Failed to save reaction' })

  const [updated] = await updateRes.json()
  return json(200, { reaction_counts: updated.reaction_counts })
}
