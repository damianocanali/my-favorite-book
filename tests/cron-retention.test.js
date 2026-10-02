// api/cron/retention.js and lib/school/lifecycle.js (review §7.1, 7.2,
// 7.22, 7.26).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextStep, lapseDate, warningEmail, LAPSE_PURGE_DAYS } from '../lib/school/lifecycle.js'

const NOW = new Date('2026-12-01T04:00:00.000Z')
const DAY = 86400000
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString()

let log
function mock(routes = []) {
  log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = decodeURIComponent(String(url))
    const method = init.method || 'GET'
    let body
    try { body = init.body ? JSON.parse(init.body) : undefined } catch { body = init.body }
    log.push({ method, u, body, headers: init.headers })
    for (const r of routes) {
      if ((!r.method || r.method === method) && u.includes(r.match)) {
        const next = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
        return new Response(JSON.stringify(next.body ?? []), { status: next.status ?? 200, headers: next.headers })
      }
    }
    return new Response('[]', { headers: { 'content-range': '*/0' } })
  })
}

beforeEach(() => {
  vi.resetModules()
  process.env.CRON_SECRET = 'cron-secret'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
  process.env.OWNER_ALERT_EMAIL = 'owner@example.com'
  delete process.env.LEGACY_SUBMIT_SUNSET
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  for (const k of ['CRON_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'OWNER_ALERT_EMAIL']) delete process.env[k]
  vi.restoreAllMocks()
})

const run = async (auth = 'Bearer cron-secret') =>
  (await import('../api/cron/retention.js')).GET(
    new Request('https://mybooklab.app/api/cron/retention', { headers: auth ? { authorization: auth } : {} })
  )

describe('license lifecycle: nextStep', () => {
  const lic = (over) => ({ status: 'trial', expires_at: daysAgo(10), updated_at: daysAgo(200), ...over })

  it('grace and live licenses are never lapsed', () => {
    expect(lapseDate(lic({ status: 'grace' }))).toBe(null)
    expect(nextStep(lic({ expires_at: new Date(NOW.getTime() + DAY).toISOString() }), NOW)).toBe(null)
  })
  it('lapsed/canceled count from updated_at, expiring ones from expires_at', () => {
    expect(lapseDate(lic({ status: 'lapsed', updated_at: daysAgo(5) })).toISOString()).toBe(daysAgo(5))
    expect(lapseDate(lic({ expires_at: daysAgo(7) })).toISOString()).toBe(daysAgo(7))
  })
  it('warns at 60 days, again at 83, purges at 90 only after the 7-day warning is 6+ days old', () => {
    expect(nextStep(lic({ expires_at: daysAgo(59) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: daysAgo(60) }), NOW)).toBe('warn30')
    expect(nextStep(lic({ expires_at: daysAgo(70), purge_warning_30_at: daysAgo(10) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: daysAgo(83), purge_warning_30_at: daysAgo(23) }), NOW)).toBe('warn7')
    expect(nextStep(lic({ expires_at: daysAgo(90), purge_warning_7_at: daysAgo(7) }), NOW)).toBe('purge')
    // Never a surprise purge: no 7-day warning yet → warn first.
    expect(nextStep(lic({ expires_at: daysAgo(200) }), NOW)).toBe('warn7')
    // Warned only yesterday → wait.
    expect(nextStep(lic({ expires_at: daysAgo(200), purge_warning_7_at: daysAgo(1) }), NOW)).toBe(null)
  })
  it('a warning from before a renewal does not count', () => {
    // Lapsed 90 days ago, but the 7-day stamp predates this lapse.
    expect(nextStep(lic({ expires_at: daysAgo(90), purge_warning_7_at: daysAgo(400) }), NOW)).toBe('warn7')
  })
  it('the email says permanent, in the class language, with no child data', () => {
    const en = warningEmail({ days: 7, className: 'Room 5', purgeOn: new Date(NOW.getTime() + 7 * DAY), locale: 'en' })
    expect(en.subject).toContain('7 days')
    expect(en.text).toContain("can't be undone")
    const it_ = warningEmail({ days: 30, className: 'Classe 2B', purgeOn: NOW, locale: 'it' })
    expect(it_.text).toContain('definitivamente')
    expect(LAPSE_PURGE_DAYS).toBe(90)
  })
})

describe('api/cron/retention', () => {
  it('refuses without the cron secret', async () => {
    mock()
    expect((await run(null)).status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('deletes check-ins and sign-in attempts older than 30 days', async () => {
    mock([
      { method: 'DELETE', match: '/rest/v1/class_checkins?', reply: { headers: { 'content-range': '*/12' } } },
      { method: 'DELETE', match: '/rest/v1/student_sign_in_attempts?', reply: { headers: { 'content-range': '*/40' } } },
    ])
    const res = await run()
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.checkins).toEqual({ deleted: 12, failed: 0 })
    expect(out.sign_in_attempts).toEqual({ deleted: 40, failed: 0 })
    const c = log.find((l) => l.method === 'DELETE' && l.u.includes('class_checkins'))
    expect(c.u).toContain(`created_at=lt.${daysAgo(30)}`)
    const a = log.find((l) => l.method === 'DELETE' && l.u.includes('student_sign_in_attempts'))
    expect(a.u).toContain(`created_at=lt.${daysAgo(30)}`)
    expect(out.failed).toBe(0)
    // No failures → no owner alert.
    expect(log.some((l) => l.u.includes('api.resend.com'))).toBe(false)
  })

  it('purges students removed 30+ days ago, with a deletion_log row each', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/class_students?status=eq.removed', reply: { body: [{ id: 's1', classroom_id: 'c1', auth_user_id: 'kid-1' }] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 77 }] } },
    ])
    const out = await (await run()).json()
    expect(out.removed_students).toEqual({ purged: 1, failed: 0 })
    const q = log.find((l) => l.u.includes('class_students?status=eq.removed'))
    expect(q.u).toContain(`removed_at=lt.${daysAgo(30)}`)
    const open = log.find((l) => l.method === 'POST' && l.u.includes('deletion_log'))
    expect(open.body).toMatchObject({ actor_kind: 'system', action: 'purge_removed_student', classroom_id: 'c1', target_id: 's1', status: 'started' })
    expect(JSON.stringify(open.body)).not.toMatch(/display_name/)
    const authDel = log.findIndex((l) => l.method === 'DELETE' && l.u.endsWith('/auth/v1/admin/users/kid-1'))
    expect(authDel).toBeGreaterThan(log.indexOf(open))
    const close = log.find((l) => l.method === 'PATCH' && l.u.includes('deletion_log?id=eq.77'))
    expect(close.body.status).toBe('done')
    // Students never touch vendors.
    expect(log.some((l) => /stripe\.com|revenuecat\.com/.test(l.u))).toBe(false)
  })

  it('does not purge a removed student when the evidence row cannot be written, and alerts the owner', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/class_students?status=eq.removed', reply: { body: [{ id: 's1', classroom_id: 'c1', auth_user_id: 'kid-1' }] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 500, body: {} } },
      { method: 'POST', match: 'api.resend.com', reply: { body: { id: 'em_1' } } },
    ])
    const out = await (await run()).json()
    expect(out.removed_students).toEqual({ purged: 0, failed: 1 })
    expect(log.some((l) => l.u.endsWith('/auth/v1/admin/users/kid-1'))).toBe(false)
    const alert = log.find((l) => l.u.includes('api.resend.com'))
    expect(alert.body.to).toEqual(['owner@example.com'])
    expect(alert.body.subject).toContain('Retention job')
    expect(alert.body.text).toContain('removed_students.failed: 1')
    // Counts and ids only.
    expect(alert.body.text).not.toMatch(/kid-1|@/)
  })

  it('emails the 30-day lapse warning to the class owner and stamps it', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/class_licenses?classroom_id=not.is.null', reply: { body: [{
        id: 'L1', owner_user_id: 'teacher-1', classroom_id: 'c1', status: 'trial', expires_at: daysAgo(61), updated_at: daysAgo(61),
        classrooms: { id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' },
      }] } },
      { method: 'GET', match: '/auth/v1/admin/users/teacher-1', reply: { body: { id: 'teacher-1', email: 'teach@example.com' } } },
      { method: 'POST', match: 'api.resend.com', reply: { body: { id: 'em_1' } } },
    ])
    const out = await (await run()).json()
    expect(out.licenses).toMatchObject({ warned30: 1, purged: 0, failed: 0 })
    const mail = log.find((l) => l.u.includes('api.resend.com'))
    expect(mail.body.to).toEqual(['teach@example.com'])
    expect(mail.body.subject).toContain('30 days')
    const stamp = log.find((l) => l.method === 'PATCH' && l.u.includes('class_licenses?id=eq.L1'))
    expect(Object.keys(stamp.body)).toEqual(['purge_warning_30_at'])
  })

  it('purges a class lapsed 90+ days after the 7-day warning, logging it', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/class_licenses?classroom_id=not.is.null', reply: { body: [{
        id: 'L1', owner_user_id: 'teacher-1', classroom_id: 'c1', status: 'lapsed', expires_at: daysAgo(150), updated_at: daysAgo(95),
        purge_warning_7_at: daysAgo(8), classrooms: [{ id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' }],
      }] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 5 }] } },
      { method: 'GET', match: 'class_students?classroom_id=eq.c1&select=auth_user_id', reply: { body: [{ auth_user_id: 'kid-9' }] } },
    ])
    const out = await (await run()).json()
    expect(out.licenses).toMatchObject({ purged: 1, failed: 0 })
    const open = log.find((l) => l.method === 'POST' && l.u.includes('deletion_log'))
    expect(open.body).toMatchObject({ action: 'purge_lapsed_class', actor_kind: 'system', classroom_id: 'c1' })
    expect(log.some((l) => l.method === 'DELETE' && l.u.endsWith('/auth/v1/admin/users/kid-9'))).toBe(true)
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/classrooms?id=eq.c1'))).toBe(true)
  })

  it('leaves legacy submissions alone before the sunset, deletes ownerless ones after', async () => {
    mock()
    let out = await (await run()).json()
    expect(out.legacy_submissions).toMatchObject({ active: false })
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/submissions'))).toBe(false)

    vi.resetModules()
    process.env.LEGACY_SUBMIT_SUNSET = '2026-11-01T00:00:00Z'
    mock()
    out = await (await run()).json()
    expect(out.legacy_submissions).toMatchObject({ active: true, failed: 0 })
    const del = log.find((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/submissions'))
    expect(del.u).toContain('user_id=is.null')
    expect(del.u).toContain('submitted_at=lt.2026-11-01T00:00:00.000Z')
  })

  it('one failing job does not stop the others', async () => {
    mock([{ method: 'DELETE', match: '/rest/v1/class_checkins?', reply: { status: 500, body: {} } }])
    const out = await (await run()).json()
    expect(out.checkins.failed).toBe(1)
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('student_sign_in_attempts'))).toBe(true)
    expect(log.some((l) => l.u.includes('vendor_deletion_queue'))).toBe(true)
    expect(out.failed).toBeGreaterThan(0)
  })
})
