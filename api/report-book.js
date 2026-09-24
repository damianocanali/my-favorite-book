export const config = { runtime: 'edge' }

// Report a published book, or block its author.
//
// App Store Guideline 1.2 requires an app showing user-generated content
// to offer a way to report objectionable material and to block abusive
// users. The gallery in both clients links here.
//
// Reporting is deliberately cheap: any signed-in user can flag a book,
// one report each, and two distinct reports hide it immediately (see
// report_published_book in supabase-migrations/016_book_reports.sql).
// We would rather over-hide a children's gallery and restore by hand.

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

const REASONS = new Set([
  'inappropriate',
  'scary',
  'mean',
  'personal-info',
  'copyright',
  'other',
])

function supabaseHeaders(serviceKey) {
  return {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }
}

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
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const userId = auth.userId

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`report:${userId}:${ip}`, 20)
  if (!allowed) return json(429, { error: 'Too many requests. Try again later.' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid request body' })
  }

  const headers = supabaseHeaders(supabaseKey)

  // ── Block an author ───────────────────────────────────────────────
  if (body.action === 'block' || body.action === 'unblock') {
    const blockedUserId = body.userId
    if (!blockedUserId) return json(400, { error: 'userId required' })
    if (blockedUserId === userId) return json(400, { error: "You can't block yourself" })

    if (body.action === 'unblock') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/blocked_authors?user_id=eq.${userId}&blocked_user_id=eq.${blockedUserId}`,
        { method: 'DELETE', headers }
      )
      if (!res.ok) return json(500, { error: 'Could not unblock' })
      return json(200, { success: true, blocked: false })
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/blocked_authors`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, blocked_user_id: blockedUserId }),
    })
    if (!res.ok) return json(500, { error: 'Could not block' })
    return json(200, { success: true, blocked: true })
  }

  // ── Report a book ─────────────────────────────────────────────────
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug) return json(400, { error: 'slug required' })

  const reason = REASONS.has(body.reason) ? body.reason : 'other'
  const details = typeof body.details === 'string' ? body.details.slice(0, 500) : null

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/report_published_book`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_slug: slug,
      p_reporter: userId,
      p_reason: reason,
      p_details: details,
    }),
  })

  if (!res.ok) {
    // Don't echo the upstream body — it can carry schema details.
    console.error('[report-book] rpc failed', res.status, (await res.text()).slice(0, 200))
    return json(500, { error: 'Could not file that report. Please try again.' })
  }

  const rows = await res.json().catch(() => null)
  const row = Array.isArray(rows) ? rows[0] : rows

  return json(200, {
    success: true,
    hidden: row?.now_hidden ?? false,
  })
}
