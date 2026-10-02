import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, STUDENT2_ID, ASSIGN_ID, ASSIGN2_ID, SUB_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, classroomRow, req, err500,
} from './school-mock.js'
import { cleanTips, csvCell, toCsv, csvFilename, TIP_KEYS, latestGrade } from '../lib/school/grading.js'

const GRADE_ID = '6f1c1b1e-0000-4000-8000-0000000000e1'
const SUB2_ID = '6f1c1b1e-0000-4000-8000-0000000000c2'
const T0 = '2026-09-27T12:00:00.000Z'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const load = async () => (await import('../api/school/grades.js')).default
const post = (body) => req('grades', { method: 'POST', body })
const rpcCalls = (log) => log.filter((l) => l.url.includes('/rpc/school_grade_submission'))

const gradeRow = (over = {}) => ({
  id: GRADE_ID, version: 1, level: 'growing', tips: [{ key: 'ideas.more_detail' }], returned: false,
  created_at: T0, updated_at: T0, seen_at: null, author_user_id: TEACHER.id, ...over,
})

describe('teacher POST /api/school/grades', () => {
  const rpcOk = {
    method: 'POST', match: '/rpc/school_grade_submission',
    reply: (call) => ({
      body: { grade: gradeRow({ level: call.body.p_level, tips: call.body.p_tips, returned: call.body.p_returned }) },
    }),
  }
  const base = { classId: CLASS_ID, submissionId: SUB_ID, version: 1, level: 'growing', tips: [{ key: 'ideas.more_detail' }] }

  it('grades through the locked RPC, scoped to the class, and returns the allowlisted grade', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post({ ...base, tips: [{ key: 'ideas.more_detail' }, { text: '  Add a dragon!  ' }], returned: true }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.grade).toEqual({
      id: GRADE_ID, version: 1, level: 'growing', tips: [{ key: 'ideas.more_detail' }, { text: 'Add a dragon!' }], returned: true,
      created_at: T0, updated_at: T0, seen_at: null,
    })
    expect(Object.keys(body)).toEqual(['grade'])
    expect(JSON.stringify(body)).not.toContain('author_user_id')
    const [call] = rpcCalls(log)
    expect(call.body).toEqual({
      p_classroom_id: CLASS_ID, p_submission_id: SUB_ID, p_version: 1, p_author_user_id: TEACHER.id,
      p_level: 'growing', p_tips: [{ key: 'ideas.more_detail' }, { text: 'Add a dragon!' }], p_returned: true,
    })
  })

  it('a level alone is enough (no tips, not returned)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, version: 2, level: 'wow' }))
    expect(res.status).toBe(201)
    expect(rpcCalls(log)[0].body).toEqual({
      p_classroom_id: CLASS_ID, p_submission_id: SUB_ID, p_version: 2, p_author_user_id: TEACHER.id, p_level: 'wow', p_tips: [], p_returned: false,
    })
  })

  it('stickers and comments are not part of a grade (they stay on /feedback): ignored, never sent', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post({ ...base, comment: 'Nice', sticker: 'star' }))
    expect(res.status).toBe(201)
    expect(Object.keys(rpcCalls(log)[0].body)).not.toContain('p_comment')
    expect(log.some((l) => l.url.includes('submission_feedback'))).toBe(false)
  })

  it.each([
    ['a malformed submissionId', { submissionId: 'nope' }],
    ['a missing version', { version: undefined }],
    ['version 0', { version: 0 }],
    ['a string version', { version: '1' }],
    ['an unknown level', { level: 'excellent' }],
    ['no level', { level: undefined }],
    ['tips that are not a list', { tips: 'ideas.why' }],
    ['four tips', { tips: [{ key: 'ideas.why' }, { key: 'ideas.senses' }, { key: 'order.ending' }, { key: 'words.said' }] }],
    ['an unknown tip key', { tips: [{ key: 'ideas.robot' }] }],
    ['a tip with key and text', { tips: [{ key: 'ideas.why', text: 'x' }] }],
    ['an empty custom tip', { tips: [{ text: '   ' }] }],
    ['a custom tip over 140 UTF-16 units', { tips: [{ text: 'x'.repeat(141) }] }],
    ['71 emoji (142 UTF-16 units)', { tips: [{ text: '🐉'.repeat(71) }] }],
    ['the same tip twice', { tips: [{ key: 'ideas.why' }, { key: 'ideas.why' }] }],
    ['a non-object tip', { tips: ['ideas.why'] }],
    ['returned that is not a boolean', { returned: 'yes' }],
    ['returned with no tips', { returned: true, tips: [] }],
  ])('400 bad_request for %s, without calling the RPC', async (_, fields) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post({ ...base, ...fields }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
    expect(rpcCalls(log)).toHaveLength(0)
  })

  it('accepts exactly 140 UTF-16 units (70 emoji) and three tips', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post({ ...base, tips: [{ text: '🐉'.repeat(70) }, { key: 'ideas.why' }, { key: 'spelling.capitals' }] }))
    expect(res.status).toBe(201)
  })

  it.each([
    ['version_changed', 409], ['cannot_return', 409], ['submission_not_found', 404],
  ])('maps the RPC\'s %s to %i', async (name, status) => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'POST', match: '/rpc/school_grade_submission', reply: { status: 400, body: { code: 'P0001', message: name } } }] })
    const res = await (await load())(post(base))
    expect(res.status).toBe(status)
    expect((await res.json()).code).toBe(name)
  })

  it('502 upstream for any other RPC failure', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('POST', '/rpc/school_grade_submission')] })
    const res = await (await load())(post(base))
    expect(res.status).toBe(502)
  })

  it('409 class_archived in an archived class, without calling the RPC', async () => {
    const archived = { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [{ ...classroomRow, archived_at: T0 }] } }
    const log = mockSupabase({ user: TEACHER, routes: [archived, rpcOk] })
    const res = await (await load())(post(base))
    expect(res.status).toBe(409)
    expect(rpcCalls(log)).toHaveLength(0)
  })

  it('404 for another teacher\'s class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, rpcOk] })
    const res = await (await load())(post(base))
    expect(res.status).toBe(404)
    expect(rpcCalls(log)).toHaveLength(0)
  })

  it('403 for a student on the teacher route', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [ownerRoute, rpcOk] })
    const res = await (await load())(post(base))
    expect(res.status).toBe(403)
    expect(rpcCalls(log)).toHaveLength(0)
  })

  it('401 without a session', async () => {
    globalThis.fetch = vi.fn(async (u) => new Response('{}', { status: String(u).endsWith('/auth/v1/user') ? 401 : 200 }))
    expect((await (await load())(post(base))).status).toBe(401)
  })
})

