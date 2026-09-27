// Client for the schools sign-in endpoints (api/school/roster.js,
// api/school/sign-in.js). Every response is normalised to
// `{ ok, status, data?, code? }` so callers never touch `Response` or
// `.json()` directly, and a network failure (offline, DNS, CORS) looks the
// same shape as a server error — just with no `code`, which
// ClassSignInPage's error-message map already falls back to "generic" for.
import { apiFetch, apiFetchAuthed } from './api.js'

// The remembered class code only — never a student's name or picture
// secret. Children share devices at school; forgetting who's who by default
// and only remembering the class itself keeps the next child from landing
// on the previous child's name tile.
const CLASS_CODE_KEY = 'mybooklab-class-code'

async function toResult(res) {
  let data = null
  try {
    data = await res.json()
  } catch {
    // No body (rare here — every documented response is JSON) or a body
    // that isn't valid JSON. Either way, fall through with data:null rather
    // than throwing out of a "the request succeeded" path.
  }
  if (res.ok) return { ok: true, status: res.status, data }
  return { ok: false, status: res.status, code: data?.code, data }
}

async function safeFetch(run) {
  try {
    return await toResult(await run())
  } catch {
    return { ok: false, status: 0, code: undefined }
  }
}

/**
 * GET /api/school/roster?code=... Unauthenticated — a child has no session
 * yet at this point in the flow.
 * @returns {Promise<{ok: boolean, status?: number, data?: {classroom, students}, code?: string}>}
 */
export function fetchRoster(code) {
  return safeFetch(() => apiFetch(`/api/school/roster?code=${encodeURIComponent(code ?? '')}`))
}

/**
 * POST /api/school/sign-in. Unauthenticated, same reason as fetchRoster.
 * @returns {Promise<{ok: boolean, status?: number, data?: {access_token, refresh_token, expires_in, expires_at}, code?: string}>}
 */
export function signInWithPictures({ code, studentId, pictures }) {
  return safeFetch(() =>
    apiFetch('/api/school/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId, pictures }),
    })
  )
}

/**
 * Authenticated JSON fetch for `/api/school/*` calls made once a student or
 * teacher already has a session (e.g. the check-in share Task 12 adds).
 * Built on apiFetchAuthed so it carries the Supabase bearer token the same
 * way every other authed call in the app does.
 */
export function schoolFetch(path, options = {}) {
  return safeFetch(() =>
    apiFetchAuthed(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  )
}

export function rememberClassCode(code) {
  try {
    localStorage.setItem(CLASS_CODE_KEY, code)
  } catch {
    // Private browsing / storage blocked: the code just won't be
    // remembered next time, which is a minor inconvenience, not a bug.
  }
}

export function recallClassCode() {
  try {
    return localStorage.getItem(CLASS_CODE_KEY)
  } catch {
    return null
  }
}

export function forgetClassCode() {
  try {
    localStorage.removeItem(CLASS_CODE_KEY)
  } catch {
    // ignore
  }
}
