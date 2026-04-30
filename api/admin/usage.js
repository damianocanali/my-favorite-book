// Owner-only cost dashboard data endpoint.
// GET /api/admin/usage
// Returns aggregated usage_log data for the last 30 days, broken down
// by service + by feature + by day. Owner is identified by user UUID
// matching OWNER_USER_ID env var.
export const config = { runtime: 'edge' }

const SUPABASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OWNER_USER_ID = process.env.OWNER_USER_ID

async function authUser(token) {
  const r = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  return await r.json()
}

function bad(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

// Postgres expression for "Pacific midnight bucket" approximation:
// just truncate to UTC date — fine for v1, refine later if needed.
async function aggregate(rangeStart) {
  // Pull raw rows for the window. Volume should be small (a handful per day);
  // aggregation in JS is simpler than a Postgres pivot for now.
  const url = `${SUPABASE}/rest/v1/usage_log?created_at=gte.${encodeURIComponent(rangeStart.toISOString())}&select=service,feature,model,cost_cents,created_at&order=created_at.desc`
  const r = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!r.ok) throw new Error(`usage_log fetch ${r.status}`)
  return await r.json()
}

function bucket(rows) {
  const totals = { all: 0, anthropic: 0, together: 0 }
  const byFeature = {}
  const byDay = {}    // { '2026-04-29': { anthropic: cents, together: cents } }

  for (const row of rows) {
    const c = row.cost_cents ?? 0
    totals.all += c
    totals[row.service] = (totals[row.service] ?? 0) + c

    byFeature[row.feature] = (byFeature[row.feature] ?? 0) + c

    const day = row.created_at.slice(0, 10)
    if (!byDay[day]) byDay[day] = { anthropic: 0, together: 0 }
    byDay[day][row.service] = (byDay[day][row.service] ?? 0) + c
  }

  return { totals, byFeature, byDay }
}

function rangeFromHeader(req) {
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(90, Number.parseInt(url.searchParams.get('days') ?? '30', 10) || 30))
  const start = new Date(Date.now() - days * 86400_000)
  return { days, start }
}

export default async function handler(req) {
  if (req.method !== 'GET') return bad(405, 'Method not allowed')
  if (!OWNER_USER_ID) return bad(503, 'OWNER_USER_ID not configured')

  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!tok) return bad(401, 'Missing token')
  const user = await authUser(tok)
  if (!user?.id) return bad(401, 'Invalid token')
  if (user.id !== OWNER_USER_ID) return bad(403, 'Forbidden')

  const { days, start } = rangeFromHeader(req)

  try {
    const rows = await aggregate(start)
    const aggregated = bucket(rows)
    return new Response(JSON.stringify({
      window_days: days,
      window_start: start.toISOString(),
      total_rows: rows.length,
      ...aggregated,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return bad(500, String(err?.message ?? err))
  }
}
