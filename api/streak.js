export const config = { runtime: 'edge' }

// GET  /api/streak        — current/longest streak for the signed-in user.
// POST /api/streak {day}  — mark a local calendar day (YYYY-MM-DD) as a
// writing day. The day must be within ±1 of UTC today: enough slack for
// any timezone, not enough to fast-forward a streak. The touch_streak
// RPC re-checks the window and handles increment/reset atomically.

import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

/** Strict YYYY-MM-DD within ±1 day of UTC `now`. Exported for tests. */
export function isValidStreakDay(day, now = new Date()) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  // Round-trip to reject rollover dates like 2026-02-31.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return false
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.abs(parsed.getTime() - todayUtc) <= 86_400_000
}

function shapeStreak(row) {
  return {
    currentStreak: row?.current_streak ?? 0,
    longestStreak: row?.longest_streak ?? 0,
    lastActiveDate: row?.last_active_date ?? null,
  }
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Streaks not configured' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response

  const { allowed } = checkRateLimit(`streak:${auth.userId}`, 30)
  if (!allowed) return json(429, { error: 'Too many requests' })

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  if (req.method === 'GET') {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/user_streaks?user_id=eq.${auth.userId}&select=current_streak,longest_streak,last_active_date`,
      { headers: serviceHeaders }
    )
    if (!res.ok) return json(500, { error: 'Failed to load streak' })
    const rows = await res.json().catch(() => [])
    return json(200, shapeStreak(rows?.[0]))
  }

  const { day } = await req.json().catch(() => ({}))
  if (!isValidStreakDay(day)) return json(400, { error: 'Invalid day' })

  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/touch_streak`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ p_user_id: auth.userId, p_day: day }),
  })
  if (!rpc.ok) return json(500, { error: 'Failed to update streak' })

  const rows = await rpc.json().catch(() => [])
  return json(200, shapeStreak(rows?.[0]))
}
