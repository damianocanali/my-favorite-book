import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, STUDENT2_ID, ASSIGN_ID, ASSIGN2_ID, SUB_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, req, err500,
} from './school-mock.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const load = async () => (await import('../api/school/assignments.js')).default

const assignmentRow = (over = {}) => ({
  id: ASSIGN_ID, classroom_id: CLASS_ID, title: 'My pet', prompt: 'Write about a pet.', due_at: '2026-09-30T00:00:00.000Z',
  status: 'published', allow_late: true, created_at: '2026-09-20T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z', ...over,
})

describe('teacher GET /api/school/assignments?classId=', () => {
  const routes = (over = {}) => [
    ownerRoute,
    over.assignments ?? { method: 'GET', match: '/rest/v1/assignments', reply: { body: [assignmentRow(), assignmentRow({ id: ASSIGN2_ID, status: 'draft', title: 'Draft' })] } },
    over.students ?? { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [{ id: STUDENT_ID }, { id: STUDENT2_ID }] } },
    over.subs ?? { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{ assignment_id: ASSIGN_ID, student_id: STUDENT_ID }] } },
  ]

  it('returns every assignment (drafts too) with handed_in / total_students counts', async () => {
    const log = mockSupabase({ user: TEACHER, routes: routes() })
    const res = await (await load())(req('assignments', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(2)
    expect(body.assignments[0]).toEqual({
      id: ASSIGN_ID, title: 'My pet', prompt: 'Write about a pet.', due_at: '2026-09-30T00:00:00.000Z',
      status: 'published', allow_late: true, created_at: '2026-09-20T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z',
      counts: { handed_in: 1, total_students: 2 },
    })
    expect(body.assignments[1].counts).toEqual({ handed_in: 0, total_students: 2 })
    const a = log.find((l) => l.url.includes('/rest/v1/assignments'))
    expect(a.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(a.url).toContain('order=created_at.desc')
    // One query each — no per-assignment N+1.
    expect(log.filter((l) => l.url.includes('/rest/v1/class_submissions'))).toHaveLength(1)
  })

  it('only counts hand-ins from students still active in the class', async () => {
    mockSupabase({ user: TEACHER, routes: routes({
      subs: { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [
        { assignment_id: ASSIGN_ID, student_id: STUDENT_ID },
        { assignment_id: ASSIGN_ID, student_id: 'removed-student' },
      ] } },
    }) })
    const body = await (await (await load())(req('assignments', { query: `?classId=${CLASS_ID}` }))).json()
    expect(body.assignments[0].counts).toEqual({ handed_in: 1, total_students: 2 })
  })

  it('404s for another teacher\'s class', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    const res = await (await load())(req('assignments', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
  })

  it('403s a student on the teacher route', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes() })
    const res = await (await load())(req('assignments', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('student_forbidden')
  })

  it.each([['assignments', '/rest/v1/assignments'], ['students', '/rest/v1/class_students?classroom_id=eq.'], ['subs', '/rest/v1/class_submissions']])(
    'fails closed (503) when the %s read errors', async (key, match) => {
      mockSupabase({ user: TEACHER, routes: routes({ [key]: err500('GET', match) }) })
      const res = await (await load())(req('assignments', { query: `?classId=${CLASS_ID}` }))
      expect(res.status).toBe(503)
      expect((await res.json()).code).toBe('upstream')
    })
})

describe('teacher POST /api/school/assignments', () => {
  const insertRoute = { method: 'POST', match: '/rest/v1/assignments', reply: (call) => ({ body: [assignmentRow({ ...call.body, id: ASSIGN_ID })] }) }

  it('creates a draft by default, trimming title and prompt', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insertRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: '  My pet ', prompt: ' Write. ' } }))
    expect(res.status).toBe(201)
    const ins = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))
    expect(ins.body).toEqual({ classroom_id: CLASS_ID, title: 'My pet', prompt: 'Write.', due_at: null, allow_late: true, status: 'draft' })
    const body = await res.json()
    expect(body.assignment).toMatchObject({ id: ASSIGN_ID, title: 'My pet', status: 'draft' })
    expect(body.assignment).not.toHaveProperty('classroom_id')
  })

  it('accepts published, a due date (normalised to ISO) and allow_late=false', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insertRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: {
      classId: CLASS_ID, title: 'T', prompt: 'P', status: 'published', due_at: '2026-10-01T15:00:00-04:00', allow_late: false,
    } }))
    expect(res.status).toBe(201)
    const ins = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))
    expect(ins.body).toMatchObject({ status: 'published', due_at: '2026-10-01T19:00:00.000Z', allow_late: false })
  })

  it.each([
    ['empty title', { title: '   ', prompt: 'P' }],
    ['title over 80', { title: 'x'.repeat(81), prompt: 'P' }],
    ['missing prompt', { title: 'T' }],
    ['prompt over 1000', { title: 'T', prompt: 'x'.repeat(1001) }],
    ['unparseable due_at', { title: 'T', prompt: 'P', due_at: 'next tuesday' }],
    ['non-string due_at', { title: 'T', prompt: 'P', due_at: 12345 }],
    ['status closed on create', { title: 'T', prompt: 'P', status: 'closed' }],
    ['non-boolean allow_late', { title: 'T', prompt: 'P', allow_late: 'yes' }],
  ])('400 bad_request for %s', async (_, fields) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insertRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, ...fields } }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))).toBe(false)
  })

  it('404s another teacher\'s class without inserting', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, insertRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'P' } }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.method === 'POST')).toBe(false)
  })

  it('403s a student', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [ownerRoute, insertRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'P' } }))
    expect(res.status).toBe(403)
  })

  it('502 when the insert fails', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('POST', '/rest/v1/assignments')] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'P' } }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
  })
})

