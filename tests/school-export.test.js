// GET /api/school/export (review §7.4): teacher-only, own class, ZIP of
// JSON/CSV/HTML, rate-limited.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { setEnv, mockSupabase, ownerRoute, notOwnerRoute, TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, ASSIGN_ID } from './school-mock.js'
import { toCsv, safeName, buildExportZip } from '../lib/school/export.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const call = (query) => new Request(`https://app.test/api/school/export${query}`, { headers: { authorization: 'Bearer jwt' } })
const handler = async () => (await import('../api/school/export.js')).GET

const routes = [
  ownerRoute,
  { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [
    { id: STUDENT_ID, display_name: 'Ann', avatar_emoji: '🦊', status: 'active', created_at: '2026-09-01T00:00:00Z', auth_user_id: 'kid-auth-1' },
  ] } },
  { method: 'GET', match: '/rest/v1/assignments?', reply: { body: [{ id: ASSIGN_ID, title: 'My summer', prompt: 'Write', status: 'published' }] } },
  { method: 'GET', match: '/rest/v1/class_submissions?', reply: { body: [{
    id: 's1', student_id: STUDENT_ID, assignment_id: ASSIGN_ID, book_title: 'Summer', version: 2, submitted_at: '2026-09-10T00:00:00Z',
    book_snapshot: { title: 'Summer', pages: [{ text: 'Hi' }] },
    submission_feedback: [{ comment: 'Lovely', sticker: 'star', created_at: '2026-09-11T00:00:00Z' }],
    submission_grades: [{ version: 2, level: 'got_it', tips: [], returned: true, created_at: '2026-09-11T00:00:00Z' }],
  }] } },
  { method: 'GET', match: '/rest/v1/class_checkins?', reply: { body: [{ id: 'c1', student_id: STUDENT_ID, feeling: 'happy', need: null, created_at: '2026-09-20T00:00:00Z' }] } },
  { method: 'GET', match: '/rest/v1/user_books?', reply: { body: [{ id: 1, user_id: 'kid-auth-1', book_id: 'b1', title: 'Dragons', book_data: { title: 'Dragons' } }] } },
]

describe('lib/school/export', () => {
  it('escapes CSV and neutralises spreadsheet formulas', () => {
    expect(toCsv(['a', 'b'], [{ a: '=SUM(1)', b: 'x,"y"' }])).toBe(`a,b\r\n'=SUM(1),"x,""y"""\r\n`)
  })
  it('makes safe folder names', () => {
    expect(safeName('Lucía / ../x', 'abcdef123456')).toBe('Lucía  x-abcdef12')
  })
  it('builds a zip with a README', () => {
    const z = unzipSync(buildExportZip({ classroom: { name: 'Room 5', locale: 'it' }, students: [] }))
    expect(strFromU8(z['Room 5/README.txt'])).toContain('esportazione')
  })
})

describe('GET /api/school/export', () => {
  it('returns a ZIP of the class: books, hand-ins, grades, check-ins, writing year', async () => {
    const log = mockSupabase({ user: TEACHER, routes })
    const res = await (await handler())(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const names = Object.keys(files)
    const dir = `Room 5/Ann-${STUDENT_ID.slice(0, 8)}`
    expect(names).toEqual(expect.arrayContaining([
      'Room 5/README.txt', 'Room 5/class.json', 'Room 5/assignments.json',
      `${dir}/profile.json`, `${dir}/hand-ins.json`, `${dir}/grades.csv`, `${dir}/check-ins.csv`,
      `${dir}/writing-year.json`, `${dir}/writing-year.html`,
    ]))
    expect(names.some((n) => n.startsWith(`${dir}/books/`))).toBe(true)
    const handIns = JSON.parse(strFromU8(files[`${dir}/hand-ins.json`]))
    expect(handIns[0]).toMatchObject({ assignment_title: 'My summer', version: 2, feedback: [{ comment: 'Lovely' }] })
    expect(strFromU8(files[`${dir}/grades.csv`])).toContain('My summer,Summer,2,got_it,yes')
    expect(strFromU8(files[`${dir}/check-ins.csv`])).toContain('happy')
    // Never the auth id or the picture hash.
    const profile = strFromU8(files[`${dir}/profile.json`])
    expect(profile).not.toContain('kid-auth-1')
    expect(profile).not.toContain('secret')
    // user_books read only for THIS class's students.
    const ub = log.find((l) => l.url.includes('/rest/v1/user_books?'))
    expect(decodeURIComponent(ub.url)).toContain('user_id=in.(kid-auth-1)')
  })

  it('one child: scoped by class AND student', async () => {
    const log = mockSupabase({ user: TEACHER, routes })
    const res = await (await handler())(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(200)
    const q = log.find((l) => l.url.includes('/rest/v1/class_students?classroom_id=eq.'))
    expect(q.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(q.url).toContain(`id=eq.${STUDENT_ID}`)
  })

  it("someone else's class is a 404 with no data read", async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, ...routes.slice(1)] })
    const res = await (await handler())(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(404)
    expect(log.some((l) => l.url.includes('class_submissions'))).toBe(false)
  })

  it('students cannot export', async () => {
    mockSupabase({ user: STUDENT_USER, routes })
    expect((await (await handler())(call(`?classId=${CLASS_ID}`))).status).toBe(403)
  })

  it('a bad student id is a 404', async () => {
    mockSupabase({ user: TEACHER, routes })
    expect((await (await handler())(call(`?classId=${CLASS_ID}&studentId=nope`))).status).toBe(404)
  })

  it('fails closed (503) when a read fails', async () => {
    mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/class_submissions?', reply: { status: 500, body: {} } }, ...routes] })
    expect((await (await handler())(call(`?classId=${CLASS_ID}`))).status).toBe(503)
  })
})
