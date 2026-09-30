// Pure helpers behind the teacher bell, the "turn on alerts" button and the
// service worker (no DOM in this suite; the components are exercised by
// hand and by `npx vite build`, same convention as school-teacher-web).
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  notificationText, notificationHref, urlBase64ToUint8Array, pushSupport, unreadBadge, bellActionError,
} from '../src/lib/teacherNotifications.js'

const t = (key, vars) => `${key}|${JSON.stringify(vars ?? {})}`
const n = (kind, payload = {}, extra = {}) => ({
  id: 'n1', kind, classroom_id: 'c1', created_at: '2026-09-27T10:00:00Z', read_at: null,
  payload: { student_name: 'Ann', class_name: 'Room 5', ...payload }, ...extra,
})

describe('notificationText', () => {
  it.each([
    ['hand_in', 'school:notifications.kinds.hand_in'],
    ['hand_in_late', 'school:notifications.kinds.hand_in_late'],
    ['resubmit', 'school:notifications.kinds.resubmit'],
    ['all_handed_in', 'school:notifications.kinds.all_handed_in'],
    ['help_book', 'school:notifications.kinds.help_book'],
    ['help_grownup', 'school:notifications.kinds.help_grownup'],
  ])('%s uses its own localized string with the names', (kind, key) => {
    const out = notificationText(t, n(kind, { assignment_title: 'My pet' }))
    expect(out.startsWith(`${key}|`)).toBe(true)
    expect(JSON.parse(out.split('|')[1])).toEqual({ student: 'Ann', className: 'Room 5', assignment: 'My pet' })
  })

  it('a student who is no longer on the roster reads as "a student"', () => {
    const tt = (key, vars) => (vars ? `${key}:${vars.student}` : `<${key}>`)
    const out = notificationText(tt, n('hand_in', { student_name: null, assignment_title: 'My pet' }))
    expect(out).toBe('school:notifications.kinds.hand_in:<school:notifications.unknown_student>')
  })

  it('falls back to a generic line for an unknown kind', () => {
    expect(notificationText(t, n('mystery')).startsWith('school:notifications.kinds.generic|')).toBe(true)
  })
})

describe('notificationHref', () => {
  it('help asks open the dashboard', () => {
    expect(notificationHref(n('help_grownup'))).toBe('/teacher')
    expect(notificationHref(n('help_book'))).toBe('/teacher')
  })
  it.each(['hand_in', 'hand_in_late', 'resubmit', 'all_handed_in'])('%s opens that assignment\'s review', (kind) => {
    expect(notificationHref(n(kind, { assignment_id: 'a1' }))).toBe('/teacher/class/c1?review=a1')
  })
  it('a hand-in without ids falls back to the dashboard', () => {
    expect(notificationHref(n('hand_in'))).toBe('/teacher')
    expect(notificationHref(n('hand_in', { assignment_id: 'a1' }, { classroom_id: null }))).toBe('/teacher')
  })
  it('never builds a link from unsafe ids', () => {
    expect(notificationHref(n('hand_in', { assignment_id: '../../x' }))).toBe('/teacher')
  })
})

