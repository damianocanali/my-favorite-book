// Per-request App Attest ASSERTION verification — edge-runtime safe
// (WebCrypto only; one-time attestation lives in api/attest/register.js
// on the Node runtime).
//
// Enforcement model (the same /api endpoints serve the web app, which
// has no attestation primitive, so absence is never fatal):
//   ATTEST_MODE=off      → kill switch: everything runs as before, with
//                          the FULL caps (attestation is not consulted)
//   ATTEST_MODE=log      → verify + log; never reject. Unattested
//                          callers (web/legacy) get the reduced tier.
//   ATTEST_MODE=enforce  → an INVALID assertion is rejected with 401;
//                          an ABSENT one just lands in the unattested
//                          tier (reduced caps)
//
// The iOS client signs SHA256(raw request body) with its Secure
// Enclave key and sends:
//   x-attest-key-id:    base64 key id
//   x-attest-assertion: base64 CBOR { signature, authenticatorData }

import { withCors } from './_rateLimit.js'

const APP_ID = () =>
  `${process.env.APP_ATTEST_TEAM_ID || 'G53XBRCRVU'}.${process.env.APP_ATTEST_BUNDLE_ID || 'com.myfavoritebook.app'}`

// ── Minimal CBOR decoder ─────────────────────────────────────────────────────
// Supports definite-length unsigned ints, byte/text strings, arrays and
// maps — everything an App Attest assertion contains. Exported for tests.
export function decodeCbor(bytes) {
  let pos = 0
  function readLen(info) {
    if (info < 24) return info
    if (info === 24) return bytes[pos++]
    if (info === 25) {
      const v = (bytes[pos] << 8) | bytes[pos + 1]
      pos += 2
      return v
    }
    if (info === 26) {
      const v = bytes[pos] * 2 ** 24 + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3]
      pos += 4
      return v
    }
    throw new Error('unsupported CBOR length')
  }
  function item() {
    if (pos >= bytes.length) throw new Error('truncated CBOR')
    const initial = bytes[pos++]
    const major = initial >> 5
    const info = initial & 0x1f
    switch (major) {
      case 0:
        return readLen(info)
      case 2: {
        const n = readLen(info)
        const v = bytes.subarray(pos, pos + n)
        if (v.length !== n) throw new Error('truncated CBOR')
        pos += n
        return v
      }
      case 3: {
        const n = readLen(info)
        const v = new TextDecoder().decode(bytes.subarray(pos, pos + n))
        pos += n
        return v
      }
      case 4: {
        const n = readLen(info)
        const arr = []
        for (let i = 0; i < n; i++) arr.push(item())
        return arr
      }
      case 5: {
        const n = readLen(info)
        const map = {}
        for (let i = 0; i < n; i++) {
          const k = item()
          map[k] = item()
        }
        return map
      }
      default:
        throw new Error('unsupported CBOR type')
    }
  }
  return item()
}

// ── Signature plumbing ───────────────────────────────────────────────────────

/** DER-encoded ECDSA signature → raw 64-byte r||s for WebCrypto. */
export function derToRawSignature(der) {
  if (der[0] !== 0x30) throw new Error('bad signature')
  let pos = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2
  function readInt() {
    if (der[pos++] !== 0x02) throw new Error('bad signature')
    const len = der[pos++]
    let v = der.subarray(pos, pos + len)
    pos += len
    while (v.length > 32 && v[0] === 0) v = v.subarray(1)
    if (v.length > 32) throw new Error('bad signature')
    const out = new Uint8Array(32)
    out.set(v, 32 - v.length)
    return out
  }
  const r = readInt()
  const s = readInt()
  const raw = new Uint8Array(64)
  raw.set(r, 0)
  raw.set(s, 32)
  return raw
}

export function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  return base64ToBytes(b64)
}