describe('teacher PATCH /api/school/assignments', () => {
  const lookup = (status) => ({ method: 'GET', match: '/rest/v1/assignments?id=eq.', reply: { body: [{ id: ASSIGN_ID, status }] } })
  const patchRoute = { method: 'PATCH', match: '/rest/v1/assignments', reply: (call) => ({ body: [assignmentRow(call.body)] }) }

  it.each([
    ['draft', 'published'], ['published', 'closed'], ['closed', 'published'], ['published', 'published'],
  ])('allows %s -> %s', async (from, to) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup(from), patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, status: to } }))
    expect(res.status).toBe(200)
    expect((await res.json()).assignment.status).toBe(to)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`id=eq.${ASSIGN_ID}`)
    expect(p.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(p.body.updated_at).toBe('2026-09-27T12:00:00.000Z')
  })

  it.each([['draft', 'closed'], ['published', 'draft'], ['closed', 'draft']])('409 invalid_transition for %s -> %s', async (from, to) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup(from), patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, status: to } }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('invalid_transition')
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('a status change is conditional on the status it was checked against', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup('published'), patchRoute] })
    await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, status: 'closed' } }))
    expect(log.find((l) => l.method === 'PATCH').url).toContain('status=eq.published')
  })

  it('409 invalid_transition when the status changed underneath (conditional PATCH matched nothing)', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup('published'), { method: 'PATCH', match: '/rest/v1/assignments', reply: { body: [] } }] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, status: 'closed' } }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('invalid_transition')
  })

  it('an edit without a status change is not status-conditional', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup('published'), patchRoute] })
    await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, title: 'x' } }))
    expect(log.find((l) => l.method === 'PATCH').url).not.toContain('status=eq.')
  })

  it('edits title/prompt/due_at/allow_late, and due_at: null clears it', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup('draft'), patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: {
      classId: CLASS_ID, id: ASSIGN_ID, title: ' New ', prompt: 'New prompt', due_at: null, allow_late: false,
    } }))
    expect(res.status).toBe(200)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.body).toEqual({ title: 'New', prompt: 'New prompt', due_at: null, allow_late: false, updated_at: '2026-09-27T12:00:00.000Z' })
  })

  it('404 assignment_not_found for an id outside this class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/assignments?id=eq.', reply: { body: [] } }, patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, title: 'x' } }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('assignment_not_found')
    expect(log.find((l) => l.url.includes('/rest/v1/assignments?id=eq.')).url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it.each([
    ['bad id', { id: 'nope', title: 'x' }],
    ['empty title', { id: ASSIGN_ID, title: '' }],
    ['bad status', { id: ASSIGN_ID, status: 'archived' }],
    ['bad due_at', { id: ASSIGN_ID, due_at: 'soon' }],
    ['no fields', { id: ASSIGN_ID }],
  ])('400 for %s', async (_, fields) => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, lookup('draft'), patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, ...fields } }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('fails closed (503) when the lookup errors', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('GET', '/rest/v1/assignments?id=eq.'), patchRoute] })
    const res = await (await load())(req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, title: 'x' } }))
    expect(res.status).toBe(503)
  })
})

