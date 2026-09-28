// notifyTeacher: the bell row always; urgent kinds fan out to web push,
// APNs and email per teacher_settings; help asks only inside school hours.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { b64uEncode, b64uDecode } from '../lib/notify/jwt.js'

const subtle = globalThis.crypto.subtle
const TEACHER_ID = '6f1c1b1e-0000-4000-8000-000000000009'
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const ASSIGN_ID = '6f1c1b1e-0000-4000-8000-0000000000b1'
const SUB1 = '6f1c1b1e-0000-4000-8000-0000000000f1'
const SUB2 = '6f1c1b1e-0000-4000-8000-0000000000f2'
const ALL_WEEK = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, ['00:00', '23:59']]))
const classroom = (over = {}) => ({ id: CLASS_ID, name: 'Room 5', timezone: 'America/New_York', school_hours: ALL_WEEK, owner_user_id: TEACHER_ID, locale: 'en', ...over })
const FEELINGS = ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']

let uaKeys
async function makeSub(endpoint) {
  const authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return { endpoint, p256dh: b64uEncode(new Uint8Array(await subtle.exportKey('raw', uaKeys.publicKey))), auth: b64uEncode(authSecret), authSecret }
}

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}
async function decryptPush(body, authSecret) {
  const enc = (s) => new TextEncoder().encode(s)
  const salt = body.slice(0, 16), asPublic = body.slice(21, 86), ct = body.slice(86)
  const uaPublic = new Uint8Array(await subtle.exportKey('raw', uaKeys.publicKey))
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256))
  const info = new Uint8Array([...enc('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await hkdf(authSecret, ecdh, info, 32)
  const key = await subtle.importKey('raw', await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16), 'AES-GCM', false, ['decrypt'])
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12) }, key, ct))
  return new TextDecoder().decode(pt.slice(0, pt.lastIndexOf(2)))
}

// One fetch mock for Supabase, push services, the APNs worker and Resend.
function mockAll({ settings = [], subs = [], pushStatus = {}, insertReply, students, submissions, failAll = false } = {}) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    const entry = { method, url: u, headers: init.headers, rawBody: init.body }
    try { entry.body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined } catch { /* binary */ }
    log.push(entry)
    if (failAll) throw new Error('network down')
    if (u.includes('/rest/v1/teacher_notifications') && method === 'POST') {
      return new Response(JSON.stringify(insertReply ?? [{ id: 'n1' }]), { status: 201 })
    }
    if (u.includes('/rest/v1/teacher_settings')) return new Response(JSON.stringify(settings))
    if (u.includes('/rest/v1/push_subscriptions') && method === 'GET') {
      return new Response(JSON.stringify(subs.map(({ authSecret, ...s }) => s)))
    }
    if (u.includes('/rest/v1/class_students')) return new Response(JSON.stringify(students ?? []))
    if (u.includes('/rest/v1/class_submissions')) return new Response(JSON.stringify(submissions ?? []))
    if (u.includes('/auth/v1/admin/users/')) return new Response(JSON.stringify({ id: TEACHER_ID, email: 'teacher@school.test' }))
    if (u.startsWith('https://push.example/')) return new Response(null, { status: pushStatus[u] ?? 201 })
    if (u.includes('/api/notify/apns')) return new Response('{"sent":1,"removed":0}')
    if (u.includes('api.resend.com')) return new Response('{"id":"e1"}')
    return new Response('[]')
  })
  return log
}

async function configureAll() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  process.env.VAPID_PUBLIC_KEY = b64uEncode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)))
  process.env.VAPID_PRIVATE_KEY = (await subtle.exportKey('jwk', kp.privateKey)).d
  process.env.VAPID_SUBJECT = 'mailto:hello@mybooklab.app'
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
  process.env.APNS_KEY_ID = 'K'
  process.env.APNS_TEAM_ID = 'T'
  process.env.APNS_KEY_P8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' })
  process.env.APNS_TOPIC = 'app.mybooklab.ios'
  process.env.PUBLIC_BASE_URL = 'https://mybooklab.app'
}
const ENV_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'RESEND_API_KEY', 'EMAIL_FROM', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_KEY_P8', 'APNS_TOPIC', 'PUBLIC_BASE_URL']

beforeEach(async () => {
  vi.resetModules()
  for (const k of ENV_KEYS) delete process.env[k]
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  uaKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
  vi.restoreAllMocks()
})

const load = () => import('../lib/notify/notify.js')
const pushes = (log) => log.filter((l) => l.url.startsWith('https://push.example/'))
const emails = (log) => log.filter((l) => l.url.includes('api.resend.com'))
const apns = (log) => log.filter((l) => l.url.includes('/api/notify/apns'))
const bellRows = (log) => log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/teacher_notifications'))

