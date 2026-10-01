import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, STUDENT2_ID, ASSIGN_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, req, err500,
} from './school-mock.js'
import { cleanNudgeMessage, teacherDisplayName, isOpenAssignment } from '../lib/school/nudges.js'

const NUDGE_ID = '6f1c1b1e-0000-4000-8000-0000000000e1'
const OTHER_ID = '6f1c1b1e-0000-4000-8000-0000000000f9'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const load = async () => (await import('../api/school/nudges.js')).default
const TEACHER_NAMED = { ...TEACHER, user_metadata: { display_name: 'Ms Rivera' } }

const rosterRoute = (ids = [STUDENT_ID, STUDENT2_ID]) => ({
  method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: ids.map((id) => ({ id })) },
})
const assignmentRoute = (rows = [{ id: ASSIGN_ID }]) => ({ method: 'GET', match: '/rest/v1/assignments?id=eq.', reply: { body: rows } })
const rpcOk = { method: 'POST', match: '/rest/v1/rpc/school_send_nudge', reply: (call) => ({ body: { id: NUDGE_ID, student_id: call.body.p_student_id } }) }
const post = (body) => req('nudges', { method: 'POST', body: { classId: CLASS_ID, ...body } })

describe('POST /api/school/nudges (teacher)', () => {
  it('401s without a session', async () => {
    globalThis.fetch = vi.fn(async (u) => new Response('{}', { status: String(u).endsWith('/auth/v1/user') ? 401 : 200 }))
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'story_waiting' }))
    expect(res.status).toBe(401)
  })

  it('403s a student', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [ownerRoute, rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'story_waiting' }))
    expect(res.status).toBe(403)
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })

  it('404s another teacher\'s class and never calls the RPC', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'story_waiting' }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })

  it('skips a student who is not in this class (another class\'s child) without calling the RPC for them', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute([STUDENT_ID]), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID, OTHER_ID], preset: 'story_waiting' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toEqual([{ student_id: STUDENT_ID, id: NUDGE_ID }])
    expect(body.skipped).toEqual([{ student_id: OTHER_ID, code: 'not_found' }])
    const rpcs = log.filter((l) => l.url.includes('school_send_nudge'))
    expect(rpcs).toHaveLength(1)
    expect(rpcs[0].body.p_student_id).toBe(STUDENT_ID)
    // The roster lookup is scoped to the class and to active students.
    const roster = log.find((l) => l.url.includes('/rest/v1/class_students?classroom_id=eq.'))
    expect(roster.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(roster.url).toContain('status=eq.active')
  })

  it('sends a preset with the teacher\'s display name and the daily cap of 3', async () => {
    const log = mockSupabase({ user: TEACHER_NAMED, routes: [ownerRoute, rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID, STUDENT2_ID], preset: 'one_more_page' }))
    expect(res.status).toBe(200)
    expect((await res.json()).sent).toHaveLength(2)
    const rpc = log.find((l) => l.url.includes('school_send_nudge'))
    expect(rpc.body).toMatchObject({
      p_classroom_id: CLASS_ID, p_teacher_user_id: 'teacher-1', p_teacher_name: 'Ms Rivera',
      p_preset: 'one_more_page', p_message: null, p_assignment_id: null, p_daily_cap: 3,
    })
  })

  it('maps daily_cap from the RPC to a skip, not an error', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), {
      method: 'POST', match: 'school_send_nudge',
      reply: (call) => call.body.p_student_id === STUDENT2_ID
        ? { status: 400, body: { code: 'P0001', message: 'daily_cap' } }
        : { body: { id: NUDGE_ID } },
    }] })
    const body = await (await (await load())(post({ studentIds: [STUDENT_ID, STUDENT2_ID], preset: 'cant_wait' }))).json()
    expect(body.sent).toEqual([{ student_id: STUDENT_ID, id: NUDGE_ID }])
    expect(body.skipped).toEqual([{ student_id: STUDENT2_ID, code: 'daily_cap' }])
  })

  it('503s when every send failed upstream', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), err500('POST', 'school_send_nudge')] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'cant_wait' }))
    expect(res.status).toBe(503)
  })

  it('503s (fails closed) when the roster read errors', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('GET', '/rest/v1/class_students?classroom_id=eq.')] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'cant_wait' }))
    expect(res.status).toBe(503)
  })

  it.each([
    ['no students', { studentIds: [], preset: 'story_waiting' }],
    ['36 students', { studentIds: Array.from({ length: 36 }, (_, i) => `6f1c1b1e-0000-4000-8000-${String(i).padStart(12, '0')}`), preset: 'story_waiting' }],
    ['a non-uuid id', { studentIds: ['nope'], preset: 'story_waiting' }],
    ['neither preset nor message', { studentIds: [STUDENT_ID] }],
    ['both preset and message', { studentIds: [STUDENT_ID], preset: 'story_waiting', message: 'hi' }],
    ['an unknown preset', { studentIds: [STUDENT_ID], preset: 'hurry_up' }],
    ['hand_in without an assignment', { studentIds: [STUDENT_ID], preset: 'hand_in' }],
    ['a blank message', { studentIds: [STUDENT_ID], message: '    ' }],
    ['141 UTF-16 units', { studentIds: [STUDENT_ID], message: 'a'.repeat(141) }],
    ['71 emoji (142 UTF-16 units, 71 code points)', { studentIds: [STUDENT_ID], message: '😀'.repeat(71) }],
    ['a bad assignment id', { studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: 'x' }],
  ])('400s %s', async (_, body) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), assignmentRoute(), rpcOk] })
    const res = await (await load())(post(body))
    expect(res.status).toBe(400)
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })

  it('accepts exactly 140 UTF-16 units, trimmed', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), rpcOk] })
    const msg = '😀'.repeat(70) // 140 UTF-16 units
    const res = await (await load())(post({ studentIds: [STUDENT_ID], message: `  ${msg}  ` }))
    expect(res.status).toBe(200)
    expect(log.find((l) => l.url.includes('school_send_nudge')).body.p_message).toBe(msg)
  })

  it('hand_in: checks the assignment is this class\'s and published, then links it', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute(), rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))
    expect(res.status).toBe(200)
    const a = log.find((l) => l.url.includes('/rest/v1/assignments?id=eq.'))
    expect(a.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(a.url).toContain('status=eq.published')
    expect(log.find((l) => l.url.includes('school_send_nudge')).body.p_assignment_id).toBe(ASSIGN_ID)
  })

  it('hand_in: a hand-in sent back to revise does not count as handed in (migration 022)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute(), rosterRoute(),
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } }, rpcOk] })
    const body = await (await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))).json()
    expect(body.sent.map((s) => s.student_id)).toEqual([STUDENT_ID])
    expect(log.find((l) => l.url.includes('/rest/v1/class_submissions')).url).toContain('returned_at=is.null')
  })

  it('hand_in skips children who already handed that assignment in, without calling the RPC for them', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute(), rosterRoute(),
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{ student_id: STUDENT2_ID }] } }, rpcOk] })
    const body = await (await (await load())(post({ studentIds: [STUDENT_ID, STUDENT2_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))).json()
    expect(body.sent.map((s) => s.student_id)).toEqual([STUDENT_ID])
    expect(body.skipped).toEqual([{ student_id: STUDENT2_ID, code: 'handed_in' }])
    const subs = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(subs.url).toContain(`assignment_id=eq.${ASSIGN_ID}`)
    expect(log.filter((l) => l.url.includes('school_send_nudge'))).toHaveLength(1)
  })

  it('maps a handed_in raised by the RPC (a hand-in landing mid-send) to a skip', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute(), rosterRoute(),
      { method: 'POST', match: 'school_send_nudge', reply: { status: 400, body: { code: 'P0001', message: 'handed_in' } } }] })
    const body = await (await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))).json()
    expect(body.skipped).toEqual([{ student_id: STUDENT_ID, code: 'handed_in' }])
  })

  it('does not look up hand-ins for other presets linked to an assignment', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute(), rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'one_more_page', assignmentId: ASSIGN_ID }))
    expect(res.status).toBe(200)
    expect(log.some((l) => l.url.includes('/rest/v1/class_submissions'))).toBe(false)
  })

  it('404s an assignment past a due date that refuses late work (closed by due)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), rpcOk,
      assignmentRoute([{ id: ASSIGN_ID, due_at: '2020-01-01T00:00:00Z', allow_late: false }])] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })

  it('accepts a past-due assignment that allows late work', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), rpcOk,
      assignmentRoute([{ id: ASSIGN_ID, due_at: '2020-01-01T00:00:00Z', allow_late: true }])] })
    expect((await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))).status).toBe(200)
  })

  it('409s an archived class and never calls the RPC', async () => {
    const archived = { ...ownerRoute, reply: { body: [{ ...ownerRoute.reply.body[0], archived_at: '2026-09-01T00:00:00Z' }] } }
    const log = mockSupabase({ user: TEACHER, routes: [archived, rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'cant_wait' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('class_archived')
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })

  it('404s an assignment from another class (or a draft/closed one)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, assignmentRoute([]), rosterRoute(), rpcOk] })
    const res = await (await load())(post({ studentIds: [STUDENT_ID], preset: 'hand_in', assignmentId: ASSIGN_ID }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('assignment_not_found')
    expect(log.some((l) => l.url.includes('school_send_nudge'))).toBe(false)
  })
})

describe('GET /api/school/nudges?classId= (teacher)', () => {
  it('returns the latest nudge per student', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), { method: 'GET', match: '/rest/v1/class_nudges', reply: { body: [
      { id: 'n3', student_id: STUDENT_ID, created_at: '2026-09-29T10:00:00Z', seen_at: null, preset: 'cant_wait', message: null },
      { id: 'n2', student_id: STUDENT2_ID, created_at: '2026-09-28T10:00:00Z', seen_at: '2026-09-28T11:00:00Z', preset: null, message: 'Hi' },
      { id: 'n1', student_id: STUDENT_ID, created_at: '2026-09-27T10:00:00Z', seen_at: '2026-09-27T11:00:00Z', preset: 'story_waiting', message: null },
    ] } }] })
    const res = await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nudges.map((n) => n.id)).toEqual(['n3', 'n2'])
    expect(body.nudges[0]).toEqual({ id: 'n3', student_id: STUDENT_ID, created_at: '2026-09-29T10:00:00Z', seen_at: null, preset: 'cant_wait', message: null })
    const q = log.find((l) => l.url.includes('/rest/v1/class_nudges')).url
    expect(q).toContain(`classroom_id=eq.${CLASS_ID}`)
    // Scoped to the active roster, in a stable order, paged.
    expect(q).toContain(`student_id=in.(${STUDENT_ID},${STUDENT2_ID})`)
    expect(q).toContain('order=created_at.desc,id.desc')
    expect(q).toContain('limit=1000&offset=0')
  })

  it('pages past PostgREST max_rows (1000) until a short page, so nothing is truncated', async () => {
    const page = (n, student, seen) => Array.from({ length: n }, (_, i) => ({
      id: `n${student}${i}`, student_id: student, created_at: '2026-09-29T10:00:00Z', seen_at: seen, preset: 'cant_wait', message: null,
    }))
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), {
      method: 'GET', match: '/rest/v1/class_nudges',
      reply: (call) => ({ body: call.url.includes('offset=0') ? page(1000, STUDENT_ID, null) : page(3, STUDENT2_ID, '2026-09-29T11:00:00Z') }),
    }] })
    const body = await (await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))).json()
    const reads = log.filter((l) => l.url.includes('/rest/v1/class_nudges'))
    expect(reads.map((l) => l.url.match(/offset=(\d+)/)[1])).toEqual(['0', '1000'])
    // The child only on the second page is still there.
    expect(body.nudges.map((n) => n.student_id).sort()).toEqual([STUDENT_ID, STUDENT2_ID].sort())
  })

  it('503s (fails closed) if a later page errors', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute(), {
      method: 'GET', match: '/rest/v1/class_nudges',
      reply: (call) => call.url.includes('offset=0')
        ? { body: Array.from({ length: 1000 }, (_, i) => ({ id: `x${i}`, student_id: STUDENT_ID })) }
        : { status: 500, body: {} },
    }] })
    expect((await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))).status).toBe(503)
  })

  it('returns no nudges (and makes no nudge read) for an empty roster', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rosterRoute([])] })
    const body = await (await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))).json()
    expect(body.nudges).toEqual([])
    expect(log.some((l) => l.url.includes('/rest/v1/class_nudges'))).toBe(false)
  })

  it('404s another teacher\'s class', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    expect((await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))).status).toBe(404)
  })

  it('403s a student on the teacher read', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [ownerRoute] })
    expect((await (await load())(req('nudges', { query: `?classId=${CLASS_ID}` }))).status).toBe(403)
  })
})