describe('teacher DELETE /api/school/assignments?classId=&id=', () => {
  const rpc = (reply) => ({ method: 'POST', match: '/rest/v1/rpc/school_delete_assignment', reply })
  const pgErr = (message) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } })
  const q = `?classId=${CLASS_ID}&id=${ASSIGN_ID}`

  it('deletes through the locking RPC, scoped to the class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpc({ body: null })] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: q }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const call = log.find((l) => l.url.includes('school_delete_assignment'))
    expect(call.body).toEqual({ p_classroom_id: CLASS_ID, p_assignment_id: ASSIGN_ID })
    // No direct table delete: the has-submissions check and the delete are one locked transaction.
    expect(log.some((l) => l.method === 'DELETE')).toBe(false)
  })

  it('409 has_submissions when the RPC refuses', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpc(pgErr('has_submissions'))] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: q }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('has_submissions')
  })

  it('404 assignment_not_found when the RPC finds nothing in this class', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpc(pgErr('assignment_not_found'))] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: q }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('assignment_not_found')
  })

  it('503 upstream for any other RPC failure', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpc({ status: 500, body: {} })] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: q }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
  })

  it('400 for a malformed id, without calling the RPC', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpc({ body: null })] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: `?classId=${CLASS_ID}&id=nope` }))
    expect(res.status).toBe(400)
    expect(log.some((l) => l.url.includes('rpc/'))).toBe(false)
  })

  it('404 for another teacher\'s class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, rpc({ body: null })] })
    const res = await (await load())(req('assignments', { method: 'DELETE', query: q }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.url.includes('rpc/'))).toBe(false)
  })
})

describe('student GET /api/school/assignments', () => {
  const studentRoutes = (over = {}) => [
    studentSelfRoute,
    over.assignments ?? { method: 'GET', match: '/rest/v1/assignments', reply: { body: [
      assignmentRow({ id: ASSIGN2_ID, status: 'closed', due_at: '2026-09-25T00:00:00.000Z', created_at: '2026-09-21T00:00:00.000Z' }),
      assignmentRow(),
    ] } },
    over.subs ?? { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [
      { id: SUB_ID, assignment_id: ASSIGN2_ID, version: 2, submitted_at: '2026-09-26T00:00:00.000Z' },
    ] } },
    over.feedback ?? { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [{ submission_id: SUB_ID }, { submission_id: SUB_ID }] } },
  ]

  it('lists own class\'s published+closed assignments newest first with my_submission', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: studentRoutes() })
    const res = await (await load())(req('assignments'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const a = log.find((l) => l.url.includes('/rest/v1/assignments'))
    expect(a.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(a.url).toContain('status=in.(published,closed)')
    expect(a.url).toContain('order=created_at.desc')
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`student_id=eq.${STUDENT_ID}`)
    const f = log.find((l) => l.url.includes('/rest/v1/submission_feedback'))
    expect(f.url).toContain(`submission_id=in.(${SUB_ID})`)
    expect(f.url).toContain('seen_at=is.null')

    expect(body.assignments[0]).toEqual({
      id: ASSIGN2_ID, title: 'My pet', prompt: 'Write about a pet.', due_at: '2026-09-25T00:00:00.000Z',
      status: 'closed', allow_late: true, created_at: '2026-09-21T00:00:00.000Z', past_due: true,
      my_submission: {
        id: SUB_ID, version: 2, submitted_at: '2026-09-26T00:00:00.000Z', late: true, feedback_unseen: 2,
        level: null, grade_unseen: false, returned: false,
      },
    })
    expect(body.assignments[1]).toMatchObject({ id: ASSIGN_ID, past_due: false, my_submission: null })
  })

  it('makes no feedback query when nothing has been handed in', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: studentRoutes({ subs: { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } } }) })
    const res = await (await load())(req('assignments'))
    expect(res.status).toBe(200)
    expect(log.some((l) => l.url.includes('submission_feedback'))).toBe(false)
  })

  it('403s a teacher on the student route', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(req('assignments'))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it.each([['assignments', '/rest/v1/assignments'], ['subs', '/rest/v1/class_submissions'], ['feedback', '/rest/v1/submission_feedback']])(
    'fails closed (503) when the %s read errors', async (key, match) => {
      mockSupabase({ user: STUDENT_USER, routes: studentRoutes({ [key]: err500('GET', match) }) })
      const res = await (await load())(req('assignments'))
      expect(res.status).toBe(503)
    })

  it('rejects student writes', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [ownerRoute] })
    const res = await (await load())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'P' } }))
    expect(res.status).toBe(403)
  })

  it('never returns auth_user_id or classroom_id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: studentRoutes() })
    const text = JSON.stringify(await (await (await load())(req('assignments'))).json())
    expect(text).not.toContain('auth_user_id')
    expect(text).not.toContain(STUDENT_USER.id)
    expect(text).not.toContain('classroom_id')
  })
})
