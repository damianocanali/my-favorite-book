// Shared mock for the assignments-era school endpoint tests. Same shape as
// the copy in tests/school-students.test.js: logs every fetch and answers
// with the first route whose method matches and whose `match` is a
// substring of the URL. `reply` may be { status, body } or a function of the
// just-logged call.
import { vi } from 'vitest'

export const URL_ = 'https://example.supabase.co'
export const TEACHER = { id: 'teacher-1', app_metadata: {} }
export const STUDENT_USER = { id: 'kid-auth-1', app_metadata: { role: 'student', student_id: '6f1c1b1e-0000-4000-8000-0000000000a1' } }

export const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
export const STUDENT_ID = '6f1c1b1e-0000-4000-8000-0000000000a1'
export const STUDENT2_ID = '6f1c1b1e-0000-4000-8000-0000000000a2'
export const ASSIGN_ID = '6f1c1b1e-0000-4000-8000-0000000000b1'
export const ASSIGN2_ID = '6f1c1b1e-0000-4000-8000-0000000000b2'
export const SUB_ID = '6f1c1b1e-0000-4000-8000-0000000000c1'
export const FEEDBACK_ID = '6f1c1b1e-0000-4000-8000-0000000000d1'

export function setEnv() {
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
}

export function mockSupabase({ user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    log.push({ method, url: u, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
    for (const r of routes) {
      if (r.method === method && u.includes(r.match)) {
        const next = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
        return new Response(JSON.stringify(next.body ?? []), { status: next.status ?? 200 })
      }
    }
    return new Response('[]')
  })
  return log
}

export const classroomRow = {
  id: CLASS_ID, code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: true,
  timezone: 'America/New_York', school_hours: {}, archived_at: null,
}
// requireClassOwner's lookup.
export const ownerRoute = { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [classroomRow] } }
export const notOwnerRoute = { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [] } }

// requireStudent's lookup.
export const studentSelfRoute = {
  method: 'GET',
  match: '/rest/v1/class_students?auth_user_id=eq.',
  reply: {
    body: [{
      id: STUDENT_ID, classroom_id: CLASS_ID, display_name: 'Ann',
      classrooms: { id: CLASS_ID, name: 'Room 5', timezone: 'America/New_York', school_hours: {}, owner_user_id: 'teacher-1', archived_at: null },
    }],
  },
}

export function req(path, { method = 'GET', body, query = '' } = {}) {
  return new Request(`https://app.test/api/school/${path}${query}`, {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export const err500 = (method, match) => ({ method, match, reply: { status: 500, body: {} } })
