// Owner-only BULK picture reset, for STUDENT_SECRET_PEPPER rotation
// (privacy review §4.3, §7 item 13; schools spec §4.3 "reset all").
//
// If the pepper leaks, every 3-picture secret is recoverable offline in
// milliseconds (4,096 options). The response is: rotate the pepper in Vercel
// env, then run this. For every ACTIVE student (optionally one class) it:
//   1. rotates the auth password to a random never-shown value (so a
//      password an attacker set through a recovered session can't survive),
//   2. replaces secret_hash with random bytes that match NO picture
//      combination, bumps secret_version, clears lockouts,
//   3. signs the student out everywhere (school_sign_out_user).
// The owner never sees any child's new pictures: teachers hand out fresh
// cards with the existing per-student "New pictures" action, which hashes
// with the NEW pepper.
//
//   GET  ?classroomId=                 → { active_students, confirm_phrase }
//   POST { confirm, expectedCount, reason, classroomId?, after? }
//        confirm must be exactly CONFIRM_PHRASE; expectedCount must equal
//        the current active count (from GET) so a stale screen can't reset
//        more than the owner saw; reason is required. Processes up to
//        BATCH students ordered by id after `after`; repeat with
//        `after: next_after` until done.
//
// Every call is written to admin_access_log (migration 031). The POST's row
// is written BEFORE anything changes and is REQUIRED: no log, no reset.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, sbEnv, isUuid } from '../_school.js'
import { ownerAuth, logAdminAccess, reasonFrom } from '../_adminLog.js'
import { randomPassword } from '../../lib/school/crypto.js'

export const CONFIRM_PHRASE = 'RESET STUDENT PICTURES'
export const BATCH = 200
const CONCURRENCY = 5

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

function scopeFilter(classroomId) {
  return `status=eq.active${classroomId ? `&classroom_id=eq.${classroomId}` : ''}`
}

async function activeCount(classroomId) {
  const res = await sb(`/rest/v1/class_students?${scopeFilter(classroomId)}&select=id`, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact', Range: '0-0' },
  })
  if (!res.ok && res.status !== 206) throw new Error(`count failed: ${res.status}`)
  const total = Number((res.headers.get('content-range') || '').split('/')[1])
  if (!Number.isFinite(total)) throw new Error('count unreadable')
  return total
}

function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function resetOne(row) {
  const pw = await sb(`/auth/v1/admin/users/${row.auth_user_id}`, { method: 'PUT', body: JSON.stringify({ password: randomPassword() }) })
  if (!pw.ok) return false
  const patch = await sb(`/rest/v1/class_students?id=eq.${row.id}&status=eq.active`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      secret_hash: randomHex(),
      secret_version: ((Number(row.secret_version) || 1) % 32000) + 1,
      failed_attempts: 0,
      locked_until: null,
      hard_locked: false,
    }),
  })
  if (!patch.ok) return false
  const out = await sb('/rest/v1/rpc/school_sign_out_user', { method: 'POST', body: JSON.stringify({ p_user_id: row.auth_user_id }) })
  return out.ok
}

async function inPool(items, n, fn) {
  const results = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      results[k] = await fn(items[k]).catch(() => false)
    }
  }))
  return results
}

export async function GET(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (!sbEnv()) return reply(req, 503, { error: 'Not configured' })
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response
  const classroomId = new URL(req.url).searchParams.get('classroomId') || null
  if (classroomId && !isUuid(classroomId)) return reply(req, 400, { error: 'Invalid classroomId' })
  try {
    const n = await activeCount(classroomId)
    await logAdminAccess({
      actor: owner.ownerId, action: 'picture_reset.preview', targetTable: 'class_students',
      targetId: classroomId, reason: reasonFrom(req), detail: { active_students: n },
    })
    return reply(req, 200, { active_students: n, classroom_id: classroomId, confirm_phrase: CONFIRM_PHRASE, batch: BATCH })
  } catch (e) {
    console.error('[admin/picture-reset] GET failed', e?.message)
    return reply(req, 503, { error: 'Service unavailable' })
  }
}

export async function POST(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (!sbEnv()) return reply(req, 503, { error: 'Not configured' })
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response
  try {
    const body = (await req.json().catch(() => null)) ?? {}
    if (body.confirm !== CONFIRM_PHRASE) {
      return reply(req, 400, { error: `Type "${CONFIRM_PHRASE}" to confirm`, code: 'confirm_required' })
    }
    const reason = reasonFrom(req, body)
    if (!reason) return reply(req, 400, { error: 'A reason is required', code: 'reason_required' })
    const classroomId = body.classroomId || null
    if (classroomId && !isUuid(classroomId)) return reply(req, 400, { error: 'Invalid classroomId' })
    const after = body.after ?? null
    if (after !== null && !isUuid(after)) return reply(req, 400, { error: 'Invalid cursor' })

    const n = await activeCount(classroomId)
    if (!Number.isInteger(body.expectedCount) || body.expectedCount !== n) {
      return reply(req, 409, { error: 'The number of students changed. Reload and confirm again.', code: 'count_changed', active_students: n })
    }

    // The audit row comes FIRST and is required: an unlogged bulk reset of
    // children's sign-in secrets must not happen.
    const logged = await logAdminAccess({
      actor: owner.ownerId, action: 'picture_reset.run', targetTable: 'class_students', targetId: classroomId,
      reason, detail: { active_students: n, after },
    }, { required: true })
    if (!logged) return reply(req, 503, { error: 'Could not write the access log; nothing was changed', code: 'log_unavailable' })

    const page = await sb(
      `/rest/v1/class_students?${scopeFilter(classroomId)}${after ? `&id=gt.${after}` : ''}` +
        `&select=id,auth_user_id,secret_version&order=id.asc&limit=${BATCH}`
    )
    if (!page.ok) throw new Error(`class_students page failed: ${page.status}`)
    const rows = await page.json()
    const results = await inPool(rows, CONCURRENCY, resetOne)
    const failedIds = rows.filter((_, i) => !results[i]).map((r) => r.id)
    const done = rows.length < BATCH
    const nextAfter = rows.length ? rows[rows.length - 1].id : after

    await logAdminAccess({
      actor: owner.ownerId, action: 'picture_reset.batch', targetTable: 'class_students', targetId: classroomId,
      reason, detail: { processed: rows.length - failedIds.length, failed: failedIds.length, failed_ids: failedIds.slice(0, 50), next_after: nextAfter, done },
    })
    return reply(req, 200, { processed: rows.length - failedIds.length, failed: failedIds, next_after: nextAfter, done })
  } catch (e) {
    console.error('[admin/picture-reset] POST failed', e?.message)
    return reply(req, 503, { error: 'Service unavailable' })
  }
}

export const OPTIONS = GET
