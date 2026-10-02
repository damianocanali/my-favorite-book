// Teacher verification status and requests (Stage 4).
//
//   GET  → { verified, by, request: { status, created_at, decline_reason } | null,
//            email_confirmed, school_domain }
//   POST { school_name? } → asks the owner to confirm a teacher whose email
//        is not on a recognised school domain. One pending request per
//        teacher (migration 034). The owner gets an alert with the email
//        DOMAIN and the user id only.
//
// A confirmed school-domain email needs no request: it is verified on the
// spot (requireVerifiedTeacher / teacherVerification in api/_school.js).
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, teacherVerification, sb, json } from '../_school.js'
import { emailDomain, isSchoolDomain } from '../../lib/school/teacherVerification.js'
import { sendOwnerAlert } from '../../lib/notify/ownerAlert.js'

const REQUEST_SELECT = 'id,status,created_at,decline_reason'

async function latestRequest(userId) {
  const res = await sb(
    `/rest/v1/teacher_verification_requests?user_id=eq.${encodeURIComponent(userId)}` +
      `&select=${REQUEST_SELECT}&order=created_at.desc&limit=1`
  )
  if (!res.ok) throw new Error(`verification lookup failed: ${res.status}`)
  const rows = await res.json()
  return rows?.[0] ?? null
}

function view(auth, v, request) {
  const domain = emailDomain(auth.email)
  return {
    verified: !!v.verified,
    by: v.verified ? (v.by === 'domain' || v.by === 'grandfathered' ? v.by : 'owner') : null,
    request: request ? { status: request.status, created_at: request.created_at, decline_reason: request.decline_reason ?? null } : null,
    email_confirmed: !!auth.emailConfirmed,
    school_domain: !!domain && isSchoolDomain(domain),
  }
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    const v = await teacherVerification(t.auth)

    if (req.method === 'GET') {
      const request = v.verified ? null : await latestRequest(t.auth.userId)
      return json(req, 200, view(t.auth, v, request))
    }

    if (req.method === 'POST') {
      if (v.verified) return json(req, 200, view(t.auth, v, null))
      if (!checkRateLimit(`teacher-verify:${t.auth.userId}`, 5).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      const domain = emailDomain(t.auth.email)
      if (!domain) return json(req, 400, { error: 'Your account needs an email address', code: 'no_email' })
      const existing = await latestRequest(t.auth.userId)
      if (existing?.status === 'pending') return json(req, 200, view(t.auth, v, existing))

      const body = await req.json().catch(() => ({}))
      const schoolName = typeof body.school_name === 'string' ? body.school_name.trim().slice(0, 120) || null : null
      const ins = await sb('/rest/v1/teacher_verification_requests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: t.auth.userId, email_domain: domain, school_name: schoolName }),
      })
      // 409: a parallel request won the one-pending slot — same answer.
      if (ins.status === 409) return json(req, 200, view(t.auth, v, await latestRequest(t.auth.userId)))
      if (!ins.ok) return json(req, 502, { error: 'Could not send the request', code: 'upstream' })
      const [row] = await ins.json()

      // No PII beyond the email domain and the user id.
      await sendOwnerAlert({
        subject: 'Teacher verification requested',
        lines: [
          'A teacher asked to be confirmed (their email is not on a recognised school domain).',
          `Email domain: ${domain}`,
          `User id: ${t.auth.userId}`,
          '',
          'Approve or decline in the admin page: /admin (Teacher verification).',
        ],
        idempotencyKey: `teacher-verify-${row?.id ?? t.auth.userId}`,
      })
      return json(req, 201, view(t.auth, v, row))
    }

    return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  } catch (e) {
    console.error('[school/verification] error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
