export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, sb, json, isUuid } from '../_school.js'
import { generatePictureSecret, hashPictureSecret, syntheticStudentEmail, randomPassword } from '../../lib/school/crypto.js'
import { AVATAR_EMOJI } from '../../lib/school/pictures.js'
import { isLicenseUsable, MAX_SEATS } from '../../lib/school/license.js'
import { purgeUser } from '../../lib/deleteUser.js'
import { openTeacherDeletionLog, finishDeletionLog, studentCounts } from '../../lib/school/deletionLog.js'
import { namesMatch } from '../../lib/school/confirmName.js'

const PUBLIC = 'id,display_name,avatar_emoji,status,locked_until,hard_locked,last_sign_in_at,created_at'
const SELECT_WITH_AUTH = `${PUBLIC},auth_user_id`
const BAN_FOREVER = '876000h'

// Built from an explicit allowlist rather than by deleting known-bad keys, so
// a stray column in a PostgREST representation (secret_hash, auth_user_id,
// secret_version, classroom_id, failed_attempts...) can never leak through by
// omission — it simply isn't copied to the output.
function publicShape(row) {
  const { id, display_name, avatar_emoji, status, hard_locked, last_sign_in_at, created_at, locked_until } = row
  return {
    id,
    display_name,
    avatar_emoji,
    status,
    hard_locked,
    last_sign_in_at,
    created_at,
    locked: !!locked_until && new Date(locked_until) > new Date(),
  }
}

const sbEnvForPurge = () => ({
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
})

const cleanName = (n) => String(n ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)

// These two reads guard invariants (license validity, seat count, name
// clashes) that the rest of the handler trusts without re-checking. A
// swallowed failure here would read as "an empty class" and let POST/rename/
// restore proceed on wrong data, so they fail closed: any transport error or
// non-2xx response throws, which the handler's top-level try/catch turns
// into a 503 upstream instead of silently treating the class as empty.
async function loadLicense(classroomId) {
  const res = await sb(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=status,expires_at,seats`)
  if (!res.ok) throw new Error(`license lookup failed: ${res.status}`)
  const rows = await res.json()
  return rows?.[0] ?? null
}

async function activeStudents(classroomId) {
  const res = await sb(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id,display_name,avatar_emoji`)
  if (!res.ok) throw new Error(`active students lookup failed: ${res.status}`)
  return res.json()
}

// One extra bulk query for the whole roster, not one per student: the
// roster shows a small avatar thumbnail when a teacher has made one (Task
// C req 3), and doing that with N per-row requests on every page load would
// be its own performance bug. Best-effort — a failed lookup just means no
// thumbnails show this load, not a broken roster, so it fails OPEN (unlike
// the class image allowance, this is display-only and not a spend gate).
async function loadAvatarMap(authUserIds) {
  const ids = [...new Set(authUserIds.filter(Boolean))]
  if (!ids.length) return {}
  try {
    const res = await sb(`/rest/v1/user_inventory?user_id=in.(${ids.map(encodeURIComponent).join(',')})&select=user_id,avatar_url`)
    if (!res.ok) return {}
    const rows = await res.json()
    const map = {}
    for (const r of rows) if (r.avatar_url) map[r.user_id] = r.avatar_url
    return map
  } catch {
    return {}
  }
}

