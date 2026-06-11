// Trusted base URL for Stripe checkout success/cancel redirects. The Origin
// header is client-controlled, so honoring it verbatim is a self-targeted
// open redirect. Accept it only when it's a known origin (PUBLIC_BASE_URL,
// the ALLOWED_ORIGINS list, or a native/local origin); otherwise fall back to
// the canonical PUBLIC_BASE_URL so a forged Origin can't redirect the
// post-checkout flow off-site.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL
const FALLBACK =
  PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

function allowlist() {
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (PUBLIC_BASE_URL) list.push(PUBLIC_BASE_URL)
  return list
}

export function checkoutBaseUrl(req) {
  const origin = (req.headers.get?.('origin') || '').trim()
  if (!origin) return FALLBACK
  if (
    origin.startsWith('capacitor://') ||
    origin === 'https://localhost' ||
    origin.startsWith('http://localhost')
  ) {
    return origin
  }
  const list = allowlist()
  if (list.includes(origin)) return origin
  return FALLBACK
}
