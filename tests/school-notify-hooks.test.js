// The two surgical hooks: a new help ask and a successful hand-in write
// bell rows (and, for urgent ones, fan out through lib/notify).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { STUDENT_USER, CLASS_ID, STUDENT_ID, ASSIGN_ID, SUB_ID, setEnv, mockSupabase, req } from './school-mock.js'

const ALL_WEEK = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, ['00:00', '23:59']]))
const studentRoute = (school_hours) => ({
  method: 'GET', match: '/rest/v1/class_students?auth_user_id=eq.',
  reply: { body: [{ id: STUDENT_ID, classroom_id: CLASS_ID, display_name: 'Ann',
    classrooms: { id: CLASS_ID, name: 'Room 5', timezone: 'America/New_York', school_hours, owner_user_id: 'teacher-1', archived_at: null, locale: 'en' } }] },
})
const bell = (log) => log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/teacher_notifications'))

// A Vercel Edge ctx whose waitUntil collects the deferred work, plus a gate
// that holds every request matching `match` until released — so a test can
// prove the child's response went out BEFORE the fan-out finished.
function deferredCtx() {
  const pending = []
  return { pending, ctx: { waitUntil: (p) => pending.push(p) } }
}
function gateFetch(match) {
  let release
  const gate = new Promise((r) => { release = r })
  const inner = globalThis.fetch
  globalThis.fetch = vi.fn(async (url, init) => {
    if (String(url).includes(match)) await gate
    return inner(url, init)
  })
  return release
}

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('api/school/help.js → notifications', () => {
  const load = async () => (await import('../api/school/help.js')).default
  const routes = (hours, open = []) => [
    studentRoute(hours),
    { method: 'GET', match: '/rest/v1/class_help_requests', reply: { body: open } },
    { method: 'POST', match: '/rest/v1/class_help_requests', reply: { status: 201, body: [{ id: 'help-1' }] } },
    { method: 'PATCH', match: '/rest/v1/class_help_requests', reply: { body: [] } },
  ]

  it('a new grown-up ask in school hours: urgent bell row and notified_at is set', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes(ALL_WEEK) })
    const res = await (await load())(req('help', { method: 'POST', body: { kind: 'grownup' } }))
    expect(res.status).toBe(200)
    expect(bell(log)).toHaveLength(1)
    expect(bell(log)[0].body).toMatchObject({ teacher_user_id: 'teacher-1', classroom_id: CLASS_ID, kind: 'help_grownup', payload: { student_id: STUDENT_ID, class_name: 'Room 5', help_id: 'help-1' } })
    const patch = log.find((l) => l.method === 'PATCH' && l.url.includes('class_help_requests?id=eq.help-1'))
    expect(patch.body.notified_at).toMatch(/^\d{4}-/)
  })

  it('outside school hours: bell row, but notified_at stays empty (nothing was pushed)', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({}) })
    await (await load())(req('help', { method: 'POST', body: { kind: 'grownup' } }))
    expect(bell(log)).toHaveLength(1)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('a book-help ask is a bell row only', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes(ALL_WEEK) })
    await (await load())(req('help', { method: 'POST', body: { kind: 'book' } }))
    expect(bell(log).map((b) => b.body.kind)).toEqual(['help_book'])
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('a dedup bump (same ask within 15 minutes) notifies nothing new', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes(ALL_WEEK, [{ id: 'help-1', asks: 1 }]) })
    const res = await (await load())(req('help', { method: 'POST', body: { kind: 'grownup' } }))
    expect(res.status).toBe(200)
    expect(bell(log)).toHaveLength(0)
    expect(log.filter((l) => l.method === 'PATCH').every((l) => l.body.notified_at === undefined)).toBe(true)
  })

  it('responds before the fan-out: bell row awaited, push + notified_at go to ctx.waitUntil', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes(ALL_WEEK) })
    const release = gateFetch('/rest/v1/teacher_settings')
    const { pending, ctx } = deferredCtx()
    const res = await (await load())(req('help', { method: 'POST', body: { kind: 'grownup' } }), ctx)
    expect(res.status).toBe(200)
    expect(bell(log)).toHaveLength(1)
    expect(pending).toHaveLength(1)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
    release()
    await Promise.all(pending)
    expect(log.find((l) => l.method === 'PATCH').body.notified_at).toMatch(/^\d{4}-/)
  })

  it('a failing notification never fails the child\'s ask', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [...routes(ALL_WEEK).slice(0, 3), { method: 'POST', match: '/rest/v1/teacher_notifications', reply: { status: 500, body: {} } }] })
    const res = await (await load())(req('help', { method: 'POST', body: { kind: 'grownup' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'help-1', in_hours: true })
    expect(bell(log)).toHaveLength(1)
  })
})