async function createOne({ classroomId, name, emoji, pepper }) {
  const authRes = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: syntheticStudentEmail(),
      password: randomPassword(), // never stored or shown; sign-in mints sessions
      email_confirm: true,
      app_metadata: { role: 'student', classroom_id: classroomId },
      user_metadata: { display_name: name },
    }),
  })
  if (!authRes.ok) return null
  const authUser = await authRes.json()
  const authId = authUser.id

  try {
    const id = crypto.randomUUID()
    const pictures = generatePictureSecret()
    const ins = await sb('/rest/v1/class_students', {
      method: 'POST',
      body: JSON.stringify({
        id,
        classroom_id: classroomId,
        auth_user_id: authId,
        display_name: name,
        avatar_emoji: emoji,
        secret_hash: await hashPictureSecret(pepper, id, pictures),
        secret_version: 1,
      }),
    })
    if (!ins.ok) throw new Error(`insert ${ins.status}`)
    const meta = await sb(`/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      body: JSON.stringify({ app_metadata: { role: 'student', classroom_id: classroomId, student_id: id } }),
    })
    if (!meta.ok) throw new Error(`metadata ${meta.status}`)
    return { id, display_name: name, avatar_emoji: emoji, pictures }
  } catch (e) {
    console.error('[school/students] create failed, removing auth user', e?.message)
    // The compensating delete is best-effort: if it also fails, log and move
    // on rather than let it abort the whole batch. A student left over in
    // Supabase Auth with no class_students row is an orphaned account (no
    // student can sign in without a row), not a data-integrity risk — safe
    // to clean up later, unlike letting one failure sink every other name.
    try {
      await sb(`/auth/v1/admin/users/${authId}`, { method: 'DELETE' })
    } catch (delErr) {
      console.error('[school/students] compensating delete also failed', delErr?.message)
    }
    return null
  }
}

// A class of 35 created sequentially is ~105 round trips (auth create,
// row insert, metadata PUT) — long enough to risk running past the Edge
// Function time limit partway through, which would lose the one-time
// picture secrets for every student after the cutoff. A small bounded pool
// (no dependency: just N workers pulling from a shared cursor) overlaps
// those round trips while keeping `results` indexed the same as `items`, so
// callers can rebuild output in the original input order regardless of
// which request happens to finish first.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const pepper = process.env.STUDENT_SECRET_PEPPER

    if (req.method === 'GET') {
      const classId = new URL(req.url).searchParams.get('classId')
      const o = await requireClassOwner(req, classId)
      if (!o.ok) return o.response
      // Fails closed: a non-2xx/thrown lookup must not read as "an empty
      // class" — the outer try/catch turns the thrown error into 503
      // upstream instead.
      const res = await sb(`/rest/v1/class_students?classroom_id=eq.${o.classroom.id}&select=${PUBLIC},auth_user_id&order=display_name.asc`)
      if (!res.ok) throw new Error(`class_students lookup failed: ${res.status}`)
      const rows = await res.json()
      const avatarByAuthId = await loadAvatarMap(rows.map((r) => r.auth_user_id))
      return json(req, 200, {
        students: rows.map((r) => {
          const avatar_url = avatarByAuthId[r.auth_user_id]
          return avatar_url ? { ...publicShape(r), avatar_url } : publicShape(r)
        }),
      })
    }

    const body = await req.json().catch(() => ({}))
    const o = await requireClassOwner(req, body.classId)
    if (!o.ok) return o.response
    if (!pepper) return json(req, 503, { error: 'Schools feature not configured', code: 'not_configured' })
    if (!checkRateLimit(`school-students:${o.auth.userId}`, 120).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const classroomId = o.classroom.id

    if (req.method === 'POST') {
      const license = await loadLicense(classroomId)
      if (!isLicenseUsable(license)) return json(req, 403, { error: 'This class needs an active license', code: 'license_required' })
      const input = Array.isArray(body.students) ? body.students.slice(0, MAX_SEATS) : []
      const existing = await activeStudents(classroomId)
      const taken = new Set(existing.map((s) => s.display_name.toLowerCase()))
      const usedEmoji = new Set(existing.map((s) => s.avatar_emoji))

      const skipped = []
      const todo = []
      for (const s of input) {
        const name = cleanName(s?.name)
        if (!name) continue
        if (taken.has(name.toLowerCase())) {
          skipped.push({ name, code: 'duplicate_name' })
          continue
        }
        taken.add(name.toLowerCase())
        const emoji = AVATAR_EMOJI.includes(s?.emoji) ? s.emoji : AVATAR_EMOJI.find((e) => !usedEmoji.has(e)) ?? AVATAR_EMOJI[0]
        usedEmoji.add(emoji)
        todo.push({ name, emoji })
      }
      if (existing.length + todo.length > license.seats) {
        return json(req, 409, { error: 'Not enough seats in this class', code: 'seats_full', seats: license.seats, used: existing.length })
      }

      // Bounded concurrency (5 at a time): see mapWithConcurrency above.
      const results = await mapWithConcurrency(todo, 5, (s) => createOne({ classroomId, name: s.name, emoji: s.emoji, pepper }))
      const created = []
      results.forEach((c, i) => {
        if (c) created.push(c)
        else skipped.push({ name: todo[i].name, code: 'create_failed' })
      })
      return json(req, 201, { created, skipped })
    }

    if (req.method === 'PATCH') {
      if (!isUuid(body.id)) return json(req, 400, { error: 'Invalid student id', code: 'bad_request' })
      const scopedPath = `/rest/v1/class_students?id=eq.${body.id}&classroom_id=eq.${classroomId}`
      // Fails closed: a non-2xx/thrown lookup must not read as "no such
      // student" — the outer try/catch turns the thrown error into 503
      // upstream instead of the wrong 404.
      const lookupRes = await sb(`${scopedPath}&select=${SELECT_WITH_AUTH}`)
      if (!lookupRes.ok) throw new Error(`class_students lookup failed: ${lookupRes.status}`)
      const rows = await lookupRes.json()
      const student = rows?.[0]
      if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
      const { auth_user_id: authId } = student

      const patchRow = (p) =>
        sb(`${scopedPath}&select=${SELECT_WITH_AUTH}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(p),
        })
      const reselect = () => sb(`${scopedPath}&select=${SELECT_WITH_AUTH}`).then((r) => r.json()).catch(() => [])
      const signOut = () => sb('/rest/v1/rpc/school_sign_out_user', { method: 'POST', body: JSON.stringify({ p_user_id: authId }) })
      // A signed-in student session can call supabase.auth.updateUser({password})
      // and later sign back in with email+password, bypassing the picture
      // throttle entirely. Rotating the password to a random, never-shown
      // value on every picture reset and sign-out wipes out anything a child
      // (or anyone with their access token) set.
      const rotatePassword = () => sb(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: JSON.stringify({ password: randomPassword() }) })
      const reply = async (res, extra = {}) => {
        if (!res.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
        const [row] = await res.json()
        return json(req, 200, { student: publicShape(row), ...extra })
      }
      const UNLOCK = { failed_attempts: 0, locked_until: null, hard_locked: false }

      switch (body.action) {
        case 'reset_secret': {
          // Rotate the password FIRST: if it fails, bail out entirely — the
          // new pictures are never generated or returned, so a stale
          // child-set password can't survive alongside a "reset" the teacher
          // was told succeeded.
          const rotated = await rotatePassword()
          if (!rotated.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          const pictures = generatePictureSecret()
          return reply(
            await patchRow({ ...UNLOCK, secret_hash: await hashPictureSecret(pepper, student.id, pictures), secret_version: 1 }),
            { pictures }
          )
        }
        case 'unlock':
          return reply(await patchRow(UNLOCK))
        case 'rename': {
          const p = {}
          if (body.name !== undefined) {
            const name = cleanName(body.name)
            if (!name) return json(req, 400, { error: 'Name is required', code: 'name_required' })
            const clash = (await activeStudents(classroomId)).some(
              (s) => s.id !== student.id && s.display_name.toLowerCase() === name.toLowerCase()
            )
            if (clash) return json(req, 409, { error: 'Another student has that name', code: 'duplicate_name' })
            p.display_name = name
          }
          if (AVATAR_EMOJI.includes(body.emoji)) p.avatar_emoji = body.emoji
          return reply(await patchRow(p))
        }
        case 'sign_out': {
          // Rotate the password too — "sign out" must actually end the
          // child's ability to sign back in with a self-set password, not
          // just drop their current sessions.
          const rotated = await rotatePassword()
          if (!rotated.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          // No empty-body PATCH: RPC-sign-out, then re-select the row to
          // build the reply, rather than issuing a no-op write.
          const res = await signOut()
          if (!res.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          const rows2 = await reselect()
          if (!rows2?.[0]) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          return json(req, 200, { student: publicShape(rows2[0]) })
        }
        case 'remove': {
          // Check the row update before any auth side effect: a failed
          // write must not ban or sign the student out anyway.
          const res = await patchRow({ status: 'removed', removed_at: new Date().toISOString() })
          if (!res.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          const ban = await sb(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: JSON.stringify({ ban_duration: BAN_FOREVER }) })
          if (!ban.ok) {
            // The row says "removed" but the account can still sign in —
            // revert rather than leave the two disagreeing.
            await patchRow({ status: 'active', removed_at: null })
            return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          }
          const out = await signOut()
          // Best-effort: the student is already banned and the row already
          // says removed, so a stuck session (until its access token
          // expires) is not worth failing the whole request over.
          if (!out.ok) console.warn('[school/students] sign-out RPC failed after remove', authId, out.status)
          return reply(res)
        }
        case 'restore': {
          const license = await loadLicense(classroomId)
          const used = (await activeStudents(classroomId)).length
          if (!license || used + 1 > license.seats) return json(req, 409, { error: 'Not enough seats in this class', code: 'seats_full' })
          const res = await patchRow({ status: 'active', removed_at: null })
          if (!res.ok) return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          const unban = await sb(`/auth/v1/admin/users/${authId}`, { method: 'PUT', body: JSON.stringify({ ban_duration: 'none' }) })
          if (!unban.ok) {
            // The row says "active" but the account is still banned —
            // revert rather than leave the two disagreeing.
            await patchRow({ status: 'removed', removed_at: new Date().toISOString() })
            return json(req, 502, { error: 'Could not update student', code: 'upstream' })
          }
          return reply(res)
        }
        case 'delete_now': {
          // Permanent, immediate deletion of one child's account and
          // everything in it (review §7.3) — the same purgeUser a 30-day-old
          // removal gets from the retention cron, without the wait. The
          // teacher must type the child's name; the evidence row is written
          // first and the purge never runs without it.
          if (!checkRateLimit(`school-delete:${o.auth.userId}`, 40).allowed) {
            return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
          }
          if (!namesMatch(body.confirm_name, student.display_name)) {
            return json(req, 400, { error: 'Type the name to confirm', code: 'confirm_mismatch' })
          }
          const env = sbEnvForPurge()
          const opened = await openTeacherDeletionLog(sb, {
            actorUserId: o.auth.userId, actorKind: 'teacher', action: 'delete_student',
            classroomId, targetId: student.id, counts: await studentCounts(sb, student),
          })
          // Response lost and unknowable: tell the teacher it's under way;
          // the retention cron finishes a 'started' row (lib/school/deletionLog.js).
          if (opened.pending) return json(req, 202, { deleted: false, pending: true, id: student.id, code: 'delete_pending' })
          if (opened.failed) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
          const logId = opened.id
          const result = await purgeUser(authId, { ...env, skipVendors: true })
          // A stopped purge stays 'partial' and the retention cron finishes it.
          await finishDeletionLog(sb, logId, result.ok ? true : 'partial')
          if (!result.ok) return json(req, 502, { error: 'Still deleting; it will finish overnight', code: 'delete_incomplete' })
          return json(req, 200, { deleted: true, id: student.id })
        }
        default:
          return json(req, 400, { error: 'Unknown action', code: 'bad_request' })
      }
    }

    return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  } catch (e) {
    console.error('school/students: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
