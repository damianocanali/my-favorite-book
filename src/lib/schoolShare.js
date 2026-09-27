// Sends a copy of a class (student) account's check-in to their teacher —
// owner decision D7 (spec §5a). Consumer (family) check-ins must NEVER
// leave the device: tests/checkin-network.test.js enforces that on the
// on-device check-in store and its pure-logic module, and this file is
// deliberately kept outside that fence by not importing either of them (it
// takes an already-completed { feeling, need? } entry as a plain object,
// never the store itself) — the same test pins that too, by name, so this
// paragraph must not spell out either module's actual path or export name.
// CheckInHost is the only caller, and it calls these fire-and-forget: a
// failure here must never surface to the child, only to the console.
import { apiFetchAuthed } from './api'

// The one gate every function below defers to. app_metadata is set only by
// trusted server code (mirrors api/_school.js's own isStudent and
// useAuthStore's selectIsStudent) — a signed-in student can never write it
// themselves, unlike user_metadata, which a parent or child's own browser
// could edit. Trusting user_metadata here would let a consumer account spoof
// its way into having its check-ins sent to a "teacher" that doesn't exist,
// or worse, silently defeat the on-device-only guarantee for a family child.
export function shouldShare(user) {
  return user?.app_metadata?.role === 'student'
}

/**
 * POSTs a completed check-in to /api/school/checkin (Task 8) for a student
 * account only. A no-op for anyone else — including a spoofed user_metadata
 * role — and for a signed-out caller.
 * @param {{feeling: string, need?: string}} entry
 * @param {object|null} user
 * @returns {Promise<boolean>} whether a copy was actually sent
 */
export async function shareCheckIn(entry, user) {
  if (!shouldShare(user)) return false
  const body = { feeling: entry?.feeling }
  if (entry?.need !== undefined) body.need = entry.need
  try {
    const res = await apiFetchAuthed('/api/school/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // A hung request on slow wifi must not hang forever — 8s and this
      // rejects with an AbortError, which the catch below turns into a
      // normal `false` return, same as any other failure.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.warn('schoolShare: teacher copy of check-in was not saved', res.status)
    return res.ok
  } catch (err) {
    console.warn('schoolShare: teacher copy of check-in failed to send', err)
    return false
  }
}

/**
 * POSTs a help ask to /api/school/help (Task 8) for a student account only.
 * Never throws — a network failure or a non-2xx response both resolve to
 * `{ ok: false }` so a caller can always safely branch on the result rather
 * than needing its own try/catch (TeacherHelpScreen's "tell a grown-up near
 * you" copy is exactly that branch, for the one ask — 'grownup' — where a
 * failure has to reach the child instead of being swallowed).
 * @param {'book'|'grownup'} kind
 * @param {object|null} user
 * @returns {Promise<{ok: boolean, id?: string, inHours?: boolean}>}
 */
export async function askForHelp(kind, user) {
  if (!shouldShare(user)) return { ok: false }
  try {
    const res = await apiFetchAuthed('/api/school/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
      // Same reasoning as shareCheckIn: a request that never comes back
      // must still resolve to a real, displayable end-state (TeacherHelpScreen's
      // "failed" copy) rather than leaving "I need a grown-up" stuck showing
      // a pending message forever on slow wifi.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn('schoolShare: help ask was not sent', res.status)
      return { ok: false }
    }
    const data = await res.json()
    return { ok: true, id: data.id, inHours: data.in_hours }
  } catch (err) {
    console.warn('schoolShare: help ask failed to send', err)
    return { ok: false }
  }
}

/**
 * Polls whether the teacher has seen an open help ask, via GET
 * /api/school/help?id= (Task 8). The endpoint itself already requires a
 * student session server-side, so there's no user to gate on here — only an
 * id, which only ever comes from this student's own askForHelp('grownup')
 * result.
 * @param {string} id
 * @returns {Promise<{seen: boolean, teacherName: string|null}>}
 */
export async function pollHelpSeen(id) {
  try {
    const res = await apiFetchAuthed(`/api/school/help?id=${encodeURIComponent(id)}`)
    if (!res.ok) return { seen: false, teacherName: null }
    const data = await res.json()
    return { seen: !!data.seen, teacherName: data.teacher_name ?? null }
  } catch {
    return { seen: false, teacherName: null }
  }
}
