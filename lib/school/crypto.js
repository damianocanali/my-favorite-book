import { PICTURE_IDS } from './pictures.js'

// Characters that are unambiguous to read aloud and type (no 0/O, 1/I).
// 32 symbols, so `byte & 31` is an unbiased draw from a random byte.
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[A-Z0-9]{6,8}$/

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function generateClassCode() {
  return [...randomBytes(6)].map((b) => CODE_CHARS[b & 31]).join('')
}

// 16 pictures, so `byte & 15` is unbiased. Server-generated, never chosen by
// the child: children pick "cat cat cat", which collapses the space.
export function generatePictureSecret() {
  return [...randomBytes(3)].map((b) => PICTURE_IDS[b & 15])
}

export function isValidPictureSecret(p) {
  return Array.isArray(p) && p.length === 3 && p.every((x) => PICTURE_IDS.includes(x))
}

async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)))
}

// With 4,096 possible secrets a salted hash alone is useless offline. The
// protection against a database-only leak is the pepper, which lives in
// Vercel env and never in Postgres.
export function hashPictureSecret(pepper, studentId, pictures) {
  return hmacHex(pepper, `v1|${studentId}|${pictures.join(',')}`)
}

export function hashIp(pepper, ip) {
  return hmacHex(pepper, `ip|${ip}`)
}

export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// `.invalid` is reserved (RFC 2606) and can never route mail. No name in it.
export function syntheticStudentEmail() {
  return `s-${crypto.randomUUID()}@students.mybooklab.invalid`
}

// A password no child ever sets or sees, and never the same one twice:
// sign-in mints sessions via magic-link verification, never this password.
// Rotated on every picture reset and every successful sign-in so a password
// set through supabase.auth.updateUser by an already-signed-in session
// (bypassing the picture throttle entirely) is wiped before it can be reused.
export function randomPassword() {
  const b = crypto.getRandomValues(new Uint8Array(48))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
