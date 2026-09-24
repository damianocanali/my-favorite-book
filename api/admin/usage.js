// Owner-only cost dashboard data endpoint.
// GET /api/admin/usage
// Returns aggregated usage_log data for the last 30 days, broken down
// by service + by feature + by day. Owner is identified by user UUID
// matching OWNER_USER_ID env var.
export const config = { runtime: 'edge' }

// CORS is applied per-handler. vercel.json used to force
// Access-Control-Allow-Origin:* on every /api/* route, which overrode the
// ALLOWED_ORIGINS allowlist in _rateLimit.js; that block is gone, so any
// handler a browser calls has to carry its own headers. The web app is
// same-origin and would not need them, but the Capacitor webview is not —
// resolveAllowedOrigin() special-cases capacitor:// for exactly that.
import { handleCors, withCors } from '../_rateLimit.js'

const SUPABASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OWNER_USER_ID = process.env.OWNER_USER_ID

async function authUser(token) {
  // Verify the session with the anon key (the public verification path),
  // not the service-role key.
  const r = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  return await r.json()
}

// Takes req so error responses carry the same origin-aware CORS headers as
// success ones; otherwise a browser sees an opaque CORS failure instead of
// the real status.
function bad(req, status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: withCors({ 'Content-Type': 'application/json' }, req),
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
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'GET') return bad(req, 405, 'Method not allowed')
  if (!OWNER_USER_ID) return bad(req, 503, 'OWNER_USER_ID not configured')

  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!tok) return bad(req, 401, 'Missing token')
  const user = await authUser(tok)
  if (!user?.id) return bad(req, 401, 'Invalid token')
  if (user.id !== OWNER_USER_ID) return bad(req, 403, 'Forbidden')

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
    console.error('[admin/usage] error', err?.message)
    return bad(req, 500, 'Failed to load usage')
  }
}
