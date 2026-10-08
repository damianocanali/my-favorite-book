// Atlas Mind Academy referrals, web side. Nothing here ever blocks
// rendering or shows an error: a referral that can't be captured is simply
// not captured.
//
//   captureReferralFromUrl()  on app load: ?ref=<token> → POST
//                             /api/referral/capture, then strip `ref` from
//                             the address bar (other params kept).
//   attachReferralIfPending() after any sign-in / sign-up (email or OAuth):
//                             POST /api/referral/attach once, if a capture
//                             set the (httpOnly) cookie on this device.
//
// The token itself lives only in the httpOnly cookie; JS keeps a "pending"
// flag (it can't read the cookie) and the display code for the iOS note.
import { apiFetchAuthed } from './api'

const PENDING_KEY = 'mbl_atlas_pending'
const CODE_KEY = 'mbl_atlas_code'
const DISMISS_KEY = 'mbl_atlas_code_dismissed'
export const CODE_EVENT = 'mbl-atlas-code'

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

// Only a value shaped like an Atlas token (<base64url>.<base64url>) is
// ours. Other `ref` values — e.g. worksheet QR links (/?ref=worksheet-<id>)
// — are left alone, in the URL and unsent.
export const ATLAS_REF_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
export const isAtlasRef = (v) => typeof v === 'string' && v.length <= 2048 && ATLAS_REF_RE.test(v)

/// Removes `ref` from a URL string, keeping every other param and the hash.
export function stripRefParam(href) {
  const u = new URL(href)
  if (!u.searchParams.has('ref')) return null
  u.searchParams.delete('ref')
  return `${u.pathname}${u.search}${u.hash}`
}

let captured = false
export async function captureReferralFromUrl({ win = window, fetchImpl = apiFetchAuthed } = {}) {
  if (captured) return
  captured = true
  let ref
  try {
    ref = new URL(win.location.href).searchParams.get('ref')
    if (!isAtlasRef(ref)) return
    const clean = stripRefParam(win.location.href)
    // Keep react-router's history state, so its back/forward bookkeeping holds.
    if (clean != null) win.history.replaceState(win.history.state, '', clean)
  } catch {
    return
  }
  try {
    const res = await fetchImpl('/api/referral/capture', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    })
    if (res.status !== 200) return
    const data = await res.json().catch(() => null)
    if (data?.attached !== undefined) return // signed in: attached already
    store.set(PENDING_KEY, '1')
    if (typeof data?.code === 'string' && data.code) {
      store.set(CODE_KEY, data.code)
      store.del(DISMISS_KEY)
      try { win.dispatchEvent(new Event(CODE_EVENT)) } catch { /* old browsers */ }
    }
  } catch { /* silent by design */ }
}

const attachedFor = new Set()
export async function attachReferralIfPending(userId, { fetchImpl = apiFetchAuthed } = {}) {
  if (!userId || attachedFor.has(userId) || store.get(PENDING_KEY) !== '1') return
  attachedFor.add(userId)
  try {
    const res = await fetchImpl('/api/referral/attach', { method: 'POST', credentials: 'include' })
    // 5xx: keep the flag so the next sign-in tries again. 401/403 (a class
    // account on a shared device): keep it for the family's own sign-in.
    if (res.status === 200 || res.status === 204) {
      store.del(PENDING_KEY)
      store.del(CODE_KEY)
    }
  } catch {
    attachedFor.delete(userId)
  }
}

export const readReferralCode = () => (store.get(DISMISS_KEY) === '1' ? null : store.get(CODE_KEY))
export const dismissReferralCode = () => store.set(DISMISS_KEY, '1')

export function _resetForTests() { captured = false; attachedFor.clear() }
