// An opaque, server-only handle for a gallery book's author (privacy review
// §7.8). The public gallery API used to return published_books.user_id —
// the author's account UUID, often a child's. Clients needed it for two
// things only: "is this my book?" (now the server's is_owner flag) and
// "block this author" (now this handle, which only the server can open).
//
// AES-GCM with a random IV: two reads of the same author give different
// handles, so a handle can't be used to link books across the gallery.
// Key: AUTHOR_REF_KEY if set, else derived from the service-role key (so no
// new secret is required to deploy). Rotating either just invalidates
// handles already sent, which only matters for a block in flight.

const enc = new TextEncoder()
const dec = new TextDecoder()
let cached = null

async function key() {
  const secret = process.env.AUTHOR_REF_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!secret) return null
  if (cached?.secret === secret) return cached.key
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`author-ref:v1:${secret}`))
  const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  cached = { secret, key: k }
  return k
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

export async function sealAuthorRef(userId) {
  if (!userId) return null
  const k = await key()
  if (!k) return null
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(String(userId))))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return `ar1.${b64url(out)}`
}

/// The user id inside a handle, or null for anything forged or stale.
export async function openAuthorRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('ar1.') || ref.length > 200) return null
  try {
    const k = await key()
    if (!k) return null
    const bytes = unb64url(ref.slice(4))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, k, bytes.slice(12))
    return dec.decode(pt)
  } catch {
    return null
  }
}
