// api/cron/teacher-summary.js: once a day (Vercel Hobby), one email per
// teacher with activity since their last summary; weekly teachers on Fridays.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const T1 = '6f1c1b1e-0000-4000-8000-000000000091'
const T2 = '6f1c1b1e-0000-4000-8000-000000000092'
const C1 = '6f1c1b1e-0000-4000-8000-000000000001'
const C2 = '6f1c1b1e-0000-4000-8000-000000000002'
const A1 = '6f1c1b1e-0000-4000-8000-0000000000b1'
const SUNDAY = '2026-09-27T22:00:00.000Z'
const FRIDAY = '2026-09-25T22:00:00.000Z'
const FEELINGS = ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.CRON_SECRET = 'cron-secret'
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
  vi.useFakeTimers()
  vi.setSystemTime(new Date(SUNDAY))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.CRON_SECRET
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  vi.restoreAllMocks()
})

const run = async (auth = 'Bearer cron-secret') =>
  (await import('../api/cron/teacher-summary.js')).default(
    new Request('https://mybooklab.app/api/cron/teacher-summary', { headers: auth ? { authorization: auth } : {} })
  )

const ev = (teacher, classroom, kind, at = '2026-09-27T15:00:00.000Z') => ({ teacher_user_id: teacher, classroom_id: classroom, kind, created_at: at })

function mock({ classes, settings = [], events = [], assignments = [], students = [], submissions = [], resendStatus = 200 }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = decodeURIComponent(String(url)), method = init.method || 'GET'
    const entry = { method, url: u, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }
    log.push(entry)
    const inIds = (col) => (u.match(new RegExp(`${col}=in\\.\\(([^)]*)\\)`))?.[1] ?? '').split(',')
    if (u.includes('/rest/v1/classrooms')) {
      const offset = Number(u.match(/offset=(\d+)/)?.[1] ?? 0)
      return new Response(JSON.stringify(classes.slice(offset, offset + 1000)))
    }
    if (u.includes('/rest/v1/teacher_settings') && method === 'GET') {
      return new Response(JSON.stringify(settings.filter((s) => inIds('user_id').includes(s.user_id))))
    }
    if (u.includes('/rest/v1/teacher_settings') && method === 'POST') return new Response('[]', { status: 201 })
    if (u.includes('/rest/v1/teacher_notifications')) {
      return new Response(JSON.stringify(events.filter((e) => inIds('teacher_user_id').includes(e.teacher_user_id))))
    }
    if (u.includes('/rest/v1/assignments')) return new Response(JSON.stringify(assignments))
    if (u.includes('/rest/v1/class_students')) return new Response(JSON.stringify(students))
    if (u.includes('/rest/v1/class_submissions')) return new Response(JSON.stringify(submissions))
    const admin = u.match(/\/auth\/v1\/admin\/users\/(.+)$/)
    if (admin) return new Response(JSON.stringify({ id: admin[1], email: `${admin[1].slice(-2)}@school.test` }))
    if (u.includes('api.resend.com')) return new Response('{"id":"e"}', { status: resendStatus })
    return new Response('[]')
  })
  return log
}
// Summaries go through Resend's batch endpoint (≤100 per call): one entry
// per email, each carrying the batch call's headers.
const batches = (log) => log.filter((l) => l.url.includes('api.resend.com'))
const emails = (log) => batches(log).flatMap((b) => b.body.map((body) => ({ body, headers: b.headers, url: b.url })))
const stamps = (log) => log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/teacher_settings'))

