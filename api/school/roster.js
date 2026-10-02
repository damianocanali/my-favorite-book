export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit, hashedClientIp } from '../_rateLimit.js'
import { sb, sbEnv, json } from '../_school.js'
import { CODE_RE } from '../../lib/school/crypto.js'
import { isLicenseUsable } from '../../lib/school/license.js'
import { firstOf } from './classes.js'

// Shared by roster and sign-in: the class a code points at, if children may
// sign in to it right now. Returns { classroom } or { status, code }.
//
// A DB failure here must never be mistaken for "no such class": a non-2xx
// response throws, and the caller's try/catch turns that into a 503
// upstream instead of a 404 that would (wrongly) say the code doesn't exist.
export async function openClassByCode(rawCode) {
  const code = String(rawCode ?? '').toUpperCase()
  if (!CODE_RE.test(code)) return { status: 404, code: 'class_not_found' }
  const res = await sb(
    `/rest/v1/classrooms?code=eq.${encodeURIComponent(code)}&archived_at=is.null` +
      `&select=id,name,locale,sign_in_open,sign_in_paused_until,class_licenses(status,expires_at)`
  )
  if (!res.ok) throw new Error(`classrooms lookup failed: ${res.status}`)
  const rows = await res.json()
  const c = rows?.[0]
  if (!c) return { status: 404, code: 'class_not_found' }
  // "Resting", never "unpaid": children must not be told about money.
  if (!isLicenseUsable(firstOf(c.class_licenses))) return { status: 423, code: 'class_resting' }
  if (!c.sign_in_open) return { status: 423, code: 'sign_in_closed' }
  if (c.sign_in_paused_until && new Date(c.sign_in_paused_until) > new Date()) return { status: 423, code: 'class_paused' }
  return { classroom: { id: c.id, name: c.name, locale: c.locale } }
}

export default async function handler(req, ctx) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    if (!sbEnv()) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })
    if (!checkRateLimit(`school-roster:${await hashedClientIp(req)}`, 60, ctx).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'too_many' })
    }
    const found = await openClassByCode(new URL(req.url).searchParams.get('code'))
    if (!found.classroom) return json(req, found.status, { error: 'Class not available', code: found.code })

    const res = await sb(
      `/rest/v1/class_students?classroom_id=eq.${found.classroom.id}&status=eq.active` +
        `&select=id,display_name,avatar_emoji&order=display_name.asc`
    )
    if (!res.ok) throw new Error(`class_students lookup failed: ${res.status}`)
    const students = await res.json()
    return json(req, 200, { classroom: found.classroom, students })
  } catch (e) {
    console.error('school/roster: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