describe('student POST /api/school/grades {id} (mark seen)', () => {
  const lookup = (studentId = STUDENT_ID) => ({
    method: 'GET', match: '/rest/v1/submission_grades', reply: { body: [{ id: GRADE_ID, class_submissions: { student_id: studentId } }] },
  })
  const patchRoute = { method: 'PATCH', match: '/rest/v1/submission_grades', reply: { body: [] } }

  it('marks their own grade seen, keeping the first time', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, lookup(), patchRoute] })
    const res = await (await load())(post({ id: GRADE_ID }))
    expect(res.status).toBe(200)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`id=eq.${GRADE_ID}`)
    expect(p.url).toContain('seen_at=is.null')
    expect(p.body).toEqual({ seen_at: T0 })
  })

  it('404 for another child\'s grade, without writing', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, lookup(STUDENT2_ID), patchRoute] })
    const res = await (await load())(post({ id: GRADE_ID }))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('400 for a malformed id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute] })
    expect((await (await load())(post({ id: 'x' }))).status).toBe(400)
  })

  it('403 not_a_student for a teacher without classId', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(post({ id: GRADE_ID }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })
})

describe('teacher GET /api/school/grades', () => {
  const subs = [
    {
      id: SUB_ID, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, version: 2,
      class_students: { display_name: 'Ann' }, assignments: { title: 'My pet', created_at: '2026-09-01T00:00:00.000Z' },
      submission_grades: [
        gradeRow({ version: 1, level: 'growing', returned: true, updated_at: '2026-09-10T00:00:00.000Z' }),
        gradeRow({ id: 'g2', version: 2, level: 'got_it', updated_at: '2026-09-12T00:00:00.000Z' }),
      ],
    },
    {
      id: SUB2_ID, assignment_id: ASSIGN2_ID, student_id: STUDENT_ID, version: 1,
      class_students: { display_name: 'Ann' }, assignments: { title: 'Space', created_at: '2026-09-05T00:00:00.000Z' },
      submission_grades: [gradeRow({ id: 'g3', level: 'wow', updated_at: '2026-09-11T00:00:00.000Z' })],
    },
  ]
  const subsRoute = { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: subs } }

  it('?studentId: one child\'s levels over time, oldest first, scoped to class and child', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, subsRoute] })
    const res = await (await load())(req('grades', { query: `?classId=${CLASS_ID}&studentId=${STUDENT_ID}` }))
    expect(res.status).toBe(200)
    const { grades } = await res.json()
    expect(grades.map((g) => [g.assignment_title, g.version, g.level, g.returned])).toEqual([
      ['My pet', 1, 'growing', true], ['Space', 1, 'wow', false], ['My pet', 2, 'got_it', false],
    ])
    expect(grades[0]).toMatchObject({ submission_id: SUB_ID, assignment_id: ASSIGN_ID, current_version: 2 })
    expect(JSON.stringify(grades)).not.toContain('author_user_id')
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(s.url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(s.url).toContain('submission_grades(')
  })

  it('?classId alone: every graded version in the class, by child then assignment then version', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, subsRoute] })
    const res = await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(200)
    const { grades } = await res.json()
    expect(grades.map((g) => [g.display_name, g.assignment_title, g.version, g.level])).toEqual([
      ['Ann', 'My pet', 1, 'growing'], ['Ann', 'My pet', 2, 'got_it'], ['Ann', 'Space', 1, 'wow'],
    ])
    expect(Object.keys(grades[0]).sort()).toEqual([
      'assignment_created_at', 'assignment_id', 'assignment_title', 'display_name', 'graded_at', 'level', 'returned', 'student_id', 'version',
    ])
  })

  it('reads the class page by page in a fixed order, so >1000 hand-ins are never dropped', async () => {
    const row = (i) => ({
      id: `sub-${i}`, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, class_students: { display_name: 'Ann' },
      assignments: { title: 'My pet', created_at: T0 }, submission_grades: [{ version: 1, level: 'wow', returned: false, updated_at: T0 }],
    })
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, {
      method: 'GET', match: '/rest/v1/class_submissions',
      reply: (call) => ({ body: call.url.includes('offset=0') ? Array.from({ length: 1000 }, (_, i) => row(i)) : [row(1000)] }),
    }] })
    const res = await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(200)
    expect((await res.json()).grades).toHaveLength(1001)
    const pages = log.filter((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(pages).toHaveLength(2)
    expect(pages[0].url).toContain('order=id.asc&limit=1000&offset=0')
    expect(pages[1].url).toContain('order=id.asc&limit=1000&offset=1000')
  })

  it('a failed second page fails the whole read (503), never a short CSV', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, {
      method: 'GET', match: '/rest/v1/class_submissions',
      reply: (call) => (call.url.includes('offset=0')
        ? { body: Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}`, submission_grades: [] })) }
        : { status: 500, body: {} }),
    }] })
    expect((await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))).status).toBe(503)
  })

  it('400 for a malformed studentId', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, subsRoute] })
    expect((await (await load())(req('grades', { query: `?classId=${CLASS_ID}&studentId=x` }))).status).toBe(400)
  })

  it('403 for a student, 404 for another teacher\'s class', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [ownerRoute, subsRoute] })
    expect((await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))).status).toBe(403)
    vi.resetModules()
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    expect((await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))).status).toBe(404)
  })

  it('fails closed (503) when the read errors', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('GET', '/rest/v1/class_submissions')] })
    expect((await (await load())(req('grades', { query: `?classId=${CLASS_ID}` }))).status).toBe(503)
  })

  it('405 for DELETE', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute] })
    expect((await (await load())(req('grades', { method: 'DELETE' }))).status).toBe(405)
  })
})

describe('grades on the existing reads', () => {
  it('teacher review list: each row carries the newest level, its version and returned', async () => {
    mockSupabase({ user: TEACHER, routes: [
      ownerRoute,
      { method: 'GET', match: '/rest/v1/assignments', reply: { body: [{ id: ASSIGN_ID, title: 'My pet', status: 'published', due_at: null, allow_late: true }] } },
      { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [] } },
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
        id: SUB_ID, student_id: STUDENT_ID, version: 2, submitted_at: T0, returned_at: null, book_title: 'Moon',
        class_students: { display_name: 'Ann' }, submission_grades: [{ version: 1, level: 'growing' }],
      }] } },
      { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } },
    ] })
    const load2 = (await import('../api/school/submissions.js')).default
    const body = await (await load2(req('submissions', { query: `?classId=${CLASS_ID}&assignmentId=${ASSIGN_ID}` }))).json()
    expect(body.submissions[0]).toMatchObject({ version: 2, level: 'growing', graded_version: 1, returned: false })
  })

  it('teacher one hand-in: the grade history newest first, allowlisted', async () => {
    mockSupabase({ user: TEACHER, routes: [
      ownerRoute,
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
        id: SUB_ID, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, version: 2, submitted_at: T0, returned_at: T0,
        book_id: 'b', book_title: 'Moon', book_snapshot: {}, class_students: {}, assignments: {},
        submission_grades: [gradeRow({ version: 1 }), gradeRow({ id: 'g2', version: 2, level: 'wow' })],
      }] } },
      { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } },
    ] })
    const load2 = (await import('../api/school/submissions.js')).default
    const body = await (await load2(req('submissions', { query: `?classId=${CLASS_ID}&id=${SUB_ID}` }))).json()
    expect(body.submission.returned).toBe(true)
    expect(body.grades.map((g) => g.version)).toEqual([2, 1])
    expect(JSON.stringify(body)).not.toContain('author_user_id')
  })

  it('child: only the grade for the version they handed in last, and only their own hand-in', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [
      studentSelfRoute,
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
        id: SUB_ID, version: 2, returned_at: null, book_snapshot: {},
        submission_grades: [gradeRow({ version: 1, returned: true })],
      }] } },
      { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } },
    ] })
    const load2 = (await import('../api/school/submissions.js')).default
    const body = await (await load2(req('submissions', { query: `?id=${SUB_ID}` }))).json()
    expect(body.grade).toBeNull()
    expect(body.returned).toBe(false)
    expect(log.find((l) => l.url.includes('class_submissions')).url).toContain(`student_id=eq.${STUDENT_ID}`)
  })

  it('child: the current version\'s grade with its tips, and "sent back"', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [
      studentSelfRoute,
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
        id: SUB_ID, version: 1, returned_at: T0, book_snapshot: {},
        submission_grades: [gradeRow({ version: 1, returned: true, tips: [{ key: 'ideas.why' }, { text: 'More!' }] })],
      }] } },
      { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } },
    ] })
    const load2 = (await import('../api/school/submissions.js')).default
    const body = await (await load2(req('submissions', { query: `?id=${SUB_ID}` }))).json()
    expect(body.returned).toBe(true)
    expect(body.grade).toEqual({
      id: GRADE_ID, version: 1, level: 'growing', tips: [{ key: 'ideas.why' }, { text: 'More!' }], returned: true,
      created_at: T0, updated_at: T0, seen_at: null,
    })
  })

  it('child assignment list: level, grade_unseen and returned on my_submission only — no class totals', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [
      studentSelfRoute,
      { method: 'GET', match: '/rest/v1/assignments', reply: { body: [{ id: ASSIGN_ID, title: 't', prompt: 'p', due_at: null, status: 'published', allow_late: true, created_at: T0 }] } },
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
        id: SUB_ID, assignment_id: ASSIGN_ID, version: 1, submitted_at: T0, returned_at: T0,
        submission_grades: [{ id: GRADE_ID, version: 1, level: 'growing', seen_at: null }],
      }] } },
      { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } },
    ] })
    const load2 = (await import('../api/school/assignments.js')).default
    const body = await (await load2(req('assignments'))).json()
    expect(body.assignments[0].my_submission).toMatchObject({ level: 'growing', grade_unseen: true, returned: true })
    // `class` carries only the settings the child's app follows (§7.28).
    expect(Object.keys(body)).toEqual(['class', 'assignments'])
    expect(body.class).toEqual({ checkins_enabled: true })
    expect(Object.keys(body.assignments[0])).not.toContain('counts')
  })
})

describe('lib/school/grading', () => {
  it('cleanTips normalises and dedupes', () => {
    expect(cleanTips(undefined)).toEqual({ ok: true, tips: [] })
    expect(cleanTips([{ text: '  hi ' }, { key: 'ideas.why' }])).toEqual({ ok: true, tips: [{ text: 'hi' }, { key: 'ideas.why' }] })
    expect(cleanTips([{ text: 'hi' }, { text: ' hi' }]).ok).toBe(false)
    expect(cleanTips([{ key: '__proto__' }]).ok).toBe(false)
    expect(cleanTips([{ text: 'Add a\r\ndragon\nnow' }])).toEqual({ ok: true, tips: [{ text: 'Add a dragon now' }] })
  })

  it('the library is 4 skills of 6-8 tips, every key unique', () => {
    expect(new Set(TIP_KEYS).size).toBe(TIP_KEYS.length)
    for (const skill of ['ideas', 'order', 'words', 'spelling']) {
      const n = TIP_KEYS.filter((k) => k.startsWith(`${skill}.`)).length
      expect(n).toBeGreaterThanOrEqual(6)
      expect(n).toBeLessThanOrEqual(8)
    }
  })

  it('latestGrade picks the highest version', () => {
    expect(latestGrade([])).toBeNull()
    expect(latestGrade([{ version: 1 }, { version: 3 }, { version: 2 }])).toEqual({ version: 3 })
  })

  it.each([
    ['=SUM(A1:A2)', `"'=SUM(A1:A2)"`],
    ['+1', `"'+1"`],
    ['-2+3', `"'-2+3"`],
    ['@cmd', `"'@cmd"`],
    ['\tTab', `"'\tTab"`],
    ['\nline', `"'\nline"`],
    ['\rret', `"'\rret"`],
    ['  =1+1', `"'  =1+1"`],
    [' \t@x', `"' \t@x"`],
    ['a=b', '"a=b"'],
    ['Ann -2', '"Ann -2"'],
    ['She said "hi"', '"She said ""hi"""'],
    ['Zoë, 7', '"Zoë, 7"'],
    [null, '""'],
    [2, '"2"'],
  ])('csvCell(%j) is %s', (v, out) => {
    expect(csvCell(v)).toBe(out)
  })

  it('toCsv: BOM, CRLF, every cell escaped', () => {
    expect(toCsv([['Student', 'Level'], ['=Ann', 'Wow!']])).toBe('﻿"Student","Level"\r\n"\'=Ann","Wow!"\r\n')
  })

  it('csvFilename is always a safe, non-empty file name', () => {
    const d = new Date('2026-10-01T09:00:00.000Z')
    expect(csvFilename('Room 5 — Ms. Rossi', d)).toBe('grades-Room-5-Ms-Rossi-2026-10-01.csv')
    expect(csvFilename('../../etc/passwd', d)).toBe('grades-etc-passwd-2026-10-01.csv')
    expect(csvFilename('Classe 3ª Società', d)).toBe('grades-Classe-3a-Societa-2026-10-01.csv')
    expect(csvFilename('🦊🦊', d)).toBe('grades-class-2026-10-01.csv')
    expect(csvFilename(null, d)).toBe('grades-class-2026-10-01.csv')
  })
})