describe('notifyTeacher', () => {
  it('help_book: writes a bell row only, no push or email', async () => {
    await configureAll()
    const log = mockAll()
    const { notifyTeacher } = await load()
    const r = await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_book', classroom: classroom(), studentName: 'Ann', payload: { help_id: 'h1' } })
    expect(r).toEqual({ stored: true, fannedOut: false })
    expect(bellRows(log)[0].body).toEqual({
      teacher_user_id: TEACHER_ID, classroom_id: CLASS_ID, kind: 'help_book',
      payload: { student_name: 'Ann', class_name: 'Room 5', help_id: 'h1' },
    })
    expect(pushes(log)).toHaveLength(0)
    expect(emails(log)).toHaveLength(0)
    expect(apns(log)).toHaveLength(0)
  })

  it('help_grownup inside school hours: bell + web push to every browser + APNs + email', async () => {
    await configureAll()
    const s1 = await makeSub('https://push.example/a')
    const s2 = await makeSub('https://push.example/b')
    const log = mockAll({ subs: [{ id: SUB1, ...s1 }, { id: SUB2, ...s2 }] })
    const { notifyTeacher } = await load()
    const r = await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })
    expect(r).toEqual({ stored: true, fannedOut: true })
    expect(pushes(log).map((p) => p.url).sort()).toEqual(['https://push.example/a', 'https://push.example/b'])
    const msg = JSON.parse(await decryptPush(new Uint8Array(pushes(log)[0].rawBody), s1.endpoint === pushes(log)[0].url ? s1.authSecret : s2.authSecret))
    expect(msg).toMatchObject({ title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher' })
    expect(apns(log)[0].body).toMatchObject({ userId: TEACHER_ID, body: 'Ann in Room 5 asked for a grown-up.', kind: 'help_grownup' })
    const mail = emails(log)[0].body
    expect(mail.to).toEqual(['teacher@school.test'])
    expect(mail.subject).toBe('Ann in Room 5 asked for a grown-up.')
    expect(mail.text).toContain('It is not monitored and is not an emergency service.')
  })

  it('never sends a feeling: nothing outbound contains one even if a caller slips it into payload', async () => {
    await configureAll()
    const s1 = await makeSub('https://push.example/a')
    const log = mockAll({ subs: [{ id: SUB1, ...s1 }] })
    const { notifyTeacher } = await load()
    await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true, payload: { feeling: 'sad', need: 'grownup' } })
    const outbound = [
      await decryptPush(new Uint8Array(pushes(log)[0].rawBody), s1.authSecret),
      JSON.stringify(apns(log)[0].body),
      JSON.stringify(emails(log)[0].body),
    ].join(' ').toLowerCase()
    for (const f of FEELINGS) expect(outbound).not.toContain(f)
    // And the bell row never stores one either.
    expect(bellRows(log)[0].body.payload).not.toHaveProperty('feeling')
    expect(bellRows(log)[0].body.payload).not.toHaveProperty('need')
  })

  it('help_grownup outside school hours: bell row, but no push, APNs or email', async () => {
    await configureAll()
    const log = mockAll({ subs: [{ id: SUB1, ...(await makeSub('https://push.example/a')) }] })
    const { notifyTeacher } = await load()
    const r = await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom({ school_hours: {} }), studentName: 'Ann', urgent: true })
    expect(r).toEqual({ stored: true, fannedOut: false })
    expect(bellRows(log)).toHaveLength(1)
    expect(pushes(log)).toHaveLength(0)
    expect(emails(log)).toHaveLength(0)
    expect(apns(log)).toHaveLength(0)
  })

  it('respects teacher_settings: push off still emails; email off still pushes', async () => {
    await configureAll()
    const sub = { id: SUB1, ...(await makeSub('https://push.example/a')) }
    let log = mockAll({ settings: [{ push_urgent: false, email_urgent: true }], subs: [sub] })
    let { notifyTeacher } = await load()
    await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })
    expect(pushes(log)).toHaveLength(0)
    expect(apns(log)).toHaveLength(0)
    expect(emails(log)).toHaveLength(1)

    vi.resetModules()
    log = mockAll({ settings: [{ push_urgent: true, email_urgent: false }], subs: [sub] })
    ;({ notifyTeacher } = await load())
    await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })
    expect(pushes(log)).toHaveLength(1)
    expect(apns(log)).toHaveLength(1)
    expect(emails(log)).toHaveLength(0)
  })

  it('deletes subscriptions the push service says are gone (404/410), keeps the rest', async () => {
    await configureAll()
    const log = mockAll({
      subs: [{ id: SUB1, ...(await makeSub('https://push.example/gone')) }, { id: SUB2, ...(await makeSub('https://push.example/ok')) }],
      pushStatus: { 'https://push.example/gone': 410 },
    })
    const { notifyTeacher } = await load()
    await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })
    const del = log.filter((l) => l.method === 'DELETE')
    expect(del).toHaveLength(1)
    expect(del[0].url).toContain(`/rest/v1/push_subscriptions?id=in.(${SUB1})`)
    expect(del[0].url).toContain(`user_id=eq.${TEACHER_ID}`)
  })

  it('with no keys at all: the bell row is written and nothing else is attempted', async () => {
    const log = mockAll({ subs: [{ id: SUB1, ...(await makeSub('https://push.example/a')) }] })
    const { notifyTeacher } = await load()
    const r = await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })
    expect(r.stored).toBe(true)
    expect(pushes(log)).toHaveLength(0)
    expect(emails(log)).toHaveLength(0)
    expect(apns(log)).toHaveLength(0)
    expect(log.some((l) => l.url.includes('/auth/v1/admin/users/'))).toBe(false)
  })

  it('never throws into the caller, even when every request fails', async () => {
    await configureAll()
    mockAll({ failAll: true })
    const { notifyTeacher } = await load()
    await expect(notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'help_grownup', classroom: classroom(), studentName: 'Ann', urgent: true })).resolves.toBeDefined()
  })

  it('ignores an unknown kind', async () => {
    const log = mockAll()
    const { notifyTeacher } = await load()
    expect(await notifyTeacher({ teacherUserId: TEACHER_ID, kind: 'feeling_sad', classroom: classroom() })).toEqual({ stored: false, fannedOut: false })
    expect(log).toHaveLength(0)
  })

  it('all_handed_in is not school-hours gated and is deduped per assignment', async () => {
    await configureAll()
    let log = mockAll()
    let { notifyTeacher } = await load()
    const args = { teacherUserId: TEACHER_ID, kind: 'all_handed_in', classroom: classroom({ school_hours: {} }), urgent: true, dedupKey: `all_handed_in:${ASSIGN_ID}`, payload: { assignment_id: ASSIGN_ID, assignment_title: 'My pet' } }
    expect((await notifyTeacher(args)).fannedOut).toBe(true)
    const row = bellRows(log)[0]
    expect(row.url).toContain('on_conflict=dedup_key')
    expect(row.headers.Prefer).toContain('resolution=ignore-duplicates')
    expect(row.body.dedup_key).toBe(`all_handed_in:${ASSIGN_ID}`)
    expect(emails(log)[0].body.subject).toBe('Everyone in Room 5 has handed in')

    // The same event a second time: the insert is ignored, so nothing is sent.
    vi.resetModules()
    log = mockAll({ insertReply: [] })
    ;({ notifyTeacher } = await load())
    expect(await notifyTeacher(args)).toEqual({ stored: false, fannedOut: false })
    expect(emails(log)).toHaveLength(0)
    expect(apns(log)).toHaveLength(0)
  })
})

