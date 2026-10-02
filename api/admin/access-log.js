// Owner-only viewer for admin_access_log (migration 030, review §7 item 16).
// GET /api/admin/access-log?limit=50&before=<id>  → { rows, next_before }
// Reading the log is itself logged, so the record shows who reviewed it.
export const config = { runtime: 'edge' }

import { handleCors, withCors } from '../_rateLimit.js'
import { ownerAuth, logAdminAccess } from '../_adminLog.js'

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'GET') return reply(req, 405, { error: 'Method not allowed' })
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response

  const params = new URL(req.url).searchParams
  const limit = Math.max(1, Math.min(200, Number.parseInt(params.get('limit') ?? '50', 10) || 50))
  const beforeRaw = params.get('before')
  const before = beforeRaw && /^\d{1,18}$/.test(beforeRaw) ? beforeRaw : null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  try {
    const res = await fetch(
      `${url}/rest/v1/admin_access_log?select=id,actor,action,target_table,target_id,reason,detail,at` +
        `${before ? `&id=lt.${before}` : ''}&order=id.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) throw new Error(`admin_access_log read failed: ${res.status}`)
    const rows = await res.json()
    await logAdminAccess({ actor: owner.ownerId, action: 'access_log.view', targetTable: 'admin_access_log', detail: { count: rows.length, before } })
    return reply(req, 200, { rows, next_before: rows.length === limit ? rows[rows.length - 1].id : null })
  } catch (e) {
    console.error('[admin/access-log] error', e?.message)
    return reply(req, 503, { error: 'Failed to load the access log' })
  }
}
