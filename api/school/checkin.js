export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json } from '../_school.js'

// Student accounts only (owner decision D7, spec §5a). The child is told on
// the check-in sheet that their teacher can see this. Fixed vocabulary only:
// no free text is ever accepted or stored.
const FEELINGS = ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']
const NEEDS = ['break', 'quiet', 'help_book', 'grownup', 'keep_going']

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const s = await requireStudent(req)
    if (!s.ok) return s.response
    if (!checkRateLimit(`school-checkin:${s.student.id}`, 30).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    const { feeling, need } = body
    if (!FEELINGS.includes(feeling) || (need != null && !NEEDS.includes(need))) {
      return json(req, 400, { error: 'Invalid check-in', code: 'bad_request' })
    }
    const res = await sb('/rest/v1/class_checkins', {
      method: 'POST',
      body: JSON.stringify({ classroom_id: s.student.classroom_id, student_id: s.student.id, feeling, need: need ?? null }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    return json(req, 201, { ok: true })
  } catch (e) {
    console.error('school/checkin: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
