export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit, hashedClientIp } from '../_rateLimit.js'
import { sb, sbEnv, json, isUuid } from '../_school.js'
import { openClassByCode } from './roster.js'
import { hashPictureSecret, isValidPictureSecret, timingSafeEqualHex, randomPassword } from '../../lib/school/crypto.js'
import { mintStudentSession } from '../../lib/school/session.js'

// school_begin_attempt's `state` field, for every outcome other than 'ok'.
const BEGIN_STATE_REPLY = {
  not_found: [404, 'student_not_found'],
  ip_blocked: [429, 'too_many'],
  class_paused: [423, 'class_paused'],
  hard_locked: [423, 'ask_teacher'],
  locked: [423, 'locked'],
}

// school_begin_attempt's `after` field: what a WRONG guess leaves the
// student's lockout state as. 'ok' falls through to the plain wrong-pictures
// reply below.
const AFTER_REPLY = {
  hard_locked: [423, 'ask_teacher'],
  locked: [423, 'locked'],
}

export default async function handler(req, ctx) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const env = sbEnv()
    const pepper = process.env.STUDENT_SECRET_PEPPER
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!env || !pepper || !anonKey) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })

    // Defense in depth on top of the per-student/per-IP throttle inside
    // school_begin_attempt: a generous cap that only bites a genuine flood.
    // The IP is only ever used as an HMAC with IP_HASH_KEY (falls back to
    // the pepper until that is set): rate-limit keys and attempt rows alike.
    const ipHash = await hashedClientIp(req)
    if (!checkRateLimit(`school-sign-in:${ipHash}`, 600, ctx).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'too_many' })
    }

    const body = (await req.json().catch(() => null)) ?? {}
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

    // Fails closed: a non-2xx RPC response throws instead of being read as
    // an unmatched state, which would otherwise let a DB error bypass the
    // lockout check entirely.
    const rpc = async (fn, args) => {
      const res = await sb(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
      if (!res.ok) throw new Error(`${fn} failed: ${res.status}`)
      return res.json()
    }

    // Records this attempt as a FAILURE, under a row lock on the student,
    // before any comparison happens — a parallel burst of guesses is thus
    // serialised one at a time instead of all reading the lock state as
    // "ok" and all getting compared. A right guess is un-done by
    // school_confirm_attempt below.
    const begin = await rpc('school_begin_attempt', { p_classroom_id: classroomId, p_student_id: student.id, p_ip_hash: ipHash })
    // Fail closed on any state other than 'ok': an unrecognised/unexpected
    // state must never fall through to the picture comparison below — a new
    // or misspelled state from the RPC is treated the same as a DB error
    // (503), not silently read as "go ahead and compare".
    if (begin?.state !== 'ok') {
      const mapped = BEGIN_STATE_REPLY[begin?.state]
      if (mapped) {
        const [status, code] = mapped
        return json(req, status, { error: 'Sign-in not available right now', code })
      }
      throw new Error(`school_begin_attempt returned unexpected state: ${begin?.state}`)
    }

    const ok = timingSafeEqualHex(await hashPictureSecret(pepper, student.id, body.pictures), student.secret_hash)
    if (!ok) {
      const [status, code] = AFTER_REPLY[begin.after] ?? [401, 'wrong_pictures']
      return json(req, status, { error: status === 401 ? 'Those pictures are not right' : 'Sign-in not available right now', code })
    }

    const confirmed = await rpc('school_confirm_attempt', { p_attempt_id: begin.attempt_id, p_student_id: student.id })
    if (confirmed !== 'ok') return json(req, 401, { error: 'Those pictures are not right', code: 'wrong_pictures' })

    // Wipe out any password a signed-in session set via
    // supabase.auth.updateUser({password}) — done on every successful
    // sign-in, before minting a new session, so such a password never
    // survives long enough to let email+password sign-in bypass the picture
    // throttle.
    const rotated = await sb(`/auth/v1/admin/users/${student.auth_user_id}`, {
      method: 'PUT',
      body: JSON.stringify({ password: randomPassword() }),
    })
    if (!rotated.ok) return json(req, 502, { error: 'Could not sign in', code: 'sign_in_failed' })

    const user = await sb(`/auth/v1/admin/users/${student.auth_user_id}`).then((r) => r.json()).catch(() => null)
    const session = user?.email && (await mintStudentSession({ url: env.url, serviceKey: env.key, anonKey, email: user.email }))
    if (!session) return json(req, 502, { error: 'Could not sign in', code: 'sign_in_failed' })
    return json(req, 200, session)
  } catch (e) {
    console.error('school/sign-in: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
