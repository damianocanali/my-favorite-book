export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, requireClassOwner, sb, json } from '../_school.js'
import { generateClassCode } from '../../lib/school/crypto.js'
import { DEFAULT_SCHOOL_HOURS, validateSchoolHours } from '../../lib/school/hours.js'
import { TRIAL_DAYS, TRIAL_IMAGES, MAX_SEATS, MAX_TRIALS_PER_TEACHER } from '../../lib/school/license.js'
import { purgeClassroom } from '../../lib/deleteUser.js'
import { startDeletionLog, finishDeletionLog, classCounts } from '../../lib/school/deletionLog.js'
import { namesMatch } from '../../lib/school/confirmName.js'

const SELECT =
  'id,code,name,locale,sign_in_open,checkins_enabled,timezone,school_hours,created_at,' +
  'class_licenses(id,status,origin,expires_at,seats,image_allowance,images_used),class_students(count)'

// class_licenses.classroom_id is UNIQUE, so PostgREST treats the embed as
// one-to-one and returns an object, not an array. Accept both shapes.
export const firstOf = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null)

function summarize(row) {
  const { class_licenses: lic, class_students: students, ...rest } = row
  return { ...rest, license: firstOf(lic), student_count: students?.[0]?.count ?? 0 }
}

function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

// Class codes are unique; a clash is rare (~1 in a billion per pair) but
// possible, so every write that sets a code retries with a fresh one.
async function withFreshCode(write) {
  for (let i = 0; i < 5; i++) {
    const res = await write(generateClassCode())
    if (res.status !== 409) return res
  }
  return new Response(JSON.stringify({ message: 'code collision' }), { status: 409 })
}

