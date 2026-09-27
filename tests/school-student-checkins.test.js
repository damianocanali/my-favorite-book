import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT_JWT = { id: 'student-auth-1', app_metadata: { role: 'student' } }
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const STUDENT_ID = '6f1c1b1e-0000-4000-8000-000000000002'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

// Copied from tests/school-students.test.js.
function mockSupabase({ user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    log.push({ method, url: u, body: init.body ? JSON.parse(init.body) : undefined })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
    for (const r of routes) {
      if (r.method === method && u.includes(r.match)) {
        const next = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
        return new Response(JSON.stringify(next.body ?? []), { status: next.status ?? 200 })
      }
    }
    return new Response('[]')
  })
  return log
}

function call(query) {
  return new Request(`https://app.test/api/school/student-checkins${query}`, {
    headers: { authorization: 'Bearer jwt' },
  })
}

const classroomRow = {
  id: CLASS_ID, code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: false,
  timezone: 'America/New_York', school_hours: {}, archived_at: null,
}
const classroomRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [classroomRow] } }
const noClassRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [] } }

const studentRoute = (rows) => ({ method: 'GET', match: '/rest/v1/class_students', reply: { body: rows } })
const checkinRows = [
  { feeling: 'happy', need: null, created_at: '2026-09-26T00:00:00.000Z' },
  { feeling: 'tired', need: 'break', created_at: '2026-09-20T00:00:00.000Z' },
]
const checkinsRoute = (rows = checkinRows) => ({ method: 'GET', match: '/rest/v1/class_checkins', reply: { body: rows } })

describe('GET /api/school/student-checkins', () => {
  it('returns 404 class_not_found for a non-owner, making no student or check-in queries', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [noClassRoute] })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
    expect(log.filter((l) => l.url.includes('class_students'))).toHaveLength(0)
    expect(log.filter((l) => l.url.includes('class_checkins'))).toHaveLength(0)
  })

  it('returns 403 for a student JWT', async () => {
    mockSupabase({ user: STUDENT_JWT, routes: [classroomRoute, studentRoute([{ id: STUDENT_ID }]), checkinsRoute()] })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(403)
  })

  it('returns 404 student_not_found for a malformed studentId, sending no student or check-in queries', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [classroomRoute] })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=not-a-uuid`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('student_not_found')
    expect(log.filter((l) => l.url.includes('class_students'))).toHaveLength(0)
    expect(log.filter((l) => l.url.includes('class_checkins'))).toHaveLength(0)
  })

  it('returns 404 student_not_found (same answer) for a student who belongs to another class, sending no check-in query', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [classroomRoute, studentRoute([])] })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('student_not_found')
    expect(log.filter((l) => l.url.includes('class_checkins'))).toHaveLength(0)
  })

  it('returns check-ins for a removed student (any status is in scope)', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([{ id: STUDENT_ID, status: 'removed' }]), checkinsRoute()],
    })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(200)
    expect((await res.json()).checkins).toEqual(checkinRows)
  })

  it('scopes the check-ins query to this student AND this class, ordered newest first, capped at 200, within 30 days', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([{ id: STUDENT_ID }]), checkinsRoute()],
    })
    const { default: handler } = await import('../api/school/student-checkins.js')
    await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    const checkinsCall = log.find((l) => l.url.includes('/rest/v1/class_checkins'))
    expect(checkinsCall.url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(checkinsCall.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(checkinsCall.url).toContain('order=created_at.desc')
    expect(checkinsCall.url).toContain('limit=200')
    expect(checkinsCall.url).toMatch(/created_at=gte\./)
  })

  it('fails closed (503) when the student lookup errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({ user: TEACHER, routes: [classroomRoute, { method: 'GET', match: '/rest/v1/class_students', reply: { status: 500, body: {} } }] })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })

  it('fails closed (503, not an empty list) when the check-ins lookup errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([{ id: STUDENT_ID }]), { method: 'GET', match: '/rest/v1/class_checkins', reply: { status: 500, body: {} } }],
    })
    const { default: handler } = await import('../api/school/student-checkins.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})
