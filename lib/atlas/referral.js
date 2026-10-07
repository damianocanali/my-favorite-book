// Atlas Mind Academy referral tokens (partner contract, FIXED — Atlas is
// already deployed; never change the format here):
//
//   token = base64url(payloadJson) + "." + base64url(HMAC_SHA256(secret, base64urlBodyString))
//   payload = { uid, p: "mybooklab", iat, exp, n }   (unix seconds; n = 32-hex single-use nonce)
//
// Web Crypto only, so this runs on Vercel Edge (no node:crypto) and in Node
// (tests, the Node-runtime cron). No Buffer.
//
// SECRETS: ATLAS_REFERRAL_SECRET and PARTNER_CALLBACK_SECRET are server-only.
// Never log them, a token, or a token's signature — log noncePrefix() only.

const enc = new TextEncoder()
const B64URL_RE = /^[A-Za-z0-9_-]+$/

/// base64url → bytes, strict (no padding, no other characters). Null when
/// the string isn't base64url.
export function base64urlToBytes(s) {
  if (typeof s !== 'string' || !s || !B64URL_RE.test(s) || s.length % 4 === 1) return null
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export function bytesToBase64url(bytes) {
  let bin = ''
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/// Constant-time string compare (same length required; length is not secret).
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function hmacBase64url(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bytesToBase64url(new Uint8Array(sig))
}

/**
 * Port of Atlas's reference verifier. Returns the payload, or null for any
 * defect (bad shape, bad signature, bad JSON, wrong partner, missing fields,
 * expired unless opts.ignoreExpiry). Never throws.
 *
 * @param {string} token
 * @param {string} secret  ATLAS_REFERRAL_SECRET
 * @param {{ ignoreExpiry?: boolean, now?: number }} [opts]  now: unix seconds (tests)
 */
export async function verifyAtlasReferral(token, secret, opts = {}) {
  try {
    if (typeof token !== 'string' || !secret || token.length > 2048) return null
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [body, sig] = parts
    if (!body || !sig) return null
    const expected = await hmacBase64url(secret, body)
    if (!safeEqual(sig, expected)) return null
    const bytes = base64urlToBytes(body)
    if (!bytes) return null
    let payload
    try {
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      return null
    }
    if (!payload || typeof payload !== 'object') return null
    if (!payload.uid || !payload.n || payload.p !== 'mybooklab' || !payload.exp) return null
    const now = opts.now ?? Math.floor(Date.now() / 1000)
    if (!opts.ignoreExpiry && payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}

/// Server config. `secret` alone turns capture/attach/codes on; reporting
/// also needs the callback secret and base URL. Never returned to a client.
export function atlasConfig(env = process.env) {
  const secret = env.ATLAS_REFERRAL_SECRET || ''
  const callbackSecret = env.PARTNER_CALLBACK_SECRET || ''
  const baseUrl = (env.ATLAS_BASE_URL || '').replace(/\/+$/, '')
  return {
    secret: secret || null,
    capture: !!secret,
    callbacks: !!(secret && callbackSecret && baseUrl),
    callbackSecret: callbackSecret || null,
    baseUrl: baseUrl || null,
  }
}

/// The only token-derived thing that may appear in a log line.
export function noncePrefix(n) {
  return typeof n === 'string' ? `${n.slice(0, 6)}…` : '?'
}

// ── iOS codes ───────────────────────────────────────────────────────────
// 8 characters, Crockford-style alphabet without the ambiguous 0 O 1 I L U.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LENGTH = 8
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

export function generateCode() {
  const out = []
  const max = 256 - (256 % CODE_ALPHABET.length) // rejection sampling: no modulo bias
  while (out.length < CODE_LENGTH) {
    const buf = crypto.getRandomValues(new Uint8Array(16))
    for (const b of buf) {
      if (b < max && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length])
    }
  }
  return out.join('')
}

/// "k7m4-q2xp " → "K7M4Q2XP"; null when it can't be a code.
export function normalizeCode(raw) {
  if (typeof raw !== 'string' || raw.length > 40) return null
  const s = raw.toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(s) ? s : null
}

export const formatCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`

// ── cookie ──────────────────────────────────────────────────────────────
export const COOKIE_NAME = 'mbl_atlas_ref'
export const MAX_AGE_S = 30 * 86400

export function readCookie(req, name = COOKIE_NAME) {
  const raw = req.headers.get?.('cookie') || ''
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null
  }
  return null
}

export function setCookieHeader(token, maxAge) {
  return `${COOKIE_NAME}=${token}; Max-Age=${Math.max(0, Math.floor(maxAge))}; Path=/; HttpOnly; Secure; SameSite=Lax`
}

export const clearCookieHeader = () => `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