export function base64ToBytes(b64) {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(normalized)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function sha256(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

// ── Pure assertion check (exported for tests) ────────────────────────────────

/**
 * Verifies a single assertion against the stored key.
 * @param {Uint8Array} assertion       CBOR {signature, authenticatorData}
 * @param {Uint8Array} publicKeySpki   SPKI DER of the registered key
 * @param {string}     appId           "TEAMID.bundle.id"
 * @param {Uint8Array} body            raw request body bytes
 * @param {number}     previousCounter last accepted counter for this key
 * @returns {{valid: boolean, counter?: number, reason?: string}}
 */
export async function verifyAssertionSignature({ assertion, publicKeySpki, appId, body, previousCounter }) {
  let decoded
  try {
    decoded = decodeCbor(assertion)
  } catch {
    return { valid: false, reason: 'malformed CBOR' }
  }
  const signature = decoded?.signature
  const authData = decoded?.authenticatorData
  if (!(signature instanceof Uint8Array) || !(authData instanceof Uint8Array) || authData.length < 37) {
    return { valid: false, reason: 'malformed assertion' }
  }

  const rpIdHash = await sha256(new TextEncoder().encode(appId))
  for (let i = 0; i < 32; i++) {
    if (authData[i] !== rpIdHash[i]) return { valid: false, reason: 'wrong app id' }
  }

  const counter = authData[33] * 2 ** 24 + (authData[34] << 16) + (authData[35] << 8) + authData[36]
  if (typeof previousCounter === 'number' && counter <= previousCounter) {
    return { valid: false, reason: 'counter replay' }
  }

  // nonce = SHA256(authenticatorData || SHA256(body)); the device signed
  // this nonce, binding the assertion to this exact payload.
  const clientDataHash = await sha256(body)
  const nonceInput = new Uint8Array(authData.length + clientDataHash.length)
  nonceInput.set(authData, 0)
  nonceInput.set(clientDataHash, authData.length)
  const nonce = new Uint8Array(await crypto.subtle.digest('SHA-256', nonceInput))

  let rawSig
  try {
    rawSig = derToRawSignature(signature)
  } catch {
    return { valid: false, reason: 'bad signature encoding' }
  }

  let key
  try {
    key = await crypto.subtle.importKey('spki', publicKeySpki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  } catch {
    return { valid: false, reason: 'bad stored key' }
  }

  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, rawSig, nonce)
  return ok ? { valid: true, counter } : { valid: false, reason: 'bad signature' }
}

// ── Request classification ───────────────────────────────────────────────────

/** Daily image cap for the request's trust tier. */
export function dailyCapFor(attested) {
  const full = Number(process.env.DAILY_IMAGE_LIMIT || 50)
  const reduced = Number(process.env.DAILY_IMAGE_LIMIT_UNATTESTED || 20)
  return attested ? full : reduced
}

/** Hourly limit for the request's trust tier (unattested gets half). */
export function hourlyLimitFor(attested, fullLimit) {
  return attested ? fullLimit : Math.max(1, Math.ceil(fullLimit / 2))
}

/**
 * Classifies a paid-endpoint request.
 * Returns { attested } — or { attested: false, reject: Response } when an
 * assertion was PRESENT but invalid and ATTEST_MODE=enforce.
 */
export async function classifyAttestation(req, rawBody, userId) {
  const mode = (process.env.ATTEST_MODE || 'off').toLowerCase()
  // Off is a true no-op kill switch: grant the full caps so behavior is
  // identical to before App Attest existed. (`attested` here only selects
  // the rate/daily tier — it makes no security claim, and off mode never
  // rejects.) Returning `false` here would silently drop every caller
  // into the reduced tier before any attestation rollout.
  if (mode === 'off') return { attested: true }

  const keyId = req.headers.get('x-attest-key-id') || ''
  const assertionB64 = req.headers.get('x-attest-assertion') || ''
  if (!keyId || !assertionB64) return { attested: false } // web / legacy builds

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[app-attest] service env missing — attestation DISABLED')
    return { attested: false }
  }
  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  let row
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_attest_keys?key_id=eq.${encodeURIComponent(keyId)}&user_id=eq.${encodeURIComponent(userId)}&select=public_key_pem,counter`,
      { headers: serviceHeaders }
    )
    if (!res.ok) throw new Error(`key lookup ${res.status}`)
    row = (await res.json())?.[0]
  } catch (e) {
    // Infra hiccup, not a hostile client — fail open to the unattested
    // tier, matching the other guards.
    console.error('[app-attest] key lookup error:', e?.message)
    return { attested: false }
  }

  let reason = 'unknown key'
  if (row) {
    try {
      const result = await verifyAssertionSignature({
        assertion: base64ToBytes(assertionB64),
        publicKeySpki: pemToDer(row.public_key_pem),
        appId: APP_ID(),
        body: rawBody,
        previousCounter: Number(row.counter ?? 0),
      })
      if (result.valid) {
        const bump = await fetch(`${supabaseUrl}/rest/v1/rpc/bump_assertion_counter`, {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({ p_key_id: keyId, p_user_id: userId, p_counter: result.counter }),
        })
        const bumped = bump.ok ? await bump.json().catch(() => false) : false
        if (bumped === true) return { attested: true }
        reason = 'counter replay (race)'
      } else {
        reason = result.reason
      }
    } catch (e) {
      reason = e?.message || 'verification error'
    }
  }

  // A PRESENT-but-invalid assertion is always suspicious — no legitimate
  // client produces one.
  console.warn(`[app-attest] invalid assertion (${reason}) user=${userId} mode=${mode}`)
  if (mode === 'enforce') {
    return {
      attested: false,
      reject: new Response(JSON.stringify({ error: 'App verification failed' }), {
        status: 401,
        headers: withCors({ 'Content-Type': 'application/json' }, req),
      }),
    }
  }
  return { attested: false }
}
