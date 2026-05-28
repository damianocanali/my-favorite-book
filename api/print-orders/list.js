export const config = { runtime: 'edge' }

// Lists the authenticated user's print orders. Uses the service-role
// key and filters by the verified JWT's user id, so it works
// regardless of RLS configuration on the print_orders table — the
// same pattern as get.js and create.js.

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
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const user = await authUser(tok)
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const r = await fetch(
    `${SUPABASE}/rest/v1/print_orders?user_id=eq.${user.id}&order=created_at.desc&select=${PUBLIC_FIELDS.join(',')}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    return new Response(JSON.stringify({ error: 'Failed to load orders', detail: detail.slice(0, 200) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
  const rows = await r.json()
  return new Response(JSON.stringify(rows || []), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