describe('unreadBadge', () => {
  it('hides 0, shows the count, caps at 9+', () => {
    expect(unreadBadge(0)).toBeNull()
    expect(unreadBadge(undefined)).toBeNull()
    expect(unreadBadge(3)).toBe('3')
    expect(unreadBadge(10)).toBe('9+')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes a VAPID key to its 65 raw bytes', () => {
    const key = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})

describe('pushSupport', () => {
  const env = (over = {}) => ({
    isNative: false,
    hasServiceWorker: true,
    hasPushManager: true,
    permission: 'default',
    ...over,
  })
  it('unsupported inside the native app or without SW/Push', () => {
    expect(pushSupport(env({ isNative: true }))).toBe('unsupported')
    expect(pushSupport(env({ hasServiceWorker: false }))).toBe('unsupported')
    expect(pushSupport(env({ hasPushManager: false }))).toBe('unsupported')
    expect(pushSupport(env({ permission: undefined }))).toBe('unsupported')
  })
  it('reports the browser permission otherwise', () => {
    expect(pushSupport(env())).toBe('default')
    expect(pushSupport(env({ permission: 'granted' }))).toBe('granted')
    expect(pushSupport(env({ permission: 'denied' }))).toBe('denied')
  })
})

describe('public/sw.js', () => {
  const src = readFileSync('public/sw.js', 'utf8')

  it('handles push and notificationclick only — no fetch handler, no caching', () => {
    expect(src).toMatch(/addEventListener\(\s*['"]push['"]/)
    expect(src).toMatch(/addEventListener\(\s*['"]notificationclick['"]/)
    expect(src).not.toMatch(/addEventListener\(\s*['"]fetch['"]/)
    expect(src).not.toMatch(/caches\./)
  })

  function loadSw(clients = []) {
    const listeners = {}
    const shown = []
    const opened = []
    const self = {
      addEventListener: (type, fn) => { listeners[type] = fn },
      registration: { showNotification: vi.fn(async (title, opts) => shown.push({ title, opts })) },
      clients: { matchAll: vi.fn(async () => clients), openWindow: vi.fn(async (u) => opened.push(u)) },
      location: { origin: 'https://mybooklab.app' },
    }
    new Function('self', src)(self)
    const click = async (url) => {
      let waited
      const close = vi.fn()
      listeners.notificationclick({ notification: { close, data: { url } }, waitUntil: (p) => { waited = p } })
      await waited
      return close
    }
    return { listeners, shown, opened, click }
  }
  const client = (url, { navigateFails = false } = {}) => {
    const c = { url, focused: false, navigatedTo: null }
    c.focus = vi.fn(async () => { c.focused = true; return c })
    c.navigate = vi.fn(async (u) => {
      if (navigateFails) throw new TypeError('not controlled')
      c.navigatedTo = u
      return c
    })
    return c
  }

  it('shows the pushed title/body', async () => {
    const { listeners, shown } = loadSw()
    let waited
    listeners.push({ data: { json: () => ({ title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', tag: 'x' }) }, waitUntil: (p) => { waited = p } })
    await waited
    expect(shown[0]).toMatchObject({ title: 'My Book Lab', opts: { body: 'Ann in Room 5 asked for a grown-up.', tag: 'x', data: { url: '/teacher' } } })
  })

  it.each([
    ['https://evil.example/', '/teacher'],
    ['//evil.example/x', '/teacher'],
    ['javascript:alert(1)', '/teacher'],
    [undefined, '/teacher'],
    ['/teacher/class/c1?review=a1', '/teacher/class/c1?review=a1'],
    ['https://mybooklab.app/teacher?x=1', '/teacher?x=1'],
  ])('click on %s opens %s (same origin only) when no window is open', async (url, expected) => {
    const { opened, click } = loadSw([])
    const close = await click(url)
    expect(close).toHaveBeenCalled()
    expect(opened).toEqual([expected])
  })

  it('prefers an open /teacher window: navigates it there and focuses it', async () => {
    const other = client('https://mybooklab.app/bookshelf')
    const teacher = client('https://mybooklab.app/teacher/classes')
    const { opened, click } = loadSw([other, teacher])
    await click('/teacher/class/c1?review=a1')
    expect(teacher.navigatedTo).toBe('/teacher/class/c1?review=a1')
    expect(teacher.focused).toBe(true)
    expect(other.navigate).not.toHaveBeenCalled()
    expect(opened).toEqual([])
  })

  it('falls back to a new window when navigating the open one fails', async () => {
    const teacher = client('https://mybooklab.app/teacher', { navigateFails: true })
    const { opened, click } = loadSw([teacher])
    await click('/teacher')
    expect(opened).toEqual(['/teacher'])
  })
})

describe('bellActionError (the bell\'s remove / clear-all failure banner)', () => {
  const tt = (key) => key

  it('is null when the delete worked (or there is no result)', () => {
    expect(bellActionError(tt, 'clear', { ok: true, status: 200 })).toBeNull()
    expect(bellActionError(tt, 'remove', undefined)).toBeNull()
  })

  it('names the failed action for network / upstream / bad-request failures', () => {
    expect(bellActionError(tt, 'clear', { ok: false, status: 0 })).toBe('school:notifications.clear_failed')
    expect(bellActionError(tt, 'clear', { ok: false, status: 400, code: 'bad_request' })).toBe('school:notifications.clear_failed')
    expect(bellActionError(tt, 'remove', { ok: false, status: 502, code: 'upstream' })).toBe('school:notifications.remove_failed')
  })

  it('says the session ended on a 401', () => {
    expect(bellActionError(tt, 'clear', { ok: false, status: 401 })).toBe('school:notifications.session_ended')
  })

  it('keeps the wording of a code the teacher can act on', () => {
    expect(bellActionError(tt, 'remove', { ok: false, status: 429, code: 'rate_limited' })).toBe('school:teacher.errors.rate_limited')
  })

  it('every message it can return exists in EN and IT', () => {
    const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
    const it_ = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))
    for (const k of ['clear_failed', 'remove_failed', 'session_ended', 'error_dismiss']) {
      expect(typeof en.notifications[k]).toBe('string')
      expect(typeof it_.notifications[k]).toBe('string')
    }
  })
})
