export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

function supabaseHeaders(serviceKey) {
  return {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  }
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  const json = (s, o) => new Response(JSON.stringify(o), {
    status: s, headers: withCors({ 'Content-Type': 'application/json' }),
  })

  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Not configured' })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const userId = auth.userId

  const headers = supabaseHeaders(supabaseKey)
  const { slug } = await req.json().catch(() => ({}))
  if (!slug) return json(400, { error: 'slug required' })

  const encodedSlug = encodeURIComponent(slug)

  // Verify ownership
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/published_books?slug=eq.${encodedSlug}&select=user_id`,
    { headers }
  )
  const rows = await checkRes.json()
  if (!rows?.length) return json(404, { error: 'Book not found' })
  if (!rows[0].user_id || rows[0].user_id !== userId) return json(403, { error: 'Not authorized' })

  const delRes = await fetch(
    `${supabaseUrl}/rest/v1/published_books?slug=eq.${encodedSlug}`,
    { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }
  )
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}))
    return json(500, { error: err.message || `Delete failed (${delRes.status})` })
  }
  return json(200, { success: true })
}
