// Puts generated artwork in Supabase Storage and hands back a plain URL.
//
// Why this exists: books sync to Supabase with their illustrations
// replaced by '[saved-locally]' (a base64 data URL per page would bloat
// the user_books JSON). The print pipeline reads that stored copy, so
// printed books rendered <img src="[saved-locally]"> — broken art on
// every page of a paid product. A short URL is small enough to sync and
// can actually be fetched by the PDF worker and the upscaler.
//
// Uploading is best-effort: if Storage is unreachable we fall back to the
// data URL, which still renders in-app. A generation the user already
// paid for should never fail because of a storage hiccup.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
export const BUCKET = 'book-illustrations'

/** base64 (no data: prefix) → bytes, without pulling in Buffer. */
function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * Store a base64 PNG and return its public URL.
 *
 * @param {string} b64        raw base64, no `data:` prefix
 * @param {string} userId     namespaces the path so users can't collide
 * @param {string} [kind]     'page' | 'cover' — for readability only
 * @returns {Promise<string|null>} public URL, or null to fall back
 */
export async function storeIllustration(b64, userId, kind = 'page') {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[image-store] Supabase service env missing — keeping data URL')
    return null
  }
  if (!b64 || !userId) return null

  const path = `${userId}/${kind}-${randomId()}.png`
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: base64ToBytes(b64),
      }
    )
    if (!res.ok) {
      console.error('[image-store] upload failed', res.status, (await res.text()).slice(0, 200))
      return null
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  } catch (e) {
    console.error('[image-store] upload error', e?.message)
    return null
  }
}

/**
 * True when a stored illustration value is a real, fetchable reference
 * rather than on-device bytes. Sync keeps these; it strips everything
 * else, because a data URL would bloat the row.
 */
export function isFetchableImage(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

/**
 * True only for a public URL of an illustration THIS user stored in our
 * bucket: `${SUPABASE_URL}/storage/v1/object/public/book-illustrations/<userId>/<file>.png`.
 * Used to let "tweak" edit a saved picture: the URL is handed to Together
 * as image_url, so anything looser is an SSRF hole. Strict: https, exact
 * origin, exact path prefix, the caller's own folder, a plain file name, no
 * query/fragment/credentials, and the string must already be in canonical
 * form (so `..`, `%2e`, backslashes or odd casing can't smuggle a path).
 */
export function isOwnStoredIllustration(value, userId, supabaseUrl = SUPABASE_URL) {
  if (typeof value !== 'string' || value.length > 1024 || !userId || !supabaseUrl) return false
  let base, u
  try {
    base = new URL(supabaseUrl)
    u = new URL(value)
  } catch {
    return false
  }
  if (base.protocol !== 'https:' || u.protocol !== 'https:') return false
  if (u.origin !== base.origin || u.username || u.password || u.search || u.hash) return false
  if (u.href !== value) return false
  const prefix = `/storage/v1/object/public/${BUCKET}/${String(userId).toLowerCase()}/`
  if (!u.pathname.startsWith(prefix)) return false
  return /^[A-Za-z0-9_-]{1,128}\.(png|jpe?g|webp)$/.test(u.pathname.slice(prefix.length))
}
