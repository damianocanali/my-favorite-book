// Teacher-facing notification endpoints: the bell, settings, web push
// subscriptions, and iOS device tokens. Ownership: every read and write is
// scoped by the caller's own auth id; students are refused everywhere.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEACHER, STUDENT_USER, setEnv, mockSupabase, err500 } from './school-mock.js'

const N1 = '6f1c1b1e-0000-4000-8000-0000000000e1'
const N2 = '6f1c1b1e-0000-4000-8000-0000000000e2'
const P256DH = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg'
const TOKEN = 'a'.repeat(64)

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  delete process.env.VAPID_SUBJECT
  vi.restoreAllMocks()
})

function call(path, { method = 'GET', body } = {}) {
  return new Request(`https://app.test/api/${path}`, {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
const mine = (l) => l.url.includes(`eq.${TEACHER.id}`)

describe('GET/POST /api/school/notifications', () => {
  const load = async () => (await import('../api/school/notifications.js')).default
  const list = [{ id: N1, classroom_id: 'c', kind: 'hand_in', payload: { student_name: 'Ann' }, created_at: '2026-09-27T10:00:00Z', read_at: null }]

  it('returns the latest 50 of the caller\'s own notifications and the unread count', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: 'read_at=is.null', reply: { body: [], headers: { 'content-range': '0-0/7' } } },
        { method: 'GET', match: '/rest/v1/teacher_notifications', reply: { body: list } },
      ],
    })
    const res = await (await load())(call('school/notifications'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notifications: list, unread: 7 })
    const reads = log.filter((l) => l.url.includes('teacher_notifications'))
    expect(reads.every(mine)).toBe(true)
    const listCall = reads.find((l) => !l.url.includes('read_at=is.null'))
    expect(listCall.url).toContain('order=created_at.desc')
    expect(listCall.url).toContain('limit=50')
    expect(listCall.url).not.toContain('dedup_key')
  })

  it('names students at read time from their id (a removed student reads as null)', async () => {
    const S1 = '6f1c1b1e-0000-4000-8000-0000000000a1'
    const S2 = '6f1c1b1e-0000-4000-8000-0000000000a2'
    const rows = [
      { id: N1, classroom_id: 'c', kind: 'hand_in', payload: { student_id: S1, class_name: 'Room 5' }, created_at: 'x', read_at: null },
      { id: N2, classroom_id: 'c', kind: 'help_book', payload: { student_id: S2 }, created_at: 'x', read_at: null },
    ]
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: 'read_at=is.null', reply: { body: [], headers: { 'content-range': '0-0/2' } } },
        { method: 'GET', match: '/rest/v1/teacher_notifications', reply: { body: rows } },
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [{ id: S1, display_name: 'Ann' }] } },
      ],
    })
    const body = await (await (await load())(call('school/notifications'))).json()
    expect(body.notifications.map((n) => n.payload.student_name)).toEqual(['Ann', null])
    const lookup = log.find((l) => l.url.includes('/rest/v1/class_students'))
    expect(lookup.url).toContain(`id=in.(${S1},${S2})`)
    // Only names in the caller's own classes.
    expect(lookup.url).toContain(`classrooms.owner_user_id=eq.${TEACHER.id}`)
  })

  it('fails closed (503) when the read errors', async () => {
    mockSupabase({ user: TEACHER, routes: [err500('GET', '/rest/v1/teacher_notifications')] })
    expect((await (await load())(call('school/notifications'))).status).toBe(503)
  })

  it('POST read with ids marks only those, only the caller\'s', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [{ method: 'PATCH', match: '/rest/v1/teacher_notifications', reply: { body: [] } }] })
    const res = await (await load())(call('school/notifications', { method: 'POST', body: { action: 'read', ids: [N1, N2] } }))
    expect(res.status).toBe(200)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`teacher_user_id=eq.${TEACHER.id}`)
    expect(p.url).toContain(`id=in.(${N1},${N2})`)
    expect(p.url).toContain('read_at=is.null')
    expect(p.body.read_at).toMatch(/^\d{4}-/)
  })

  it('POST read without ids marks all of the caller\'s', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [{ method: 'PATCH', match: '/rest/v1/teacher_notifications', reply: { body: [] } }] })
    await (await load())(call('school/notifications', { method: 'POST', body: { action: 'read' } }))
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`teacher_user_id=eq.${TEACHER.id}`)
    expect(p.url).not.toContain('id=in.')
  })

  it.each([
    ['bad action', { action: 'delete' }],
    ['non-uuid id', { action: 'read', ids: ['x'] }],
    ['ids not an array', { action: 'read', ids: N1 }],
    ['too many ids', { action: 'read', ids: Array(101).fill(N1) }],
  ])('400 for %s', async (_, body) => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('school/notifications', { method: 'POST', body }))).status).toBe(400)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('403s a student', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(call('school/notifications'))).status).toBe(403)
  })

  it('405 for DELETE', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('school/notifications', { method: 'DELETE' }))).status).toBe(405)
  })
})

