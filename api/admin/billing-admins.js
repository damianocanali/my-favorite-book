// Owner-only: who is a school billing admin (owner feedback round 5,
// lib/school/billingAdmin.js). Only billing admins (and the owner) see
// plans, prices and purchases in the teacher area; every other teacher sees
// a neutral status line.
//
//   GET  ?ids=<uuid>,<uuid>…  (at most 50) → { flags: { <uuid>: true|false } }
//   POST { userId, billing_admin: true|false, reason } → { ok, user_id, billing_admin }
//        writes app_metadata.billing_admin with the service role.
//
// Every call is written to admin_access_log (migration 032); a change's row
// is written BEFORE anything changes and is REQUIRED: no log, no change.
export const config = { runtime: 'edge' }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, isUuid } from '../_school.js'
import { ownerAuth, logAdminAccess, reasonFrom } from '../_adminLog.js'

const MAX_IDS = 50

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

async function readFlag(userId) {
  const r = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`user read failed: ${r.status}`)
  const user = await r.json().catch(() => null)
  return user?.id ? user.app_metadata?.billing_admin === true : null
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response

  try {
    if (req.method === 'GET') {
      const raw = new URL(req.url).searchParams.get('ids') ?? ''
      const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
      if (!ids.length || ids.length > MAX_IDS || !ids.every(isUuid)) {
        return reply(req, 400, { error: `ids must be 1–${MAX_IDS} user ids`, code: 'bad_request' })
      }
      const flags = {}
      for (const id of ids) {
        const f = await readFlag(id)
        if (f !== null) flags[id] = f
      }
      await logAdminAccess({ actor: owner.ownerId, action: 'billing_admin.list', targetTable: 'auth.users', detail: { count: ids.length } })
      return reply(req, 200, { flags })
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (!isUuid(body.userId)) return reply(req, 400, { error: 'Invalid user id', code: 'bad_request' })
      if (typeof body.billing_admin !== 'boolean') return reply(req, 400, { error: 'billing_admin must be true or false', code: 'bad_request' })
      const reason = reasonFrom(req, body)

      const current = await readFlag(body.userId)
      if (current === null) return reply(req, 404, { error: 'No such user', code: 'not_found' })

      const logged = await logAdminAccess({
        actor: owner.ownerId,
        action: body.billing_admin ? 'billing_admin.grant' : 'billing_admin.revoke',
        targetTable: 'auth.users',
        targetId: body.userId,
        reason,
        detail: { from: current, to: body.billing_admin },
      }, { required: true })
      if (!logged) return reply(req, 503, { error: 'Could not write the access log; nothing changed', code: 'log_failed' })

      // GoTrue merges app_metadata keys on an admin update, so only this
      // key is sent (never a stale copy of the whole object).
      const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(body.userId)}`, {
        method: 'PUT',
        body: JSON.stringify({ app_metadata: { billing_admin: body.billing_admin } }),
      })
      if (!res.ok) return reply(req, 502, { error: 'Could not update the user', code: 'upstream' })
      return reply(req, 200, { ok: true, user_id: body.userId, billing_admin: body.billing_admin })
    }

    return reply(req, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[admin/billing-admins] error', e?.message)
    return reply(req, 503, { error: 'Service unavailable, try again' })
  }
}
