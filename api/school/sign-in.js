export const config = { runtime: 'edge' }

import { handleCors, getClientIp } from '../_rateLimit.js'
import { sb, sbEnv, json, isUuid } from '../_school.js'
import { openClassByCode } from './roster.js'
import { hashPictureSecret, hashIp, isValidPictureSecret, timingSafeEqualHex } from '../../lib/school/crypto.js'
import { mintStudentSession } from '../../lib/school/session.js'

const STATE_REPLY = {
  ip_blocked: [429, 'too_many'],
  class_paused: [423, 'class_paused'],
  hard_locked: [423, 'ask_teacher'],
  locked: [423, 'locked'],
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const env = sbEnv()
    const pepper = process.env.STUDENT_SECRET_PEPPER
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!env || !pepper || !anonKey) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })

    const body = await req.json().catch(() => ({}))
    if (!isUuid(body.studentId) || !isValidPictureSecret(body.pictures)) {
      return json(req, 400, { error: 'Invalid request', code: 'bad_request' })
    }

    const found = await openClassByCode(body.code)
    if (!found.classroom) return json(req, found.status, { error: 'Class not available', code: found.code })
    const classroomId = found.classroom.id

    // Fails closed: a non-2xx/thrown lookup must not read as "no such
    // student" — that would let a DB hiccup surface as a wrong 404 instead
    // of the 503 that tells the client to retry.
    const studentsRes = await sb(
      `/rest/v1/class_students?id=eq.${body.studentId}&classroom_id=eq.${classroomId}&status=eq.active` +
        `&select=id,auth_user_id,secret_hash`
    )
    if (!studentsRes.ok) throw new Error(`class_students lookup failed: ${studentsRes.status}`)
    const rows = await studentsRes.json()
    const student = rows?.[0]
    if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    const ipHash = await hashIp(pepper, getClientIp(req))
    // Fails closed: a non-2xx RPC response throws instead of falling through
    // STATE_REPLY unmatched, which would otherwise let a DB error bypass the
    // lockout check entirely.
    const rpc = async (fn, args) => {
      const res = await sb(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
      if (!res.ok) throw new Error(`${fn} failed: ${res.status}`)
      return res.json()
    }

    // Checked BEFORE comparing, so a locked account never reveals whether a
    // guess would have been right.
    const state = await rpc('school_sign_in_state', { p_classroom_id: classroomId, p_student_id: student.id, p_ip_hash: ipHash })
    if (STATE_REPLY[state]) {
      const [status, code] = STATE_REPLY[state]
      return json(req, status, { error: 'Sign-in not available right now', code })
    }

    const ok = timingSafeEqualHex(await hashPictureSecret(pepper, student.id, body.pictures), student.secret_hash)
    const after = await rpc('school_record_attempt', { p_classroom_id: classroomId, p_student_id: student.id, p_ip_hash: ipHash, p_ok: ok })
    if (!ok) {
      if (STATE_REPLY[after]) {
        const [status, code] = STATE_REPLY[after]
        return json(req, status, { error: 'Sign-in not available right now', code })
      }
      return json(req, 401, { error: 'Those pictures are not right', code: 'wrong_pictures' })
    }

    const user = await sb(`/auth/v1/admin/users/${student.auth_user_id}`).then((r) => r.json()).catch(() => null)
    const session = user?.email && (await mintStudentSession({ url: env.url, serviceKey: env.key, anonKey, email: user.email }))
    if (!session) return json(req, 502, { error: 'Could not sign in', code: 'sign_in_failed' })
    return json(req, 200, session)
  } catch (e) {
    console.error('school/sign-in: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
