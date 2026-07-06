import { describe, it, expect, afterEach } from 'vitest'
import { createHash, createSign, generateKeyPairSync } from 'node:crypto'
import {
  decodeCbor,
  derToRawSignature,
  verifyAssertionSignature,
  base64ToBytes,
  pemToDer,
  dailyCapFor,
  hourlyLimitFor,
  classifyAttestation,
} from '../api/_appAttest.js'

const APP_ID = 'G53XBRCRVU.com.myfavoritebook.app'

// ── Tiny CBOR encoder (tests only) ──────────────────────────────────────────
function cborBytes(buf) {
  const len = buf.length
  const head =
    len < 24 ? Buffer.from([0x40 + len])
    : len < 256 ? Buffer.from([0x58, len])
    : Buffer.from([0x59, len >> 8, len & 0xff])
  return Buffer.concat([head, buf])
}
function cborText(s) {
  const buf = Buffer.from(s, 'utf8')
  const head = buf.length < 24 ? Buffer.from([0x60 + buf.length]) : Buffer.from([0x78, buf.length])
  return Buffer.concat([head, buf])
}
function cborAssertion(signature, authData) {
  return new Uint8Array(Buffer.concat([
    Buffer.from([0xa2]), // map(2)
    cborText('signature'), cborBytes(signature),
    cborText('authenticatorData'), cborBytes(authData),
  ]))
}

// ── Synthetic device ─────────────────────────────────────────────────────────
function makeDevice() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return { spki: new Uint8Array(publicKey.export({ type: 'spki', format: 'der' })), privateKey }
}

function makeAuthData({ appId = APP_ID, counter = 1 } = {}) {
  const rpIdHash = createHash('sha256').update(appId).digest()
  const flags = Buffer.from([0x40])
  const counterBuf = Buffer.alloc(4)
  counterBuf.writeUInt32BE(counter)
  return Buffer.concat([rpIdHash, flags, counterBuf])
}

function signAssertion(device, authData, body) {
  const clientDataHash = createHash('sha256').update(body).digest()
  const nonce = createHash('sha256').update(Buffer.concat([authData, clientDataHash])).digest()
  const signer = createSign('sha256')
  signer.update(nonce)
  return signer.sign(device.privateKey) // DER
}

const BODY = new Uint8Array(Buffer.from(JSON.stringify({ prompt: 'a dragon bakes cookies' })))

function validParams(device, { counter = 5, previousCounter = 4, body = BODY, appId = APP_ID } = {}) {
  const authData = makeAuthData({ counter, appId })
  return {
    assertion: cborAssertion(signAssertion(device, authData, body), authData),
    publicKeySpki: device.spki,
    appId: APP_ID,
    body,
    previousCounter,
  }
}

describe('verifyAssertionSignature', () => {
  const device = makeDevice()

  it('accepts a valid assertion and reports the counter', async () => {
    const result = await verifyAssertionSignature(validParams(device))
    expect(result).toEqual({ valid: true, counter: 5 })
  })

  it('rejects a tampered body (assertion is bound to exact bytes)', async () => {
    const params = validParams(device)
    params.body = new Uint8Array(Buffer.from(JSON.stringify({ prompt: 'something else' })))
    const result = await verifyAssertionSignature(params)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad signature')
  })

  it('rejects a replayed counter', async () => {
    const result = await verifyAssertionSignature(validParams(device, { counter: 5, previousCounter: 5 }))
    expect(result).toEqual({ valid: false, reason: 'counter replay' })
  })

  it('rejects an assertion minted for another app id', async () => {
    const result = await verifyAssertionSignature(validParams(device, { appId: 'OTHER12345.com.evil.app' }))
    expect(result).toEqual({ valid: false, reason: 'wrong app id' })
  })

  it('rejects a signature from a different key', async () => {
    const otherDevice = makeDevice()
    const params = validParams(device)
    params.publicKeySpki = otherDevice.spki
    const result = await verifyAssertionSignature(params)
    expect(result.valid).toBe(false)
  })

  it('rejects garbage input without throwing', async () => {
    const result = await verifyAssertionSignature({
      assertion: new Uint8Array([1, 2, 3]),
      publicKeySpki: device.spki,
      appId: APP_ID,
      body: BODY,
      previousCounter: 0,
    })
    expect(result.valid).toBe(false)
  })
})

describe('decodeCbor', () => {
  it('round-trips the assertion map', () => {
    const sig = Buffer.from([1, 2, 3, 4])
    const auth = Buffer.alloc(40, 7)
    const decoded = decodeCbor(cborAssertion(sig, auth))
    expect(Buffer.from(decoded.signature)).toEqual(sig)
    expect(Buffer.from(decoded.authenticatorData)).toEqual(auth)
  })

  it('throws on truncated input', () => {
    const sig = Buffer.from([1, 2, 3, 4])
    const auth = Buffer.alloc(40, 7)
    const full = cborAssertion(sig, auth)
    expect(() => decodeCbor(full.subarray(0, full.length - 5))).toThrow()
  })
})

describe('derToRawSignature', () => {
  it('produces a 64-byte r||s WebCrypto accepts (covered by verify test)', () => {
    const device = makeDevice()
    const authData = makeAuthData()
    const der = signAssertion(device, authData, BODY)
    const raw = derToRawSignature(new Uint8Array(der))
    expect(raw.length).toBe(64)
  })

  it('rejects non-DER input', () => {
    expect(() => derToRawSignature(new Uint8Array([0x01, 0x02]))).toThrow()
  })
})

describe('encoding helpers', () => {
  it('base64ToBytes handles base64url', () => {
    const bytes = base64ToBytes(Buffer.from([251, 255, 0, 1]).toString('base64url'))
    expect(Buffer.from(bytes)).toEqual(Buffer.from([251, 255, 0, 1]))
  })

  it('pemToDer strips PEM armor', () => {
    const device = makeDevice()
    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(device.spki).toString('base64')}\n-----END PUBLIC KEY-----\n`
    expect(Buffer.from(pemToDer(pem))).toEqual(Buffer.from(device.spki))
  })
})

describe('tier limits', () => {
  it('attested gets full caps, unattested reduced', () => {
    expect(dailyCapFor(true)).toBe(50)
    expect(dailyCapFor(false)).toBe(20)
    expect(hourlyLimitFor(true, 20)).toBe(20)
    expect(hourlyLimitFor(false, 20)).toBe(10)
    expect(hourlyLimitFor(false, 1)).toBe(1)
  })
})

describe('classifyAttestation off-mode is a true no-op kill switch', () => {
  const req = { headers: { get: () => '' } }
  const body = new Uint8Array([1, 2, 3])
  const prev = process.env.ATTEST_MODE

  afterEach(() => {
    if (prev === undefined) delete process.env.ATTEST_MODE
    else process.env.ATTEST_MODE = prev
  })

  it('grants full caps (attested=true) when ATTEST_MODE is unset', async () => {
    delete process.env.ATTEST_MODE
    const result = await classifyAttestation(req, body, 'user-1')
    // attested=true → dailyCapFor/hourlyLimitFor return the FULL limits,
    // so behavior matches pre-App-Attest. No reject is ever produced.
    expect(result).toEqual({ attested: true })
    expect(dailyCapFor(result.attested)).toBe(50)
    expect(hourlyLimitFor(result.attested, 20)).toBe(20)
  })

  it('grants full caps when ATTEST_MODE=off explicitly', async () => {
    process.env.ATTEST_MODE = 'off'
    const result = await classifyAttestation(req, body, 'user-1')
    expect(result).toEqual({ attested: true })
  })
})