// Fails closed: a failed reload must never surface as `class: null` with a
// 2xx status — that would read as "the class you just created/updated is
// gone" instead of the transient upstream failure it actually is. Thrown
// here, it's caught by each caller's top-level try/catch and turned into a
// 503 upstream response instead.
async function loadOne(id) {
  const r = await sb(`/rest/v1/classrooms?id=eq.${id}&class_students.status=eq.active&select=${SELECT}`)
  if (!r.ok) throw new Error(`classroom reload failed: ${r.status}`)
  const rows = await r.json()
  return rows?.[0] ? summarize(rows[0]) : null
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method === 'GET') {
      const t = await requireTeacher(req)
      if (!t.ok) return t.response
      const r = await sb(
        `/rest/v1/classrooms?owner_user_id=eq.${encodeURIComponent(t.auth.userId)}&archived_at=is.null` +
          `&class_students.status=eq.active&select=${SELECT}&order=created_at.desc`
      )
      if (!r.ok) return json(req, 502, { error: 'Could not load classes', code: 'upstream' })
      const rows = await r.json().catch(() => [])
      return json(req, 200, { classes: rows.map(summarize) })
    }

    if (req.method === 'POST') {
      const t = await requireTeacher(req)
      if (!t.ok) return t.response
      if (!checkRateLimit(`school-classes:${t.auth.userId}`, 60).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      const body = await req.json().catch(() => ({}))
      const name = String(body.name ?? '').trim().slice(0, 60)
      if (!name) return json(req, 400, { error: 'Class name is required', code: 'name_required' })
      const timezone = body.timezone ?? 'America/New_York'
      if (!validTimezone(timezone)) return json(req, 400, { error: 'Unknown time zone', code: 'bad_timezone' })
      const locale = body.locale === 'it' ? 'it' : 'en'

      const created = await withFreshCode((code) =>
        sb('/rest/v1/classrooms', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ code, name, owner_user_id: t.auth.userId, timezone, locale, school_hours: DEFAULT_SCHOOL_HOURS }),
        })
      )
      if (!created.ok) return json(req, 502, { error: 'Could not create class', code: 'upstream' })
      const [classroom] = await created.json()

      const trials = await sb(
        `/rest/v1/class_licenses?owner_user_id=eq.${encodeURIComponent(t.auth.userId)}&origin=eq.trial&select=id`
      ).then((r) => r.json()).catch(() => [])
      let trialUsedUp = false
      if (Array.isArray(trials) && trials.length >= MAX_TRIALS_PER_TEACHER) {
        trialUsedUp = true
      } else {
        const expires = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
        const licenseRes = await sb('/rest/v1/class_licenses', {
          method: 'POST',
          body: JSON.stringify({
            owner_user_id: t.auth.userId, classroom_id: classroom.id, origin: 'trial', status: 'trial',
            seats: MAX_SEATS, image_allowance: TRIAL_IMAGES, expires_at: expires,
          }),
        })
        // Don't fail class creation over a license hiccup — the class is
        // already created. But there is no retry path yet: a failed trial
        // insert leaves the class without a license until Stage 4 adds
        // purchasing / manual comping.
        if (!licenseRes.ok) console.error('school/classes: trial license insert failed', licenseRes.status)
      }
      return json(req, 201, { class: await loadOne(classroom.id), ...(trialUsedUp ? { trial_used_up: true } : {}) })
    }

    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}))
      const o = await requireClassOwner(req, body.id)
      if (!o.ok) return o.response
      if (!checkRateLimit(`school-classes:${o.auth.userId}`, 60).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      const patch = {}
      if (body.name !== undefined) {
        const name = String(body.name).trim().slice(0, 60)
        if (!name) return json(req, 400, { error: 'Class name is required', code: 'name_required' })
        patch.name = name
      }
      if (body.sign_in_open !== undefined) patch.sign_in_open = !!body.sign_in_open
      if (body.checkins_enabled !== undefined) patch.checkins_enabled = !!body.checkins_enabled
      if (body.locale !== undefined) patch.locale = body.locale === 'it' ? 'it' : 'en'
      if (body.timezone !== undefined) {
        if (!validTimezone(body.timezone)) return json(req, 400, { error: 'Unknown time zone', code: 'bad_timezone' })
        patch.timezone = body.timezone
      }
      if (body.school_hours !== undefined) {
        if (!validateSchoolHours(body.school_hours)) return json(req, 400, { error: 'Invalid school hours', code: 'bad_hours' })
        patch.school_hours = body.school_hours
      }
      if (body.archived !== undefined) patch.archived_at = body.archived ? new Date().toISOString() : null

      const write = (extra) =>
        sb(`/rest/v1/classrooms?id=eq.${o.classroom.id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, ...extra }) })
      const res = body.rotate_code ? await withFreshCode((code) => write({ code })) : await write({})
      if (!res.ok) return json(req, 502, { error: 'Could not update class', code: 'upstream' })
      return json(req, 200, { class: await loadOne(o.classroom.id) })
    }

    if (req.method === 'DELETE') {
      // Permanent, immediate deletion of a class and everything in it
      // (review §7.3, spec "Teacher deletes the class"): every student's
      // account is purged, then the class (lib/deleteUser.js
      // purgeClassroom), each child with their own deletion_log row. The
      // teacher must type the class name; the class's evidence row is
      // written first and nothing is deleted without it.
      //
      // Edge time budget: if the purge stops part-way (a failure, or a very
      // slow run), the row is marked 'partial' and api/cron/retention.js
      // finishes the job overnight — the teacher is told so
      // (delete_incomplete), and trying again also finishes it.
      const id = new URL(req.url).searchParams.get('id')
      const o = await requireClassOwner(req, id)
      if (!o.ok) return o.response
      // Rate limit before the name check, so the check itself can't be
      // used to probe class names.
      if (!checkRateLimit(`school-class-delete:${o.auth.userId}`, 10).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      const body = await req.json().catch(() => ({}))
      if (!namesMatch(body.confirm_name, o.classroom.name)) {
        return json(req, 400, { error: 'Type the class name to confirm', code: 'confirm_mismatch' })
      }
      const logId = await startDeletionLog(sb, {
        actorUserId: o.auth.userId, actorKind: 'teacher', action: 'delete_class',
        classroomId: o.classroom.id, targetId: o.classroom.id, counts: await classCounts(sb, o.classroom.id),
      })
      if (logId == null) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
      const result = await purgeClassroom(o.classroom, {
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
        deletionLog: { actorKind: 'teacher', actorUserId: o.auth.userId },
      })
      await finishDeletionLog(sb, logId, result.ok ? true : 'partial')
      if (!result.ok) return json(req, 502, { error: 'Part of the class is still being deleted; it will finish overnight', code: 'delete_incomplete' })
      return json(req, 200, { deleted: true, id: o.classroom.id })
    }

    return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  } catch (e) {
    console.error('school/classes: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
