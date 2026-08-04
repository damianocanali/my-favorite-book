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
const BUCKET = 'book-illustrations'

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
