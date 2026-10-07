// Atlas referral rows (migration 035). `sb` is a service-role PostgREST
// fetcher: sb(path, init) → Response (api/_school.js's sb, or a fake).
// Throws on an unexpected database answer; callers decide what that means.
import { generateCode } from './referral.js'

const T = '/rest/v1/atlas_referrals'
const C = '/rest/v1/atlas_referral_codes'
const REP = { Prefer: 'return=representation' }

const iso = (unix) => (Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null)
const enc = encodeURIComponent

// Once a row is being or has been reported (or a payment has been seen for
// it), its token is fixed: swapping it could get a second fee recorded for
// a call whose response was lost.
const LOCKED = new Set(['reporting', 'reported', 'failed_final'])
export const isLocked = (row) =>
  !!row && (LOCKED.has(row.report_status) || row.reported_at != null || row.external_ref != null)

async function rows(res, what) {
  if (!res.ok) throw new Error(`${what} ${res.status}`)
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data : []
}

export async function getReferral(sb, userId) {
  const r = await sb(`${T}?user_id=eq.${enc(userId)}&select=*`)
  return (await rows(r, 'atlas_referrals read'))[0] ?? null
}

export async function getReferralByExternalRef(sb, externalRef) {
  const r = await sb(`${T}?external_ref=eq.${enc(externalRef)}&select=*&limit=1`)
  return (await rows(r, 'atlas_referrals read'))[0] ?? null
}

/**
 * Attach rule (one row per account): keep the most recent valid token, and
 * NEVER overwrite a row that is reporting / reported / failed_final, has
 * reported_at, or already has a payment recorded against it.
 *
 * @returns {Promise<{ attached: boolean, reason: 'new'|'replaced'|'same'|'locked'|'older'|'nonce_in_use' }>}
 */
export async function attachReferral(sb, userId, token, payload, { now = new Date() } = {}) {
  const at = now.toISOString()
  const fields = {
    token, nonce: payload.n, atlas_uid: String(payload.uid).slice(0, 200),
    token_iat: iso(payload.iat), token_exp: iso(payload.exp), attached_at: at, updated_at: at,
  }
  let existing = await getReferral(sb, userId)
  if (!existing) {
    const r = await sb(T, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, captured_at: at, ...fields }) })
    if (r.ok) return { attached: true, reason: 'new' }
    if (r.status !== 409) throw new Error(`atlas_referrals insert ${r.status}`)
    // Either a concurrent attach for this account won, or another account
    // already holds this nonce (a token is single-use).
    existing = await getReferral(sb, userId)
    if (!existing) return { attached: false, reason: 'nonce_in_use' }
  }
  if (existing.nonce === payload.n) return { attached: true, reason: 'same' }
  if (isLocked(existing)) return { attached: false, reason: 'locked' }
  if (existing.token_iat && Number.isFinite(payload.iat) && Date.parse(existing.token_iat) > payload.iat * 1000) {
    return { attached: false, reason: 'older' }
  }
  const r = await sb(
    `${T}?user_id=eq.${enc(userId)}&report_status=eq.pending&external_ref=is.null&reported_at=is.null`,
    { method: 'PATCH', headers: REP, body: JSON.stringify(fields) }
  )
  if (r.status === 409) return { attached: false, reason: 'nonce_in_use' }
  const hit = await rows(r, 'atlas_referrals update')
  return hit.length ? { attached: true, reason: 'replaced' } : { attached: false, reason: 'locked' }
}

// ── iOS codes ───────────────────────────────────────────────────────────

/// The code for this token's nonce: reused if one exists, else created.
/// Null if none could be made (the caller still sets the cookie).
export async function codeForToken(sb, token, payload) {
  const byNonce = async () => (await rows(await sb(`${C}?nonce=eq.${enc(payload.n)}&select=code`), 'codes read'))[0]?.code ?? null
  const found = await byNonce()
  if (found) return found
  for (let i = 0; i < 4; i++) {
    const code = generateCode()
    const r = await sb(C, {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code, token, nonce: payload.n, expires_at: iso(payload.exp) }),
    })
    if (r.ok) return code
    if (r.status !== 409) throw new Error(`codes insert ${r.status}`)
    const raced = await byNonce() // same nonce inserted concurrently, or a code collision
    if (raced) return raced
  }
  return null
}

/// An unexpired, unredeemed code row, or null.
export async function findLiveCode(sb, code, { now = new Date() } = {}) {
  const r = await sb(`${C}?code=eq.${enc(code)}&redeemed_at=is.null&expires_at=gt.${enc(now.toISOString())}&select=code,token,nonce,expires_at`)
  return (await rows(r, 'codes read'))[0] ?? null
}

/// Single-use: only one caller's conditional update matches.
export async function claimCode(sb, code, userId, { now = new Date() } = {}) {
  const r = await sb(`${C}?code=eq.${enc(code)}&redeemed_at=is.null&expires_at=gt.${enc(now.toISOString())}`, {
    method: 'PATCH', headers: REP, body: JSON.stringify({ redeemed_at: now.toISOString(), redeemed_by: userId }),
  })
  return (await rows(r, 'codes claim')).length === 1
}

/// Undo claimCode after a failure that wasn't the user's fault.
export async function releaseCode(sb, code, userId) {
  await sb(`${C}?code=eq.${enc(code)}&redeemed_by=eq.${enc(userId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ redeemed_at: null, redeemed_by: null }),
  }).catch(() => {})
}
