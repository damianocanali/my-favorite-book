export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, sb, json, isUuid } from '../_school.js'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ROWS = 200

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const studentId = url.searchParams.get('studentId')

    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response

    if (!checkRateLimit(`school-student-checkins:${o.auth.userId}`, 300).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    // Same "doesn't exist" answer for a bad id, a foreign student, and a
    // missing one — ids must not be probeable. Any status (brief req 4): a
    // teacher may still need to review a removed student's check-in history.
    if (!isUuid(studentId)) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    const studentRes = await sb(`/rest/v1/class_students?id=eq.${studentId}&classroom_id=eq.${o.classroom.id}&select=id`)
    if (!studentRes.ok) throw new Error(`class_students lookup failed: ${studentRes.status}`)
    const studentRows = await studentRes.json()
    if (!studentRows?.[0]) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
    const checkinsRes = await sb(
      `/rest/v1/class_checkins?student_id=eq.${studentId}&classroom_id=eq.${o.classroom.id}` +
        `&created_at=gte.${encodeURIComponent(since)}&select=feeling,need,created_at&order=created_at.desc&limit=${MAX_ROWS}`
    )
    if (!checkinsRes.ok) throw new Error(`class_checkins lookup failed: ${checkinsRes.status}`)
    const rows = await checkinsRes.json()
    return json(req, 200, { checkins: rows })
  } catch (e) {
    console.error('school/student-checkins: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