describe('notifyHandIn', () => {
  const student = { id: 's1', display_name: 'Ann', classroom_id: CLASS_ID }
  const assignment = { id: ASSIGN_ID, title: 'My pet' }
  const kinds = (log) => bellRows(log).map((l) => l.body.kind)

  it.each([
    [{ version: 1 }, false, 'hand_in'],
    [{ version: 1 }, true, 'hand_in_late'],
    [{ version: 2 }, false, 'resubmit'],
    [{ version: 3 }, true, 'resubmit'],
  ])('%o late=%s → %s', async (submission, late, kind) => {
    const log = mockAll({ students: [{ id: 's1' }, { id: 's2' }], submissions: [{ student_id: 's1' }] })
    const { notifyHandIn } = await load()
    await notifyHandIn({ classroom: classroom(), student, assignment, submission: { id: 'sub', ...submission }, late })
    expect(kinds(log)).toEqual([kind])
    expect(bellRows(log)[0].body.payload).toMatchObject({ student_name: 'Ann', assignment_id: ASSIGN_ID, assignment_title: 'My pet' })
  })

  it('adds all_handed_in when every active student has now handed in', async () => {
    const log = mockAll({ students: [{ id: 's1' }, { id: 's2' }], submissions: [{ student_id: 's1' }, { student_id: 's2' }] })
    const { notifyHandIn } = await load()
    await notifyHandIn({ classroom: classroom(), student, assignment, submission: { id: 'sub', version: 1 }, late: false })
    expect(kinds(log)).toEqual(['hand_in', 'all_handed_in'])
    const st = log.find((l) => l.url.includes('/rest/v1/class_students'))
    expect(st.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(st.url).toContain('status=eq.active')
    expect(log.find((l) => l.url.includes('/rest/v1/class_submissions')).url).toContain(`assignment_id=eq.${ASSIGN_ID}`)
  })

  it('does not check "everyone in" on a resubmission (it cannot change the count)', async () => {
    const log = mockAll({ students: [{ id: 's1' }], submissions: [{ student_id: 's1' }] })
    const { notifyHandIn } = await load()
    await notifyHandIn({ classroom: classroom(), student, assignment, submission: { id: 'sub', version: 2 }, late: false })
    expect(kinds(log)).toEqual(['resubmit'])
  })

  it('no all_handed_in when a read fails or the roster is empty', async () => {
    let log = mockAll({ students: [], submissions: [] })
    let { notifyHandIn } = await load()
    await notifyHandIn({ classroom: classroom(), student, assignment, submission: { id: 'sub', version: 1 }, late: false })
    expect(kinds(log)).toEqual(['hand_in'])

    vi.resetModules()
    log = mockAll({ students: { message: 'boom' }, submissions: [] })
    ;({ notifyHandIn } = await load())
    await notifyHandIn({ classroom: classroom(), student, assignment, submission: { id: 'sub', version: 1 }, late: false })
    expect(kinds(log)).toEqual(['hand_in'])
  })
})
