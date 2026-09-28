// WebCrypto-only Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) and the
// APNs ES256 provider token. No npm server libraries: these run on Edge.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPairSync, verify as nodeVerify } from 'node:crypto'
import { b64uEncode, b64uDecode, signJwtES256, importP8 } from '../lib/notify/jwt.js'

const subtle = globalThis.crypto.subtle
const enc = (s) => new TextEncoder().encode(s)
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}

// Independent receiver-side decrypt (RFC 8291 §3.4 / RFC 8188), written
// from the RFC rather than shared with the sender, for the round trip.
async function decrypt(body, uaKeys, authSecret) {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ct = body.slice(21 + idlen)
  expect(rs).toBe(4096)
  const uaPublic = new Uint8Array(await subtle.exportKey('raw', uaKeys.publicKey))
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concat(enc('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12)
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct))
  let end = padded.length - 1
  while (padded[end] === 0) end--
  expect(padded[end]).toBe(2) // last-record delimiter
  return new TextDecoder().decode(padded.slice(0, end))
}

async function verifyEs256(jwt, publicKey) {
  const [h, c, s] = jwt.split('.')
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64uDecode(s), enc(`${h}.${c}`))
}

describe('base64url', () => {
  it('round-trips bytes without padding or +/', () => {
    const bytes = Uint8Array.from([251, 255, 191, 0, 1, 2, 3])
    const s = b64uEncode(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect([...b64uDecode(s)]).toEqual([...bytes])
  })
})

describe('signJwtES256', () => {
  it('produces a JWS whose r||s signature verifies with the public key', async () => {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwt = await signJwtES256({ alg: 'ES256', typ: 'JWT' }, { aud: 'https://push.example', exp: 1 }, kp.privateKey)
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(h)))).toEqual({ alg: 'ES256', typ: 'JWT' })
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(c)))).toEqual({ aud: 'https://push.example', exp: 1 })
    expect(b64uDecode(s)).toHaveLength(64)
    expect(await verifyEs256(jwt, kp.publicKey)).toBe(true)
  })
})

describe('importP8 (APNs .p8, PKCS8 PEM)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })

  it('imports a PEM and signs a token Node can verify (ieee-p1363 / JOSE form)', async () => {
    const key = await importP8(pem)
    const jwt = await signJwtES256({ alg: 'ES256', kid: 'KEY123' }, { iss: 'TEAM', iat: 1 }, key)
    const [h, c, s] = jwt.split('.')
    const ok = nodeVerify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64uDecode(s)))
    expect(ok).toBe(true)
  })

  it('accepts a PEM whose newlines were pasted as literal \\n (Vercel env UI)', async () => {
    const key = await importP8(pem.replace(/\n/g, '\\n'))
    expect(key.type).toBe('private')
  })
})

describe('Web Push encryption (RFC 8291)', () => {
  it('matches the RFC 8291 Appendix A test vector byte for byte', async () => {
    const { encryptPayload } = await import('../lib/notify/webpush.js')
    const asPublic = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
    const asPrivate = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'
    const pub = b64uDecode(asPublic)
    const jwk = { kty: 'EC', crv: 'P-256', x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33)), d: asPrivate }
    const localKeys = {
      privateKey: await subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
      publicKey: await subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    }
    const body = await encryptPayload('When I grow up, I want to be a watermelon', {
      p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    }, { localKeys, salt: b64uDecode('DGv6ra1nlYgDCS1FRnbzlw') })
    expect(b64uEncode(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
    )
  })

  it('round-trips: the browser side decrypts what we send', async () => {
    const { encryptPayload } = await import('../lib/notify/webpush.js')
    const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16))
    const sub = { p256dh: b64uEncode(new Uint8Array(await subtle.exportKey('raw', ua.publicKey))), auth: b64uEncode(authSecret) }
    const msg = JSON.stringify({ title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.' })
    const body = await encryptPayload(msg, sub)
    expect(await decrypt(body, ua, authSecret)).toBe(msg)
  })

  it('rejects malformed subscription keys', async () => {
    const { encryptPayload } = await import('../lib/notify/webpush.js')
    await expect(encryptPayload('x', { p256dh: 'AAAA', auth: 'BTBZMqHH6r4Tts7J_aSIgg' })).rejects.toThrow()
  })
})

describe('sendWebPush (VAPID)', () => {
  let vapid
  beforeEach(async () => {
    vi.resetModules()
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = await subtle.exportKey('jwk', kp.privateKey)
    vapid = { kp, pub: b64uEncode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), priv: jwk.d }
    process.env.VAPID_PUBLIC_KEY = vapid.pub
    process.env.VAPID_PRIVATE_KEY = vapid.priv
    process.env.VAPID_SUBJECT = 'mailto:hello@mybooklab.app'
  })
  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT
    vi.restoreAllMocks()
  })

  async function subscription() {
    const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16))
    return {
      ua, authSecret,
      sub: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        p256dh: b64uEncode(new Uint8Array(await subtle.exportKey('raw', ua.publicKey))),
        auth: b64uEncode(authSecret),
      },
    }
  }

  it('POSTs an aes128gcm body with a VAPID token signed for the endpoint origin', async () => {
    const calls = []
    globalThis.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }) })
    const { sendWebPush } = await import('../lib/notify/webpush.js')
    const { ua, authSecret, sub } = await subscription()
    const r = await sendWebPush(sub, { title: 'T', body: 'B' })
    expect(r).toMatchObject({ ok: true, gone: false })
    const { url, init } = calls[0]
    expect(url).toBe(sub.endpoint)
    expect(init.headers['Content-Encoding']).toBe('aes128gcm')
    expect(init.headers.TTL).toMatch(/^\d+$/)
    const m = init.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/)
    expect(m[2]).toBe(vapid.pub)
    expect(await verifyEs256(m[1], vapid.kp.publicKey)).toBe(true)
    const claims = JSON.parse(new TextDecoder().decode(b64uDecode(m[1].split('.')[1])))
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:hello@mybooklab.app')
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)
    expect(claims.exp).toBeLessThanOrEqual(Date.now() / 1000 + 24 * 3600)
    expect(JSON.parse(await decrypt(new Uint8Array(init.body), ua, authSecret))).toEqual({ title: 'T', body: 'B' })
  })

  it.each([404, 410])('reports %i as gone (the subscription expired)', async (status) => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status }))
    const { sendWebPush } = await import('../lib/notify/webpush.js')
    const r = await sendWebPush((await subscription()).sub, { title: 'T' })
    expect(r).toMatchObject({ ok: false, gone: true, status })
  })

  it('is a no-op that logs once when the VAPID keys are missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    globalThis.fetch = vi.fn()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { sendWebPush, vapidPublicKey } = await import('../lib/notify/webpush.js')
    const { sub } = await subscription()
    expect(await sendWebPush(sub, { title: 'T' })).toMatchObject({ skipped: true })
    expect(await sendWebPush(sub, { title: 'T' })).toMatchObject({ skipped: true })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    expect(vapidPublicKey()).toBeNull()
  })

  it('never throws on a network error', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sendWebPush } = await import('../lib/notify/webpush.js')
    expect(await sendWebPush((await subscription()).sub, { title: 'T' })).toMatchObject({ ok: false, gone: false })
  })
})