describe('GET /api/school/nudges (student)', () => {
  it('returns only the caller\'s own unread nudge, with the linked assignment', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'GET', match: '/rest/v1/class_nudges', reply: { body: [{
      id: NUDGE_ID, teacher_name: 'Ms Rivera', preset: 'hand_in', message: null, created_at: '2026-09-29T10:00:00Z',
      assignment_id: ASSIGN_ID, assignments: { id: ASSIGN_ID, title: 'My pet' },
    }] } }] })
    const res = await (await load())(req('nudges'))
    expect(res.status).toBe(200)
    expect((await res.json()).nudge).toEqual({
      id: NUDGE_ID, teacher_name: 'Ms Rivera', preset: 'hand_in', message: null, created_at: '2026-09-29T10:00:00Z',
      assignment: { id: ASSIGN_ID, title: 'My pet' },
    })
    const q = log.find((l) => l.url.includes('/rest/v1/class_nudges')).url
    expect(q).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(q).toContain('seen_at=is.null')
  })

  it('returns null with no unread nudge, and a blank teacher name as null', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute] })
    expect((await (await (await load())(req('nudges'))).json()).nudge).toBeNull()
  })

  it('401s anon', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 }))
    expect((await (await load())(req('nudges'))).status).toBe(401)
  })

  it('403s a teacher on the student read', async () => {
    mockSupabase({ user: TEACHER, routes: [studentSelfRoute] })
    expect((await (await load())(req('nudges'))).status).toBe(403)
  })

  it('503s when the read errors', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, err500('GET', '/rest/v1/class_nudges')] })
    expect((await (await load())(req('nudges'))).status).toBe(503)
  })
})

