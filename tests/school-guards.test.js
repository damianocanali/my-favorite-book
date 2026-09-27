import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

const req = (headers = {}) => new Request('https://app.test/api/x', { headers: { authorization: 'Bearer jwt', ...headers } })

/// user: the /auth/v1/user payload; rows: map of URL substring -> JSON body
function mockSupabase(user, rows = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user), { status: user ? 200 : 401 })
    for (const [needle, body] of Object.entries(rows)) if (u.includes(needle)) return new Response(JSON.stringify(body))
    return new Response('[]')
  })
}

describe('verifyJwt', () => {
  it('returns app_metadata so role can be trusted', async () => {
    mockSupabase({ id: 'u1', email: 'x', app_metadata: { role: 'student' } })
    const { verifyJwt } = await import('../api/_auth.js')
    const a = await verifyJwt(req())
    expect(a.appMetadata).toEqual({ role: 'student' })
  })
  it('defaults app_metadata to {}', async () => {
    mockSupabase({ id: 'u1', email: 'x' })
    const { verifyJwt } = await import('../api/_auth.js')
    expect((await verifyJwt(req())).appMetadata).toEqual({})
  })
})

describe('student guards', () => {
  it('isStudent trusts app_metadata only, never user_metadata', async () => {
    const { isStudent } = await import('../api/_school.js')
    expect(isStudent({ appMetadata: { role: 'student' } })).toBe(true)
    expect(isStudent({ appMetadata: {}, userMetadata: { role: 'student' } })).toBe(false)
    expect(isStudent(null)).toBe(false)
  })
  it('rejectStudent blocks students with a code and lets others through', async () => {
    const { rejectStudent } = await import('../api/_school.js')
    const r = rejectStudent({ appMetadata: { role: 'student' } }, req())
    expect(r.status).toBe(403)
    expect((await r.json()).code).toBe('student_forbidden')
    expect(rejectStudent({ appMetadata: {} }, req())).toBeNull()
  })
  it('requireTeacher refuses a student session', async () => {
    mockSupabase({ id: 'u1', app_metadata: { role: 'student' } })
    const { requireTeacher } = await import('../api/_school.js')
    const r = await requireTeacher(req())
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(403)
  })
  it('requireClassOwner filters by owner and gives the same 404 for missing and foreign', async () => {
    mockSupabase({ id: 'teacher-1', app_metadata: {} }, { '/rest/v1/classrooms': [] })
    const { requireClassOwner } = await import('../api/_school.js')
    const r = await requireClassOwner(req(), '6f1c1b1e-0000-4000-8000-000000000001')
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(404)
    const call = globalThis.fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/rest/v1/classrooms'))
    expect(call).toContain('owner_user_id=eq.teacher-1')
  })
  it('requireClassOwner rejects a non-uuid id without querying', async () => {
    mockSupabase({ id: 'teacher-1', app_metadata: {} })
    const { requireClassOwner } = await import('../api/_school.js')
    const r = await requireClassOwner(req(), "x' or 1=1")
    expect(r.response.status).toBe(400)
  })
  it('requireStudent loads the active student row', async () => {
    mockSupabase(
      { id: 'kid-auth', app_metadata: { role: 'student', student_id: 's1', classroom_id: 'c1' } },
      { '/rest/v1/class_students': [{ id: 's1', classroom_id: 'c1', display_name: 'Maya R', status: 'active', classrooms: { id: 'c1', name: '3B', timezone: 'America/New_York', school_hours: {} } }] }
    )
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(true)
    expect(r.student.id).toBe('s1')
    expect(r.classroom.id).toBe('c1')
  })
  it('requireStudent refuses an archived class with 403 class_resting', async () => {
    mockSupabase(
      { id: 'kid-auth', app_metadata: { role: 'student', student_id: 's1', classroom_id: 'c1' } },
      {
        '/rest/v1/class_students': [
          {
            id: 's1', classroom_id: 'c1', display_name: 'Maya R', status: 'active',
            classrooms: { id: 'c1', name: '3B', timezone: 'America/New_York', school_hours: {}, archived_at: '2026-01-01T00:00:00.000Z' },
          },
        ],
      }
    )
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(403)
    expect((await r.response.json()).code).toBe('class_resting')
  })

  it('requireStudent refuses a removed student', async () => {
    mockSupabase({ id: 'kid-auth', app_metadata: { role: 'student' } }, { '/rest/v1/class_students': [] })
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(false)
    expect((await r.response.json()).code).toBe('student_removed')
  })
  it('requireClassOwner returns 503 when fetch throws', async () => {
    mockSupabase({ id: 'teacher-1', app_metadata: {} })
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'teacher-1', app_metadata: {} }))
      if (u.includes('/rest/v1/classrooms')) throw new Error('Network error')
      return new Response('[]')
    })
    const { requireClassOwner } = await import('../api/_school.js')
    const r = await requireClassOwner(req(), '6f1c1b1e-0000-4000-8000-000000000001')
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(503)
    expect((await r.response.json()).code).toBe('upstream')
  })
  it('requireStudent returns 503 when fetch returns non-2xx', async () => {
    mockSupabase({ id: 'kid-auth', app_metadata: { role: 'student' } })
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'kid-auth', app_metadata: { role: 'student' } }))
      if (u.includes('/rest/v1/class_students')) return new Response('Internal Server Error', { status: 500 })
      return new Response('[]')
    })
    const { requireStudent } = await import('../api/_school.js')
    const r = await requireStudent(req())
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(503)
    expect((await r.response.json()).code).toBe('upstream')
  })
})

describe('requireUser appMetadata', () => {
  it('returns appMetadata from verifyJwt', async () => {
    mockSupabase({ id: 'u1', email: 'x@y.z', app_metadata: { custom: 'data' } })
    const { requireUser } = await import('../api/_aiGuard.js')
    const r = await requireUser(req())
    expect(r.ok).toBe(true)
    expect(r.appMetadata).toEqual({ custom: 'data' })
  })
})

// bumpStudentImage is the shared meter both enforceStudentImageCap (student
// spending their own allowance) and api/school/student-avatar.js (a teacher
// spending a specific student's allowance) call — tested directly here so
// neither caller needs to re-prove the RPC contract.
describe('bumpStudentImage', () => {
  it('spends the allowance and returns null when allowed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('true'))
    const { bumpStudentImage } = await import('../api/_school.js')
    expect(await bumpStudentImage('s1', new Request('https://app.test/x'))).toBeNull()
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/rpc/school_bump_image')
    expect(JSON.parse(init.body)).toEqual({ p_student_id: 's1', p_daily_limit: 15 })
  })

  it('429s with class_image_limit when the allowance is used up', async () => {
    globalThis.fetch = vi.fn(async () => new Response('false'))
    const { bumpStudentImage } = await import('../api/_school.js')
    const r = await bumpStudentImage('s1', new Request('https://app.test/x'))
    expect(r.status).toBe(429)
    expect((await r.json()).code).toBe('class_image_limit')
  })

  it('fails closed (503) when the RPC errors', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 }))
    const { bumpStudentImage } = await import('../api/_school.js')
    const r = await bumpStudentImage('s1', new Request('https://app.test/x'))
    expect(r.status).toBe(503)
  })

  it('fails closed (503) when the fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down') })
    const { bumpStudentImage } = await import('../api/_school.js')
    const r = await bumpStudentImage('s1', new Request('https://app.test/x'))
    expect(r.status).toBe(503)
  })
})
