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
  // Live mode for most tests; the dry-run describe below unsets it.
  process.env.RETENTION_DRY_RUN = 'false'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  for (const k of ['CRON_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'OWNER_ALERT_EMAIL', 'RETENTION_DRY_RUN']) delete process.env[k]
  vi.restoreAllMocks()
})

const run = async (auth = 'Bearer cron-secret') =>
  (await import('../api/cron/retention.js')).GET(
    new Request('https://mybooklab.app/api/cron/retention', { headers: auth ? { authorization: auth } : {} })
  )

describe('license lifecycle: nextStep', () => {
  const lic = (over) => ({ status: 'trial', expires_at: daysAgo(10), updated_at: daysAgo(1), status_changed_at: daysAgo(200), ...over })

  it('grace and comped are never lapsed; live licenses are not', () => {
    expect(lapseDate(lic({ status: 'grace' }))).toBe(null)
    expect(lapseDate(lic({ status: 'comped', expires_at: daysAgo(400) }))).toBe(null)
    expect(nextStep(lic({ status: 'comped', expires_at: daysAgo(400) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: new Date(NOW.getTime() + DAY).toISOString() }), NOW)).toBe(null)
  })
  it('lapsed/canceled count from status_changed_at (not updated_at), expiring ones from expires_at', () => {
    expect(lapseDate(lic({ status: 'lapsed', status_changed_at: daysAgo(5), updated_at: daysAgo(1) })).toISOString()).toBe(daysAgo(5))
    expect(lapseDate(lic({ expires_at: daysAgo(7) })).toISOString()).toBe(daysAgo(7))
  })
  it('30-day warning at 60 days; 7-day warning only after the 30-day one is 23+ days old', () => {
    expect(nextStep(lic({ expires_at: daysAgo(59) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: daysAgo(60) }), NOW)).toBe('warn30')
    expect(nextStep(lic({ expires_at: daysAgo(83), purge_warning_30_at: daysAgo(22) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: daysAgo(83), purge_warning_30_at: daysAgo(23) }), NOW)).toBe('warn7')
    // Never a 7-day warning without the 30-day one.
    expect(nextStep(lic({ expires_at: daysAgo(85), purge_warning_7_at: daysAgo(1) }), NOW)).toBe('warn30')
  })
  it('purges only with 30+ days of notice: 30-day warning 30+ days old and 7-day warning 7+ days old', () => {
    expect(nextStep(lic({ expires_at: daysAgo(90), purge_warning_30_at: daysAgo(30), purge_warning_7_at: daysAgo(7) }), NOW)).toBe('purge')
    expect(nextStep(lic({ expires_at: daysAgo(90), purge_warning_30_at: daysAgo(29), purge_warning_7_at: daysAgo(7) }), NOW)).toBe(null)
    expect(nextStep(lic({ expires_at: daysAgo(90), purge_warning_30_at: daysAgo(30), purge_warning_7_at: daysAgo(6) }), NOW)).toBe(null)
  })
  it('a long-ago lapse first seen today starts the full schedule today', () => {
    expect(nextStep(lic({ expires_at: daysAgo(400) }), NOW)).toBe('warn30')
    expect(nextStep(lic({ expires_at: daysAgo(400), purge_warning_30_at: daysAgo(1) }), NOW)).toBe(null)
  })
  it('a warning from before the current lapse does not count', () => {
    expect(nextStep(lic({ status: 'lapsed', status_changed_at: daysAgo(90), purge_warning_30_at: daysAgo(400), purge_warning_7_at: daysAgo(300) }), NOW)).toBe('warn30')
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

  const EXPIRING_Q = 'status=in.(trial,active,pending_payment)'
  const ENDED_Q = 'status=in.(lapsed,canceled)'
  const lic = (over) => ({
    id: 'L1', owner_user_id: 'teacher-1', classroom_id: 'c1', status: 'trial', expires_at: daysAgo(61), updated_at: daysAgo(61),
    status_changed_at: daysAgo(400), classrooms: { id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' }, ...over,
  })

  it('selects only licenses due today, both groups, paged and ordered by lapse date', async () => {
    mock()
    await run()
    const qs = log.filter((l) => l.u.includes('/rest/v1/class_licenses?'))
    const exp = qs.find((l) => l.u.includes(EXPIRING_Q)).u
    const end = qs.find((l) => l.u.includes(ENDED_Q)).u
    expect(exp).toContain('order=expires_at.asc')
    expect(end).toContain('order=status_changed_at.asc')
    expect(exp).toContain('purge_warning_30_at.is.null')
    expect(exp).toContain('limit=1000&offset=0')
    expect(exp).not.toContain('comped')
  })

  it('emails the 30-day lapse warning to the class owner and stamps it', async () => {
    mock([
      { method: 'GET', match: EXPIRING_Q, reply: { body: [lic()] } },
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

  it('fails closed without an email provider: no stamp, no purge, owner alerted with class ids', async () => {
    delete process.env.RESEND_API_KEY // owner alert can't send either; check the response instead
    mock([{ method: 'GET', match: EXPIRING_Q, reply: { body: [lic()] } }])
    const out = await (await run()).json()
    expect(out.licenses).toMatchObject({ warned30: 0, unsendable: ['c1'] })
    expect(log.some((l) => l.method === 'PATCH' && l.u.includes('class_licenses') && !l.u.includes('status=eq.grace'))).toBe(false)
  })

  it('fails closed when the teacher has no address, and tells the owner which class', async () => {
    mock([
      { method: 'GET', match: EXPIRING_Q, reply: { body: [lic()] } },
      { method: 'GET', match: '/auth/v1/admin/users/teacher-1', reply: { body: { id: 'teacher-1' } } },
      { method: 'POST', match: 'api.resend.com', reply: { body: { id: 'em_1' } } },
    ])
    const out = await (await run()).json()
    expect(out.licenses.unsendable).toEqual(['c1'])
    expect(log.some((l) => l.method === 'PATCH' && l.u.includes('class_licenses') && !l.u.includes('status=eq.grace'))).toBe(false)
    const alert = log.find((l) => l.u.includes('api.resend.com'))
    expect(alert.body.to).toEqual(['owner@example.com'])
    expect(alert.body.text).toContain('class ids: c1')
  })

  it('purges a class only after the full warning schedule, logging the class and each child', async () => {
    mock([
      { method: 'GET', match: ENDED_Q, reply: { body: [lic({
        status: 'lapsed', status_changed_at: daysAgo(95), purge_warning_30_at: daysAgo(31), purge_warning_7_at: daysAgo(8),
        classrooms: [{ id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' }],
      })] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 5 }] } },
      { method: 'GET', match: 'class_students?classroom_id=eq.c1&select=id,auth_user_id', reply: { body: [{ id: 's9', auth_user_id: 'kid-9' }] } },
    ])
    const out = await (await run()).json()
    expect(out.licenses).toMatchObject({ purged: 1, failed: 0 })
    const opens = log.filter((l) => l.method === 'POST' && l.u.includes('deletion_log')).map((l) => l.body)
    expect(opens[0]).toMatchObject({ action: 'purge_lapsed_class', actor_kind: 'system', classroom_id: 'c1' })
    expect(opens.find((b) => b.action === 'purge_class_student')).toMatchObject({ target_id: 's9' })
    expect(log.some((l) => l.method === 'DELETE' && l.u.endsWith('/auth/v1/admin/users/kid-9'))).toBe(true)
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/classrooms?id=eq.c1'))).toBe(true)
  })

  it('resumes partial teacher deletes (class and child)', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/deletion_log?action=in.(delete_class,delete_student)', reply: { body: [
        { id: 44, action: 'delete_class', classroom_id: 'c7', target_id: 'c7', actor_user_id: 'teacher-1' },
        { id: 46, action: 'delete_student', classroom_id: 'c8', target_id: 's8', actor_user_id: 'teacher-1' },
      ] } },
      { method: 'GET', match: '/rest/v1/class_students?id=eq.s8', reply: { body: [{ auth_user_id: 'kid-8' }] } },
      { method: 'GET', match: '/rest/v1/classrooms?id=eq.c7', reply: { body: [{ id: 'c7', code: 'XYZ234' }] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 45 }] } },
    ])
    const out = await (await run()).json()
    expect(out.teacher_deletes).toEqual({ resumed: 2, failed: 0 })
    expect(log.some((l) => l.method === 'DELETE' && l.u.endsWith('/auth/v1/admin/users/kid-8'))).toBe(true)
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/classrooms?id=eq.c7'))).toBe(true)
    const close = log.filter((l) => l.method === 'PATCH' && l.u.includes('deletion_log?id=eq.44')).at(-1)
    expect(close.body.status).toBe('done')
  })

  it('leaves legacy submissions alone before the sunset; after it, logs then deletes ownerless ones', async () => {
    mock()
    let out = await (await run()).json()
    expect(out.legacy_submissions).toMatchObject({ active: false })
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/submissions'))).toBe(false)

    vi.resetModules()
    process.env.LEGACY_SUBMIT_SUNSET = '2026-11-01T00:00:00Z'
    mock([
      { method: 'GET', match: '/rest/v1/submissions?user_id=is.null', reply: { headers: { 'content-range': '0-0/4' }, body: [{ id: 'x' }] } },
      { method: 'DELETE', match: '/rest/v1/submissions?', reply: { headers: { 'content-range': '*/4' } } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 3 }] } },
    ])
    out = await (await run()).json()
    expect(out.legacy_submissions).toMatchObject({ active: true, failed: 0, deleted: 4 })
    const del = log.find((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/submissions'))
    expect(del.u).toContain('user_id=is.null')
    expect(del.u).toContain('submitted_at=lt.2026-11-01T00:00:00.000Z')
    const open = log.find((l) => l.method === 'POST' && l.u.includes('deletion_log'))
    expect(open.body).toMatchObject({ action: 'legacy_sunset', counts: { submissions: 4 } })
    expect(log.indexOf(open)).toBeLessThan(log.indexOf(del))
  })

  it('purges print PDFs of refunded/failed/abandoned orders after 30 days, shipped after 90', async () => {
    mock()
    await run()
    const qs = log.filter((l) => l.u.includes('/rest/v1/print_orders?status=in.'))
    expect(qs.find((l) => l.u.includes('status=in.(shipped,delivered)')).u).toContain(`updated_at=lt.${daysAgo(90)}`)
    expect(qs.find((l) => l.u.includes('status=in.(refunded,failed,pending,paid,pdf_ready)')).u).toContain(`updated_at=lt.${daysAgo(30)}`)
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

describe('api/cron/retention DRY RUN (default)', () => {
  beforeEach(() => { delete process.env.RETENTION_DRY_RUN })

  it('is the default: deletes nothing, emails no teacher, stamps nothing, tells the owner what it would do', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/class_checkins?', reply: { headers: { 'content-range': '0-0/12' }, body: [{ id: 1 }] } },
      { method: 'GET', match: '/rest/v1/class_students?status=eq.removed', reply: { body: [{ id: 's1', classroom_id: 'c1', auth_user_id: 'kid-1' }] } },
      { method: 'GET', match: 'status=in.(trial,active,pending_payment)', reply: { body: [{
        id: 'L1', owner_user_id: 'teacher-1', classroom_id: 'c1', status: 'trial', expires_at: daysAgo(61),
        classrooms: { id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' },
      }] } },
      { method: 'GET', match: '/rest/v1/print_orders?status=in.(refunded,failed,pending,paid,pdf_ready)', reply: { body: [{ id: 'o1' }] } },
      { method: 'POST', match: 'api.resend.com', reply: { body: { id: 'em' } } },
    ])
    const out = await (await run()).json()
    expect(out.dry_run).toBe(true)
    expect(out.checkins).toEqual({ would_delete: 12, failed: 0 })
    expect(out.removed_students).toMatchObject({ would_purge: 1, student_ids: ['s1'] })
    expect(out.licenses.planned).toEqual([{ step: 'warn30', license_id: 'L1', classroom_id: 'c1' }])
    expect(out.order_pdfs).toMatchObject({ would_purge: 1, order_ids: ['o1'] })
    // Nothing destructive, nothing written.
    expect(log.filter((l) => ['DELETE', 'PATCH'].includes(l.method))).toEqual([])
    expect(log.some((l) => l.method === 'POST' && l.u.includes('/rest/v1/'))).toBe(false)
    // One email: the owner's summary, never the teacher.
    const mails = log.filter((l) => l.u.includes('api.resend.com'))
    expect(mails).toHaveLength(1)
    expect(mails[0].body.to).toEqual(['owner@example.com'])
    expect(mails[0].body.subject).toContain('DRY RUN')
    expect(mails[0].body.text).toContain('would warn30: class c1')
    expect(mails[0].body.text).toContain('would purge removed students: s1')
    expect(mails[0].body.text).not.toContain('Room 5')
  })

  it('anything but exactly "false" stays dry', async () => {
    process.env.RETENTION_DRY_RUN = 'no'
    mock()
    expect((await (await run()).json()).dry_run).toBe(true)
    process.env.RETENTION_DRY_RUN = 'false'
    vi.resetModules()
    mock()
    expect((await (await run()).json()).dry_run).toBe(false)
  })
})

