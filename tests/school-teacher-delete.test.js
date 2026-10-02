// Teacher "delete now" for a student and a class (review §7.3): typed-name
// confirmation, a deletion_log evidence row first, then the real purge.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setEnv, mockSupabase, ownerRoute, notOwnerRoute, TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, req } from './school-mock.js'
import { namesMatch } from '../lib/school/confirmName.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  process.env.STUDENT_SECRET_PEPPER = 'pepper'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const logRoute = { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 9 }] } }
const studentRow = { id: STUDENT_ID, display_name: 'Lucía', avatar_emoji: '🦊', status: 'removed', auth_user_id: 'kid-auth-1' }
const studentLookup = { method: 'GET', match: `/rest/v1/class_students?id=eq.${STUDENT_ID}`, reply: { body: [studentRow] } }

const students = async () => (await import('../api/school/students.js')).default
const classes = async () => (await import('../api/school/classes.js')).default

describe('namesMatch', () => {
  it('ignores case, spacing and composition, never matches empty', () => {
    expect(namesMatch('  lucía ', 'Lucía')).toBe(true)
    expect(namesMatch('Lucía', 'Lucía')).toBe(true)
    expect(namesMatch('Lucia', 'Lucía')).toBe(false)
    expect(namesMatch('', '')).toBe(false)
    expect(namesMatch(undefined, 'Room 5')).toBe(false)
  })
})

describe('PATCH /api/school/students delete_now', () => {
  it('refuses without the typed name and deletes nothing', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, studentLookup, logRoute] })
    const res = await (await students())(req('students', { method: 'PATCH', body: { classId: CLASS_ID, id: STUDENT_ID, action: 'delete_now', confirm_name: 'Luc' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('confirm_mismatch')
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
    expect(log.some((l) => l.url.includes('deletion_log'))).toBe(false)
  })

  it('logs, purges the child account, closes the log', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, studentLookup, logRoute] })
    const res = await (await students())(req('students', { method: 'PATCH', body: { classId: CLASS_ID, id: STUDENT_ID, action: 'delete_now', confirm_name: 'lucía' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, id: STUDENT_ID })
    const open = log.findIndex((l) => l.method === 'POST' && l.url.includes('/rest/v1/deletion_log'))
    const authDel = log.findIndex((l) => l.method === 'DELETE' && l.url.endsWith('/auth/v1/admin/users/kid-auth-1'))
    expect(open).toBeGreaterThanOrEqual(0)
    expect(authDel).toBeGreaterThan(open)
    expect(log[open].body).toMatchObject({ actor_user_id: TEACHER.id, actor_kind: 'teacher', action: 'delete_student', classroom_id: CLASS_ID, target_id: STUDENT_ID })
    // Evidence never holds the child's name.
    expect(JSON.stringify(log[open].body)).not.toContain('Lucía')
    const close = log.find((l) => l.method === 'PATCH' && l.url.includes('deletion_log?id=eq.9'))
    expect(close.body.status).toBe('done')
  })

  it('does not purge when the evidence row cannot be written', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, studentLookup, { ...logRoute, reply: { status: 500, body: {} } }] })
    const res = await (await students())(req('students', { method: 'PATCH', body: { classId: CLASS_ID, id: STUDENT_ID, action: 'delete_now', confirm_name: 'Lucía' } }))
    expect(res.status).toBe(503)
    expect(log.some((l) => l.url.includes('/auth/v1/admin/users/kid-auth-1'))).toBe(false)
  })

  it("can't reach another teacher's student", async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, studentLookup, logRoute] })
    const res = await (await students())(req('students', { method: 'PATCH', body: { classId: CLASS_ID, id: STUDENT_ID, action: 'delete_now', confirm_name: 'Lucía' } }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
  })

  it('a student account cannot call it', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [ownerRoute, studentLookup, logRoute] })
    const res = await (await students())(req('students', { method: 'PATCH', body: { classId: CLASS_ID, id: STUDENT_ID, action: 'delete_now', confirm_name: 'Lucía' } }))
    expect(res.status).toBe(403)
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
  })
})

