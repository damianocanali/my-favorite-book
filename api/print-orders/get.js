export const config = { runtime: 'edge' }

// CORS is applied per-handler. vercel.json used to force
// Access-Control-Allow-Origin:* on every /api/* route, which overrode the
// ALLOWED_ORIGINS allowlist in _rateLimit.js; that block is gone, so any
// handler a browser calls has to carry its own headers. The web app is
// same-origin and would not need them, but the Capacitor webview is not —
// resolveAllowedOrigin() special-cases capacitor:// for exactly that.
import { handleCors, withCors } from '../_rateLimit.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function authUser(token) {
  const r = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  return await r.json()
}

const PUBLIC_FIELDS = [
  'id', 'user_id', 'book_id', 'format', 'quantity', 'unit_price_cents',
  'shipping_cents', 'tax_cents', 'total_cents',
  'ship_name', 'ship_address_line1', 'ship_address_line2',
  'ship_city', 'ship_state', 'ship_postal_code', 'ship_country',
  'ship_email', 'ship_phone',
  'lulu_order_id', 'lulu_tracking_url', 'lulu_carrier', 'lulu_tracking_number',
  'stripe_payment_intent_id', 'stripe_charge_id',
  'status', 'status_message',
  'created_at', 'updated_at',
]

export default async function handler(req) {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: withCors({ 'Content-Type': 'application/json' }, req) })
  }
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const user = await authUser(tok)
  if (!user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withCors({ 'Content-Type': 'application/json' }, req) })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), {
    status: 400, headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
  const r = await fetch(
    `${SUPABASE}/rest/v1/print_orders?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=${PUBLIC_FIELDS.join(',')}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const rows = await r.json()
  if (!rows?.[0]) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: withCors({ 'Content-Type': 'application/json' }, req) })

  return new Response(JSON.stringify(rows[0]), {
    status: 200, headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
}