describe('round 2: half-deleted lapse purges, dry-run paging (N3, N4)', () => {
  const ENDED_Q = 'status=in.(lapsed,canceled)'
  const dueLic = {
    id: 'L1', owner_user_id: 'teacher-1', classroom_id: 'c1', status: 'lapsed', status_changed_at: daysAgo(95),
    purge_warning_30_at: daysAgo(31), purge_warning_7_at: daysAgo(8), classrooms: { id: 'c1', code: 'ABC234', name: 'Room 5', locale: 'en' },
  }
  const halfRoute = { method: 'GET', match: '/rest/v1/deletion_log?action=eq.purge_lapsed_class', reply: { body: [{ id: 70, classroom_id: 'c1' }] } }
  const aliveRoute = { method: 'GET', match: '/rest/v1/classrooms?id=in.(c1)', reply: { body: [{ id: 'c1' }] } }

  it('a renewed half-deleted class is left alone and the owner is told its id', async () => {
    mock([halfRoute, aliveRoute, { method: 'POST', match: 'api.resend.com', reply: { body: { id: 'em' } } }])
    const out = await (await run()).json()
    expect(out.licenses.needs_human).toEqual(['c1'])
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/rest/v1/classrooms'))).toBe(false)
    const alert = log.find((l) => l.u.includes('api.resend.com'))
    expect(alert.body.to).toEqual(['owner@example.com'])
    expect(alert.body.text).toContain('HALF-DELETED')
    expect(alert.body.text).toContain('c1')
  })

  it('a half-deleted class still due a purge is finished, and the old row closed', async () => {
    mock([
      halfRoute, aliveRoute,
      { method: 'GET', match: ENDED_Q, reply: { body: [dueLic] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 71 }] } },
    ])
    const out = await (await run()).json()
    expect(out.licenses).toMatchObject({ purged: 1, needs_human: [] })
    expect(log.find((l) => l.method === 'PATCH' && l.u.includes('deletion_log?id=eq.70')).body.status).toBe('done')
  })

  it('a lapse purge that stops part-way is marked partial', async () => {
    mock([
      { method: 'GET', match: ENDED_Q, reply: { body: [dueLic] } },
      { method: 'POST', match: '/rest/v1/deletion_log', reply: { status: 201, body: [{ id: 72 }] } },
      { method: 'GET', match: 'class_students?classroom_id=eq.c1&select=id,auth_user_id', reply: { body: [{ id: 's1', auth_user_id: 'k1' }] } },
      { method: 'DELETE', match: '/auth/v1/admin/users/k1', reply: { status: 500, body: {} } },
    ])
    const out = await (await run()).json()
    expect(out.licenses.failed).toBe(1)
    const close = log.filter((l) => l.method === 'PATCH' && l.u.includes('deletion_log?id=eq.72')).at(-1)
    expect(close.body.status).toBe('partial')
  })

  it('does nothing to licenses when the unfinished-purge read fails', async () => {
    mock([
      { method: 'GET', match: '/rest/v1/deletion_log?action=eq.purge_lapsed_class', reply: { status: 500, body: {} } },
      { method: 'GET', match: ENDED_Q, reply: { body: [dueLic] } },
    ])
    const out = await (await run()).json()
    expect(out.licenses.failed).toBe(1)
    expect(log.some((l) => l.method === 'DELETE' && /\/rest\/v1\/classrooms|\/auth\/v1\/admin\/users/.test(l.u))).toBe(false)
    expect(log.some((l) => l.u.includes('class_students?classroom_id=eq.c1'))).toBe(false)
  })

  it('the dry run lists every removed student due, paging past 1000', async () => {
    delete process.env.RETENTION_DRY_RUN
    let pageNo = 0
    mock([{ method: 'GET', match: '/rest/v1/class_students?status=eq.removed', reply: () => {
      pageNo++
      return { body: Array.from({ length: pageNo === 1 ? 1000 : 3 }, (_, i) => ({ id: `s${pageNo}-${i}` })) }
    } }])
    const out = await (await run()).json()
    expect(out.removed_students.would_purge).toBe(1003)
    expect(log.filter((l) => l.u.includes('class_students?status=eq.removed')).map((l) => l.u.match(/offset=(\d+)/)[1])).toEqual(['0', '1000'])
  })
})

describe('Stage 4: grace backstop (lib/school/lifecycle.js endExpiredGrace)', () => {
  it('flips only expired grace to lapsed, plans and licenses; dry run only counts', async () => {
    const { endExpiredGrace } = await import('../lib/school/lifecycle.js')
    const calls = []
    const sb = async (path, init = {}) => {
      calls.push({ path, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined })
      return new Response(JSON.stringify([{ id: 'a' }, { id: 'b' }]))
    }
    const now = new Date('2027-10-01T00:00:00Z')
    expect(await endExpiredGrace(sb, { now, dryRun: true })).toEqual({ licenses: 2, plans: 2, failed: 0 })
    expect(calls.every((c) => c.method === 'GET')).toBe(true)
    calls.length = 0
    await endExpiredGrace(sb, { now, dryRun: false })
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'PATCH'])
    for (const c of calls) {
      expect(c.path).toContain('status=eq.grace&expires_at=lt.2027-10-01T00%3A00%3A00.000Z')
      expect(Object.keys(c.body).sort()).toEqual(['status', 'updated_at'])
      expect(c.body.status).toBe('lapsed')
    }
  })
})