describe('GET/PUT /api/school/notification-settings', () => {
  const load = async () => (await import('../api/school/notification-settings.js')).default

  it('GET returns the defaults when there is no row', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/teacher_settings', reply: { body: [] } }] })
    const res = await (await load())(call('school/notification-settings'))
    expect(await res.json()).toEqual({ summary: 'daily', push_urgent: true, email_urgent: true })
    expect(log.find((l) => l.url.includes('teacher_settings')).url).toContain(`user_id=eq.${TEACHER.id}`)
  })

  it('GET returns the saved row', async () => {
    mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/teacher_settings', reply: { body: [{ summary: 'weekly', push_urgent: false, email_urgent: true }] } }] })
    expect(await (await (await load())(call('school/notification-settings'))).json()).toEqual({ summary: 'weekly', push_urgent: false, email_urgent: true })
  })

  it('PUT upserts the caller\'s own row (user id from the session, never the body)', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [{ method: 'POST', match: '/rest/v1/teacher_settings', reply: { body: [{ summary: 'off', push_urgent: true, email_urgent: false }] } }],
    })
    const res = await (await load())(call('school/notification-settings', { method: 'PUT', body: { summary: 'off', email_urgent: false, user_id: 'someone-else' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ summary: 'off', push_urgent: true, email_urgent: false })
    const up = log.find((l) => l.method === 'POST')
    expect(up.url).toContain('on_conflict=user_id')
    expect(up.headers.Prefer).toContain('resolution=merge-duplicates')
    expect(up.body).toMatchObject({ user_id: TEACHER.id, summary: 'off', email_urgent: false })
    expect(up.body).not.toHaveProperty('push_urgent')
    expect(up.body).not.toHaveProperty('last_summary_at')
  })

  it.each([
    ['bad summary', { summary: 'hourly' }],
    ['non-boolean', { push_urgent: 'yes' }],
    ['nothing to change', {}],
  ])('PUT 400 for %s', async (_, body) => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('school/notification-settings', { method: 'PUT', body }))).status).toBe(400)
  })

  it('rate-limits GET too', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const handler = await load()
    let last
    for (let i = 0; i < 301; i++) last = await handler(call('school/notification-settings'))
    expect(last.status).toBe(429)
  })

  it('403s a student; 503 when the read errors', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(call('school/notification-settings'))).status).toBe(403)
    vi.resetModules()
    mockSupabase({ user: TEACHER, routes: [err500('GET', '/rest/v1/teacher_settings')] })
    expect((await (await load())(call('school/notification-settings'))).status).toBe(503)
  })
})

