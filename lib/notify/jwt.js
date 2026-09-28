// Tiny WebCrypto helpers shared by Web Push (VAPID) and APNs: base64url and
// ES256 JWTs. WebCrypto only, no npm server libraries, so they run on Edge
// and on Node alike (globalThis.crypto.subtle).
const subtle = () => globalThis.crypto.subtle

export function b64uEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad base64url')
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const utf8 = (s) => new TextEncoder().encode(s)

// WebCrypto's ECDSA signature is already IEEE P1363 (r||s, 64 bytes for
// P-256), which is exactly what JWS ES256 wants: no DER unwrapping.
export async function signJwtES256(header, claims, privateKey) {
  const input = `${b64uEncode(utf8(JSON.stringify(header)))}.${b64uEncode(utf8(JSON.stringify(claims)))}`
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, utf8(input))
  return `${input}.${b64uEncode(sig)}`
}

// A P-256 signing key from the raw base64url pair web-push tooling prints
// (65-byte uncompressed public point, 32-byte private scalar). WebCrypto
// can't import a bare scalar, so it goes in as a JWK with the point's x/y.
export async function importRawP256Private(publicB64u, privateB64u, alg = 'ECDSA') {
  const pub = b64uDecode(publicB64u)
  const d = b64uDecode(privateB64u)
  if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) throw new Error('bad P-256 key')
  const jwk = { kty: 'EC', crv: 'P-256', x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33)), d: b64uEncode(d) }
  return subtle().importKey('jwk', jwk, { name: alg, namedCurve: 'P-256' }, false, alg === 'ECDSA' ? ['sign'] : ['deriveBits'])
}

// An APNs auth key (.p8) is a PKCS8 PEM. Env UIs often flatten its newlines
// to a literal "\n", so both are stripped along with the armour.
export async function importP8(pem) {
  const body = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return subtle().importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}