describe('api/school/submit.js → notifications', () => {
  const load = async () => (await import('../api/school/submit.js')).default
  const routes = ({ version = 1, wasReturned = false, due = '2026-09-30T00:00:00.000Z', students = [{ id: STUDENT_ID }, { id: 'other' }], subs = [{ student_id: STUDENT_ID }], bellStatus = 201 } = {}) => [
    studentRoute({}),
    { method: 'GET', match: '/rest/v1/assignments', reply: { body: [{ id: ASSIGN_ID, title: 'My pet', status: 'published', due_at: due, allow_late: true }] } },
    { method: 'GET', match: '/rest/v1/user_books', reply: { body: [{ title: 'Moon', book_data: { title: 'Moon', pages: [] } }] } },
    { method: 'POST', match: '/rest/v1/rpc/school_submit', reply: { body: { id: SUB_ID, version, submitted_at: '2026-09-27T12:00:00.000Z', was_returned: wasReturned } } },
    { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: students } },
    { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: subs } },
    { method: 'POST', match: '/rest/v1/teacher_notifications', reply: { status: bellStatus, body: bellStatus < 300 ? [{ id: 'n' }] : {} } },
  ]
  const submit = () => req('submit', { method: 'POST', body: { assignmentId: ASSIGN_ID, bookId: 'book-1' } })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('a first hand-in writes a hand_in bell row with the assignment', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes() })
    expect((await (await load())(submit())).status).toBe(200)
    expect(bell(log).map((b) => b.body.kind)).toEqual(['hand_in'])
    expect(bell(log)[0].body.payload).toMatchObject({ student_id: STUDENT_ID, assignment_id: ASSIGN_ID, assignment_title: 'My pet', submission_id: SUB_ID })
  })

  it('late → hand_in_late; version > 1 → resubmit', async () => {
    let log = mockSupabase({ user: STUDENT_USER, routes: routes({ due: '2026-09-26T00:00:00.000Z' }) })
    await (await load())(submit())
    expect(bell(log).map((b) => b.body.kind)).toEqual(['hand_in_late'])

    vi.resetModules()
    log = mockSupabase({ user: STUDENT_USER, routes: routes({ version: 2 }) })
    await (await load())(submit())
    expect(bell(log).map((b) => b.body.kind)).toEqual(['resubmit'])
  })

  it('a resubmission re-checks "everyone in" only when the replaced hand-in had been sent back', async () => {
    let log = mockSupabase({ user: STUDENT_USER, routes: routes({ version: 2, students: [{ id: STUDENT_ID }], subs: [{ student_id: STUDENT_ID }] }) })
    let res = await (await load())(submit())
    expect(bell(log).map((b) => b.body.kind)).toEqual(['resubmit'])
    expect(Object.keys(await res.json())).not.toContain('was_returned')

    vi.resetModules()
    log = mockSupabase({ user: STUDENT_USER, routes: routes({ version: 2, wasReturned: true, students: [{ id: STUDENT_ID }], subs: [{ student_id: STUDENT_ID }] }) })
    res = await (await load())(submit())
    expect(bell(log).map((b) => b.body.kind)).toEqual(['resubmit', 'all_handed_in'])
  })

  it('the last student handing in adds all_handed_in (deduped per assignment)', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({ students: [{ id: STUDENT_ID }], subs: [{ student_id: STUDENT_ID }] }) })
    await (await load())(submit())
    expect(bell(log).map((b) => b.body.kind)).toEqual(['hand_in', 'all_handed_in'])
    expect(bell(log)[1].body.dedup_key).toBe(`all_handed_in:${ASSIGN_ID}`)
  })

  it('responds before the roster check: all_handed_in runs in ctx.waitUntil', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({ students: [{ id: STUDENT_ID }], subs: [{ student_id: STUDENT_ID }] }) })
    const release = gateFetch('/rest/v1/class_students?classroom_id=eq.')
    const { pending, ctx } = deferredCtx()
    const res = await (await load())(submit(), ctx)
    expect(res.status).toBe(200)
    expect(bell(log).map((b) => b.body.kind)).toEqual(['hand_in'])
    release()
    await Promise.all(pending)
    expect(bell(log).map((b) => b.body.kind)).toEqual(['hand_in', 'all_handed_in'])
  })

  it('a failing notification never fails the hand-in', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ bellStatus: 500 }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(SUB_ID)
  })

  it('a rejected hand-in notifies nothing', async () => {
    const r = routes()
    r[3] = { method: 'POST', match: '/rest/v1/rpc/school_submit', reply: { status: 500, body: {} } }
    const log = mockSupabase({ user: STUDENT_USER, routes: r })
    expect((await (await load())(submit())).status).toBe(502)
    expect(bell(log)).toHaveLength(0)
  })
})
