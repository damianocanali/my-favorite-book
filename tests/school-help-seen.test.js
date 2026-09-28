import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT_JWT = { id: 'student-auth-1', app_metadata: { role: 'student' } }
const HELP_ID = '6f1c1b1e-0000-4000-8000-000000000010'

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

function call(body) {
  return new Request('https://app.test/api/school/help-seen', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ownedRow = { id: HELP_ID, classroom_id: 'class-1', classrooms: { owner_user_id: TEACHER.id } }
const foreignRow = { id: HELP_ID, classroom_id: 'class-2', classrooms: { owner_user_id: 'someone-else' } }
const lookupRoute = (rows) => ({ method: 'GET', match: '/rest/v1/class_help_requests', reply: { body: rows } })
const patchRoute = (status = 200) => ({ method: 'PATCH', match: '/rest/v1/class_help_requests', reply: { status, body: [{}] } })

describe('POST /api/school/help-seen', () => {
  it('returns 403 for a student JWT', async () => {
    mockSupabase({ user: STUDENT_JWT, routes: [] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(403)
  })

  it('returns 404 not_found for a malformed id, sending no queries', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: 'not-a-uuid' }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
    expect(log.filter((l) => l.method === 'PATCH')).toHaveLength(0)
  })

  it('returns 404 not_found when the help request does not exist, sending no PATCH', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [lookupRoute([])] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
    expect(log.filter((l) => l.method === 'PATCH')).toHaveLength(0)
  })

  it('returns 404 not_found for a help request in another teacher\'s class (same answer as missing), sending no PATCH', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [lookupRoute([foreignRow])] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
    expect(log.filter((l) => l.method === 'PATCH')).toHaveLength(0)
  })

  it('marks an owned help request seen: PATCHes seen_at and seen_by=teacher, returns { ok: true }', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [lookupRoute([ownedRow]), patchRoute()] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const patchCall = log.find((l) => l.method === 'PATCH')
    expect(patchCall.url).toContain(`id=eq.${HELP_ID}`)
    expect(patchCall.body.seen_by).toBe(TEACHER.id)
    expect(typeof patchCall.body.seen_at).toBe('string')
  })

  it('fails closed (503) when the ownership lookup errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 500, body: {} } }] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })

  it('returns 502 upstream when the PATCH write fails', async () => {
    mockSupabase({ user: TEACHER, routes: [lookupRoute([ownedRow]), patchRoute(500)] })
    const { default: handler } = await import('../api/school/help-seen.js')
    const res = await handler(call({ id: HELP_ID }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
  })
})
