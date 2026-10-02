// Owner gate + access log for api/admin/* (privacy review §4.11, §7 item 16).
//
// ownerAuth: the single OWNER_USER_ID check every admin endpoint uses, so the
// caller's id is in hand for the log row.
//
// logAdminAccess: one admin_access_log row (migration 030) per admin action —
// who, what, which record, why. Rows carry ids and counts only, never a
// child's name or text. Read-only actions log best-effort (a missing table
// before migration 030 is applied must not lock the owner out of print QA;
// the failure is console.error'd). Destructive actions pass `required: true`
// and must not proceed when the row can't be written.
import { withCors } from './_rateLimit.js'

const MAX_REASON = 500

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

function env() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return { url, service, anon }
}

/// { ok: true, ownerId } for the owner's session, else { ok: false, response }.
export async function ownerAuth(req) {
  const owner = process.env.OWNER_USER_ID
  const { url, service, anon } = env()
  if (!owner || !url || !service) return { ok: false, response: reply(req, 503, { error: 'Not configured' }) }
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!tok) return { ok: false, response: reply(req, 401, { error: 'Missing token' }) }
  // Verified with the anon key (the public verification path), never the
  // service-role key.
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${tok}` } })
  if (!r.ok) return { ok: false, response: reply(req, 401, { error: 'Invalid token' }) }
  const user = await r.json().catch(() => null)
  if (!user?.id) return { ok: false, response: reply(req, 401, { error: 'Invalid token' }) }
  if (user.id !== owner) return { ok: false, response: reply(req, 403, { error: 'Forbidden' }) }
  return { ok: true, ownerId: user.id }
}

/// The owner's stated reason: `reason` in the JSON body, else ?reason=.
export function reasonFrom(req, body) {
  const raw = body?.reason ?? new URL(req.url).searchParams.get('reason')
  const s = typeof raw === 'string' ? raw.trim().slice(0, MAX_REASON) : ''
  return s || null
}

/// Writes one admin_access_log row. Returns true when it was written.
export async function logAdminAccess({ actor, action, targetTable = null, targetId = null, reason = null, detail = {} }, { required = false } = {}) {
  const { url, service } = env()
  try {
    if (!url || !service) throw new Error('service env missing')
    const res = await fetch(`${url}/rest/v1/admin_access_log`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor,
        action: String(action).slice(0, 80),
        target_table: targetTable,
        target_id: targetId == null ? null : String(targetId).slice(0, 200),
        reason: reason == null ? null : String(reason).slice(0, MAX_REASON),
        detail: detail ?? {},
      }),
    })
    if (!res.ok) throw new Error(`insert failed: ${res.status}`)
    return true
  } catch (e) {
    console.error(`[admin-log] ${required ? 'REQUIRED ' : ''}write failed for ${action}:`, e?.message)
    return false
  }
}