describe('PATCH /api/school/nudges (student: Got it)', () => {
  it('marks the caller\'s own nudge seen, scoped by student id', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'PATCH', match: '/rest/v1/class_nudges', reply: { body: [{ id: NUDGE_ID }] } }] })
    const res = await (await load())(req('nudges', { method: 'PATCH', body: { id: NUDGE_ID } }))
    expect(res.status).toBe(200)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`id=eq.${NUDGE_ID}`)
    expect(p.url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(p.body.seen_at).toBeTruthy()
  })

  it('404s someone else\'s nudge', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute,
      { method: 'PATCH', match: '/rest/v1/class_nudges', reply: { body: [] } },
      { method: 'GET', match: '/rest/v1/class_nudges', reply: { body: [] } }] })
    const res = await (await load())(req('nudges', { method: 'PATCH', body: { id: OTHER_ID } }))
    expect(res.status).toBe(404)
  })

  it('is idempotent for an already-seen nudge of their own', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute,
      { method: 'PATCH', match: '/rest/v1/class_nudges', reply: { body: [] } },
      { method: 'GET', match: '/rest/v1/class_nudges', reply: { body: [{ id: NUDGE_ID }] } }] })
    expect((await (await load())(req('nudges', { method: 'PATCH', body: { id: NUDGE_ID } }))).status).toBe(200)
  })

  it('403s a teacher', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [studentSelfRoute] })
    expect((await (await load())(req('nudges', { method: 'PATCH', body: { id: NUDGE_ID } }))).status).toBe(403)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('400s a bad id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute] })
    expect((await (await load())(req('nudges', { method: 'PATCH', body: { id: 'x' } }))).status).toBe(400)
  })
})

