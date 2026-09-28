// Web Push to a teacher's browser: RFC 8291 payload encryption (aes128gcm,
// RFC 8188) and RFC 8292 VAPID, with WebCrypto only so it runs on Edge.
//
// Env: VAPID_PUBLIC_KEY (base64url, 65-byte uncompressed P-256 point),
// VAPID_PRIVATE_KEY (base64url, 32-byte scalar), VAPID_SUBJECT
// ("mailto:hello@mybooklab.app"). Missing any → a logged no-op.
import { b64uEncode, b64uDecode, concatBytes, signJwtES256, importRawP256Private } from './jwt.js'
import { infoOnce } from './log.js'

const subtle = () => globalThis.crypto.subtle
const utf8 = (s) => new TextEncoder().encode(s)
const RECORD_SIZE = 4096
const TIMEOUT_MS = 5000

function config() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

// What the browser needs to subscribe; null hides the "turn on alerts" button.
export function vapidPublicKey() {
  return config()?.publicKey ?? null
}

async function hkdf(salt, ikm, info, length) {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/**
 * Encrypts one push message for a subscription (single record, RFC 8291 §3).
 * `localKeys` and `salt` are injectable only so the RFC's test vector can be
 * reproduced; production always uses a fresh ECDH pair and random salt.
 */
export async function encryptPayload(plaintext, { p256dh, auth }, { localKeys, salt } = {}) {
  const uaPublic = b64uDecode(p256dh)
  const authSecret = b64uDecode(auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad p256dh')
  if (authSecret.length !== 16) throw new Error('bad auth secret')

  const keys = localKeys ?? (await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const asPublic = new Uint8Array(await subtle().exportKey('raw', keys.publicKey))
  const uaKey = await subtle().importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: uaKey }, keys.privateKey, 256))

  const ikm = await hkdf(authSecret, ecdhSecret, concatBytes(utf8('WebPush: info\0'), uaPublic, asPublic), 32)
  const s = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(s, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(s, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const data = utf8(plaintext)
  // 16-byte tag + 1 delimiter byte must fit the single record.
  if (data.length + 17 > RECORD_SIZE) throw new Error('payload too large')
  const aes = await subtle().importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: nonce }, aes, concatBytes(data, Uint8Array.of(2)))
  )

  // Header: salt(16) | rs(4, big-endian) | idlen(1) | keyid(as_public, 65)
  const header = new Uint8Array(21)
  header.set(s, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  return concatBytes(header, asPublic, ciphertext)
}

let cachedKey = null // { raw, key }
async function signingKey(cfg) {
  const raw = `${cfg.publicKey}.${cfg.privateKey}`
  if (cachedKey?.raw !== raw) cachedKey = { raw, key: await importRawP256Private(cfg.publicKey, cfg.privateKey) }
  return cachedKey.key
}

/**
 * Sends one message to one subscription {endpoint, p256dh, auth}.
 * Never throws. `gone` (404/410) means the browser dropped the subscription
 * and the caller should delete it.
 */
export async function sendWebPush(sub, message, { ttl = 3600, urgency = 'high' } = {}) {
  const cfg = config()
  if (!cfg) {
    infoOnce('webpush', '[notify] web push not configured (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT); skipping')
    return { ok: false, skipped: true, gone: false }
  }
  try {
    const aud = new URL(sub.endpoint).origin
    const jwt = await signJwtES256(
      { typ: 'JWT', alg: 'ES256' },
      { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: cfg.subject },
      await signingKey(cfg)
    )
    const body = await encryptPayload(JSON.stringify(message), sub)
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${cfg.publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: urgency,
      },
      body,
      // A push service never redirects; following one would send our VAPID
      // token and payload somewhere we didn't validate.
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 }
  } catch (e) {
    console.error('[notify] web push failed:', e?.message)
    return { ok: false, status: 0, gone: false }
  }
}