describe('DELETE /api/school/classes', () => {
  const del = (confirm_name, id = CLASS_ID) => new Request(`https://app.test/api/school/classes?id=${id}`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: JSON.stringify({ confirm_name }),
  })
  const kids = { method: 'GET', match: `class_students?classroom_id=eq.${CLASS_ID}&select=id,auth_user_id`, reply: { body: [{ id: 's-1', auth_user_id: 'k1' }, { id: 's-2', auth_user_id: 'k2' }, { id: 's-3', auth_user_id: 'k3' }] } }

  it('refuses a wrong typed name', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, kids, logRoute] })
    const res = await (await classes())(del('Room 6'))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('confirm_mismatch')
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
  })

  it('logs, purges every student then the class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, kids, logRoute] })
    const res = await (await classes())(del('room 5'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true, id: CLASS_ID })
    const open = log.findIndex((l) => l.method === 'POST' && l.url.includes('/rest/v1/deletion_log'))
    expect(log[open].body).toMatchObject({ actor_kind: 'teacher', action: 'delete_class', classroom_id: CLASS_ID })
    const classDel = log.findIndex((l) => l.method === 'DELETE' && l.url.includes(`/rest/v1/classrooms?id=eq.${CLASS_ID}`))
    for (const k of ['k1', 'k2', 'k3']) {
      const i = log.findIndex((l) => l.method === 'DELETE' && l.url.endsWith(`/auth/v1/admin/users/${k}`))
      expect(i).toBeGreaterThan(open)
      expect(i).toBeLessThan(classDel)
    }
    expect(log.filter((l) => l.method === 'PATCH' && l.url.includes('deletion_log?id=eq.9')).at(-1).body.status).toBe('done')
    // One evidence row per child, no names.
    const perChild = log.filter((l) => l.method === 'POST' && l.url.includes('deletion_log') && l.body.action === 'purge_class_student')
    expect(perChild.map((l) => l.body.target_id).sort()).toEqual(['s-1', 's-2', 's-3'])
    expect(perChild.every((l) => l.body.actor_kind === 'teacher' && l.body.actor_user_id === TEACHER.id)).toBe(true)
  })

  it('checks the rate limit before the typed name', async () => {
    const src = (await import('node:fs')).readFileSync('api/school/classes.js', 'utf8')
    const del = src.slice(src.indexOf("req.method === 'DELETE'"))
    expect(del.indexOf('checkRateLimit')).toBeLessThan(del.indexOf('namesMatch'))
    const st = (await import('node:fs')).readFileSync('api/school/students.js', 'utf8')
    const dn = st.slice(st.indexOf("case 'delete_now'"))
    expect(dn.indexOf('checkRateLimit')).toBeLessThan(dn.indexOf('namesMatch'))
  })

  it('keeps the class (retryable) when a student purge fails', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute, kids, logRoute, { method: 'DELETE', match: '/auth/v1/admin/users/k2', reply: { status: 500, body: {} } }],
    })
    const res = await (await classes())(del('Room 5'))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('delete_incomplete')
    expect(log.some((l) => l.method === 'DELETE' && l.url.includes('/rest/v1/classrooms?id=eq.'))).toBe(false)
    // 'partial': the retention cron finishes it overnight.
    expect(log.filter((l) => l.method === 'PATCH' && l.url.includes('deletion_log?id=eq.9')).at(-1).body.status).toBe('partial')
  })

  it("someone else's class is a 404 and nothing is deleted", async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, kids, logRoute] })
    const res = await (await classes())(del('Room 5'))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
  })
})

describe('PATCH /api/school/classes checkins_enabled (review §7.28)', () => {
  it('saves the switch', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute] })
    const res = await (await classes())(req('classes', { method: 'PATCH', body: { id: CLASS_ID, checkins_enabled: false } }))
    expect(res.status).toBe(200)
    const patch = log.find((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/classrooms?id=eq.'))
    expect(patch.body).toEqual({ checkins_enabled: false })
  })
})