describe('cron auth', () => {
  it.each([[null], ['Bearer wrong'], ['cron-secret']])('401 for authorization=%s', async (auth) => {
    mock({ classes: [] })
    expect((await run(auth)).status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('401 when CRON_SECRET is not set at all', async () => {
    delete process.env.CRON_SECRET
    mock({ classes: [] })
    expect((await run('Bearer undefined')).status).toBe(401)
  })

  it('is scheduled once a day at 22:00 UTC in vercel.json (Hobby: at most daily)', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(v.crons).toContainEqual({ path: '/api/cron/teacher-summary', schedule: '0 22 * * *' })
  })
})

describe('daily summary', () => {
  const classes = [{ id: C1, name: 'Room 5', owner_user_id: T1, locale: 'en' }]

  it('emails a teacher with activity: hand-ins, late, not handed in on the open assignment, help asks, link, disclaimer', async () => {
    const log = mock({
      classes,
      events: [ev(T1, C1, 'hand_in'), ev(T1, C1, 'hand_in'), ev(T1, C1, 'hand_in_late'), ev(T1, C1, 'help_grownup'), ev(T1, C1, 'help_book')],
      assignments: [{ id: A1, classroom_id: C1, title: 'My pet', created_at: '2026-09-20T00:00:00Z' }],
      students: [{ id: 's1', classroom_id: C1 }, { id: 's2', classroom_id: C1 }, { id: 's3', classroom_id: C1 }, { id: 's4', classroom_id: C1 }],
      submissions: [{ assignment_id: A1, student_id: 's1' }, { assignment_id: A1, student_id: 's2' }, { assignment_id: A1, student_id: 's3' }],
    })
    const res = await run()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ considered: 1, sent: 1, skipped: 0, failed: 0 })
    const [mail] = emails(log)
    expect(mail.body.to).toEqual([`91@school.test`])
    expect(mail.url).toBe('https://api.resend.com/emails/batch')
    expect(mail.headers['Idempotency-Key']).toMatch(/^teacher-summary:2026-09-27:[0-9a-f]{16}$/)
    expect(mail.body.text).toContain('Room 5')
    expect(mail.body.text).toContain('3 hand-ins (1 late)')
    expect(mail.body.text).toContain('1 not handed in yet for "My pet"')
    expect(mail.body.text).toContain('2 help asks')
    expect(mail.body.text).toContain('https://mybooklab.app/teacher')
    expect(mail.body.text).toContain('It is not monitored and is not an emergency service.')
    const all = JSON.stringify(mail.body).toLowerCase()
    for (const f of FEELINGS) expect(all).not.toContain(f)
    // Stamped so tomorrow counts from now.
    expect(stamps(log)[0].url).toContain('on_conflict=user_id')
    expect(stamps(log)[0].body).toEqual([{ user_id: T1, last_summary_at: SUNDAY }])
  })

  it('counts only activity since last_summary_at', async () => {
    const log = mock({
      classes,
      settings: [{ user_id: T1, summary: 'daily', last_summary_at: '2026-09-27T12:00:00.000Z' }],
      events: [ev(T1, C1, 'hand_in', '2026-09-27T11:00:00.000Z'), ev(T1, C1, 'hand_in', '2026-09-27T13:00:00.000Z')],
    })
    await run()
    const n = log.find((l) => l.url.includes('/rest/v1/teacher_notifications'))
    expect(n.url).toContain('created_at=gt.2026-09-27T12:00:00.000Z')
    expect(emails(log)[0].body.text).toContain('1 hand-in')
  })

  it('skips a teacher with no activity (no email, no stamp)', async () => {
    const log = mock({ classes, events: [] })
    expect(await (await run()).json()).toEqual({ considered: 1, sent: 0, skipped: 1, failed: 0 })
    expect(emails(log)).toHaveLength(0)
    expect(stamps(log)).toHaveLength(0)
  })

  it('reads only non-archived classes and ignores events from any other class', async () => {
    const log = mock({ classes, events: [ev(T1, C2, 'hand_in')] })
    await run()
    expect(log.find((l) => l.url.includes('/rest/v1/classrooms')).url).toContain('archived_at=is.null')
    expect(emails(log)).toHaveLength(0)
  })

  it('off → never; weekly → only on Fridays, counting the week', async () => {
    const settings = [{ user_id: T1, summary: 'off' }, { user_id: T2, summary: 'weekly' }]
    const two = [...classes, { id: C2, name: 'Room 6', owner_user_id: T2, locale: 'en' }]
    const events = [ev(T1, C1, 'hand_in'), ev(T2, C2, 'hand_in')]
    let log = mock({ classes: two, settings, events })
    await run()
    expect(emails(log)).toHaveLength(0)

    vi.resetModules()
    vi.setSystemTime(new Date(FRIDAY))
    log = mock({ classes: two, settings, events: [ev(T2, C2, 'hand_in', '2026-09-22T10:00:00.000Z')] })
    await run()
    expect(emails(log).map((e) => e.body.to[0])).toEqual(['92@school.test'])
    expect(emails(log)[0].body.subject).toMatch(/week/i)
    expect(log.find((l) => l.url.includes('/rest/v1/teacher_notifications')).url).toContain('created_at=gt.2026-09-18T22:00:00.000Z')
  })

  it('writes Italian for an Italian class', async () => {
    const log = mock({ classes: [{ id: C1, name: 'Terza B', owner_user_id: T1, locale: 'it' }], events: [ev(T1, C1, 'hand_in')] })
    await run()
    expect(emails(log)[0].body.text).toContain('Non è monitorato')
  })

  it('does not stamp when the email fails, and counts it as failed', async () => {
    const log = mock({ classes, events: [ev(T1, C1, 'hand_in')], resendStatus: 500 })
    expect(await (await run()).json()).toMatchObject({ sent: 0, failed: 1 })
    expect(stamps(log)).toHaveLength(0)
  })

  it('batches: 120 teachers → settings and events read in chunks of at most 50 ids', async () => {
    const many = Array.from({ length: 120 }, (_, i) => {
      const tid = `6f1c1b1e-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`
      return { id: `6f1c1b1e-0000-4000-9000-${String(1000 + i).padStart(12, '0')}`, name: `R${i}`, owner_user_id: tid, locale: 'en' }
    })
    const log = mock({ classes: many, events: many.slice(0, 3).map((c) => ev(c.owner_user_id, c.id, 'hand_in')) })
    const body = await (await run()).json()
    expect(body).toEqual({ considered: 120, sent: 3, skipped: 117, failed: 0 })
    expect(batches(log)).toHaveLength(1) // only the first chunk had activity
    const settingsReads = log.filter((l) => l.method === 'GET' && l.url.includes('/rest/v1/teacher_settings'))
    expect(settingsReads).toHaveLength(3)
    for (const r of settingsReads) expect(r.url.match(/user_id=in\.\(([^)]*)\)/)[1].split(',').length).toBeLessThanOrEqual(50)
  })

  it('pages through more than 1000 classes', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ id: `c${i}`, name: 'R', owner_user_id: T1, locale: 'en' }))
    const log = mock({ classes: many })
    await run()
    expect(log.filter((l) => l.url.includes('/rest/v1/classrooms'))).toHaveLength(2)
  })

  it('502 when the class list cannot be read', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 500 }))
    expect((await run()).status).toBe(502)
  })

  it('is a 200 no-op when email is not configured', async () => {
    delete process.env.RESEND_API_KEY
    mock({ classes })
    const res = await run()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ skipped: 'email_not_configured' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