describe('/api/school/push-subscribe', () => {
  const load = async () => (await import('../api/school/push-subscribe.js')).default
  const sub = (over = {}) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: P256DH, auth: AUTH }, ...over })

  it('GET gives the VAPID public key, or null when push is not configured', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect(await (await (await load())(call('school/push-subscribe'))).json()).toEqual({ vapidPublicKey: null })
    vi.resetModules()
    process.env.VAPID_PUBLIC_KEY = 'PUB'
    process.env.VAPID_PRIVATE_KEY = 'PRIV'
    process.env.VAPID_SUBJECT = 'mailto:x@y.z'
    expect(await (await (await load())(call('school/push-subscribe'))).json()).toEqual({ vapidPublicKey: 'PUB' })
  })

  it('rate-limits GET', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const handler = await load()
    let last
    for (let i = 0; i < 301; i++) last = await handler(call('school/push-subscribe'))
    expect(last.status).toBe(429)
  })

  it('POST first releases the endpoint from any OTHER user, then upserts it for the caller', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [{ method: 'POST', match: '/rest/v1/push_subscriptions', reply: { status: 201, body: [] } }] })
    const res = await (await load())(call('school/push-subscribe', { method: 'POST', body: sub() }))
    expect(res.status).toBe(200)
    const writes = log.filter((l) => l.url.includes('push_subscriptions'))
    expect(writes.map((w) => w.method)).toEqual(['DELETE', 'POST'])
    expect(writes[0].url).toContain(`endpoint=eq.${encodeURIComponent(sub().endpoint)}`)
    expect(writes[0].url).toContain(`user_id=neq.${TEACHER.id}`)
    const up = log.find((l) => l.method === 'POST')
    expect(up.url).toContain('on_conflict=endpoint')
    expect(up.body).toEqual({ user_id: TEACHER.id, endpoint: sub().endpoint, p256dh: P256DH, auth: AUTH })
  })

  it.each([
    ['http endpoint', sub({ endpoint: 'http://fcm.googleapis.com/x' })],
    ['unknown push host', sub({ endpoint: 'https://evil.example/x' })],
    ['internal host', sub({ endpoint: 'https://169.254.169.254/latest' })],
    ['bad p256dh', sub({ keys: { p256dh: 'AAAA', auth: AUTH } })],
    ['bad auth', sub({ keys: { p256dh: P256DH, auth: 'AAAA' } })],
    ['missing keys', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }],
  ])('POST 400 for %s', async (_, body) => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('school/push-subscribe', { method: 'POST', body }))).status).toBe(400)
    expect(log.some((l) => l.url.includes('push_subscriptions'))).toBe(false)
  })

  it.each([
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/abc',
    'https://wns2-by3p.notify.windows.com/w/?token=x',
  ])('accepts the %s push service', async (endpoint) => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('school/push-subscribe', { method: 'POST', body: sub({ endpoint }) }))).status).toBe(200)
  })

  it('DELETE removes only the caller\'s own subscription', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(call('school/push-subscribe', { method: 'DELETE', body: { endpoint: sub().endpoint } }))
    expect(res.status).toBe(200)
    const d = log.find((l) => l.method === 'DELETE')
    expect(d.url).toContain(`endpoint=eq.${encodeURIComponent(sub().endpoint)}`)
    expect(d.url).toContain(`user_id=eq.${TEACHER.id}`)
  })

  it('403s a student', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(call('school/push-subscribe', { method: 'POST', body: sub() }))).status).toBe(403)
  })

  it('502 when the upsert fails', async () => {
    mockSupabase({ user: TEACHER, routes: [err500('POST', '/rest/v1/push_subscriptions')] })
    expect((await (await load())(call('school/push-subscribe', { method: 'POST', body: sub() }))).status).toBe(502)
  })
})

describe('/api/device-token', () => {
  const load = async () => (await import('../api/device-token.js')).default

  it('POST registers an iOS token for the caller (after releasing it from any other user), env defaults to production', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(call('device-token', { method: 'POST', body: { token: TOKEN } }))
    expect(res.status).toBe(200)
    const writes = log.filter((l) => l.url.includes('device_tokens'))
    expect(writes.map((w) => w.method)).toEqual(['DELETE', 'POST'])
    expect(writes[0].url).toContain(`token=eq.${TOKEN}`)
    expect(writes[0].url).toContain(`user_id=neq.${TEACHER.id}`)
    const up = log.find((l) => l.method === 'POST')
    expect(up.url).toContain('/rest/v1/device_tokens?on_conflict=token')
    expect(up.body).toEqual({ user_id: TEACHER.id, token: TOKEN, platform: 'ios', env: 'production' })
  })

  it('accepts env sandbox', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    await (await load())(call('device-token', { method: 'POST', body: { token: TOKEN, env: 'sandbox' } }))
    expect(log.find((l) => l.method === 'POST').body.env).toBe('sandbox')
  })

  it.each([
    ['non-hex token', { token: 'z'.repeat(64) }],
    ['short token', { token: 'ab' }],
    ['bad env', { token: TOKEN, env: 'staging' }],
  ])('POST 400 for %s', async (_, body) => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('device-token', { method: 'POST', body }))).status).toBe(400)
  })

  it('DELETE removes only the caller\'s token', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    await (await load())(call('device-token', { method: 'DELETE', body: { token: TOKEN } }))
    const d = log.find((l) => l.method === 'DELETE')
    expect(d.url).toContain(`token=eq.${TOKEN}`)
    expect(d.url).toContain(`user_id=eq.${TEACHER.id}`)
  })

  it('403s a class (student) account; 401 without a session', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(call('device-token', { method: 'POST', body: { token: TOKEN } }))).status).toBe(403)
    vi.resetModules()
    mockSupabase({ user: TEACHER, routes: [] })
    const noAuth = new Request('https://app.test/api/device-token', { method: 'POST', body: JSON.stringify({ token: TOKEN }) })
    expect((await (await load())(noAuth)).status).toBe(401)
  })
})