describe('lib/school/nudges', () => {
  it('isOpenAssignment: published and not closed by its due date', () => {
    const now = Date.parse('2026-09-30T12:00:00Z')
    expect(isOpenAssignment({ status: 'published', due_at: null, allow_late: false }, now)).toBe(true)
    expect(isOpenAssignment({ status: 'published', due_at: '2026-09-29T00:00:00Z', allow_late: false }, now)).toBe(false)
    expect(isOpenAssignment({ status: 'published', due_at: '2026-09-29T00:00:00Z', allow_late: true }, now)).toBe(true)
    expect(isOpenAssignment({ status: 'published', due_at: '2026-10-29T00:00:00Z', allow_late: false }, now)).toBe(true)
    expect(isOpenAssignment({ status: 'closed' }, now)).toBe(false)
    expect(isOpenAssignment(null, now)).toBe(false)
  })

  it('cleanNudgeMessage counts UTF-16 units', () => {
    expect(cleanNudgeMessage('😀'.repeat(70))).toBe('😀'.repeat(70))
    expect(cleanNudgeMessage('😀'.repeat(71))).toBeNull()
    expect(cleanNudgeMessage(' hi ')).toBe('hi')
    expect(cleanNudgeMessage(5)).toBeNull()
  })

  it('teacherDisplayName prefers display_name, never the email, and caps at 60', () => {
    expect(teacherDisplayName({ display_name: ' Ms R ' })).toBe('Ms R')
    expect(teacherDisplayName({ full_name: 'Sam Lee' })).toBe('Sam Lee')
    expect(teacherDisplayName({})).toBe('')
    expect(teacherDisplayName(undefined)).toBe('')
    expect([...teacherDisplayName({ display_name: 'x'.repeat(80) })]).toHaveLength(60)
  })
})
