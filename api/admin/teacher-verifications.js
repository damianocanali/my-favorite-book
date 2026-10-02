// Owner-only teacher verification queue (Stage 4, option b).
//
//   GET  ?status=pending|approved|declined (default pending)
//        → { rows: [{ id, user_id, email_domain, school_name, status, created_at, decided_at, decline_reason }] }
//   POST { id, decision: 'approve'|'decline', reason }
//        approve → app_metadata.teacher_verified_{at,by=<owner id>} + row approved
//        decline → row declined with the reason (required, shown to the teacher)
//
// Every call is written to admin_access_log (migration 032). A decision's
// row is written BEFORE anything changes and is REQUIRED: no log, no change.
export const config = { runtime: 'edge' }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, isUuid } from '../_school.js'
import { ownerAuth, logAdminAccess, reasonFrom } from '../_adminLog.js'
import { writeVerification } from '../../lib/school/teacherVerification.js'

const STATUSES = ['pending', 'approved', 'declined']
const SELECT = 'id,user_id,email_domain,school_name,status,created_at,decided_at,decline_reason'

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response

  try {
    if (req.method === 'GET') {
      const raw = new URL(req.url).searchParams.get('status') ?? 'pending'
      const status = STATUSES.includes(raw) ? raw : 'pending'
      const res = await sb(`/rest/v1/teacher_verification_requests?status=eq.${status}&select=${SELECT}&order=created_at.asc&limit=200`)
      if (!res.ok) throw new Error(`queue read failed: ${res.status}`)
      const rows = await res.json()
      await logAdminAccess({ actor: owner.ownerId, action: 'teacher_verification.list', targetTable: 'teacher_verification_requests', detail: { status, count: rows.length } })
      return reply(req, 200, { rows })
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (!isUuid(body.id)) return reply(req, 400, { error: 'Invalid request id', code: 'bad_request' })
      const decision = body.decision
      if (decision !== 'approve' && decision !== 'decline') return reply(req, 400, { error: 'decision must be approve or decline', code: 'bad_request' })
      const reason = reasonFrom(req, body)
      if (decision === 'decline' && !reason) return reply(req, 400, { error: 'A reason is required to decline', code: 'reason_required' })

      const r = await sb(`/rest/v1/teacher_verification_requests?id=eq.${body.id}&select=${SELECT}`)
      if (!r.ok) throw new Error(`request read failed: ${r.status}`)
      const [row] = await r.json()
      if (!row) return reply(req, 404, { error: 'Not found', code: 'not_found' })
      if (row.status !== 'pending') return reply(req, 409, { error: 'Already decided', code: 'already_decided', status: row.status })

      const logged = await logAdminAccess({
        actor: owner.ownerId,
        action: `teacher_verification.${decision}`,
        targetTable: 'teacher_verification_requests',
        targetId: row.id,
        reason,
        detail: { user_id: row.user_id, email_domain: row.email_domain },
      }, { required: true })
      if (!logged) return reply(req, 503, { error: 'Could not write the access log; nothing changed', code: 'log_failed' })

      const now = new Date().toISOString()
      if (decision === 'approve') {
        const ok = await writeVerification(sb, row.user_id, owner.ownerId, now)
        if (!ok) return reply(req, 502, { error: 'Could not mark the teacher verified', code: 'upstream' })
      }
      const patch = await sb(`/rest/v1/teacher_verification_requests?id=eq.${row.id}&status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: decision === 'approve' ? 'approved' : 'declined',
          decided_by: owner.ownerId,
          decided_at: now,
          decline_reason: decision === 'decline' ? reason : null,
          updated_at: now,
        }),
      })
      if (!patch.ok) return reply(req, 502, { error: 'Could not update the request', code: 'upstream' })
      return reply(req, 200, { ok: true, id: row.id, status: decision === 'approve' ? 'approved' : 'declined' })
    }

    return reply(req, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[admin/teacher-verifications] error', e?.message)
    return reply(req, 503, { error: 'Service unavailable, try again' })
  }
}
