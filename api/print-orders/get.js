export const config = { runtime: 'edge' }

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
  'id', 'book_id', 'format', 'quantity', 'unit_price_cents',
  'shipping_cents', 'tax_cents', 'total_cents',
  'ship_name', 'ship_city', 'ship_state', 'ship_postal_code',
  'lulu_order_id', 'lulu_tracking_url', 'lulu_carrier', 'lulu_tracking_number',
  'status', 'status_message',
  'created_at', 'updated_at',
]

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const user = await authUser(tok)
  if (!user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const id = new URL(req.url).pathname.split('/').pop()
  const r = await fetch(
    `${SUPABASE}/rest/v1/print_orders?id=eq.${id}&user_id=eq.${user.id}&select=${PUBLIC_FIELDS.join(',')}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const rows = await r.json()
  if (!rows?.[0]) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  return new Response(JSON.stringify(rows[0]), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
