export const config = { runtime: 'edge' }

import { unitPriceCents, totalCents } from '../../lib/print/pricing.js'
import { getStripeSecretKey } from '../../lib/print/stripe-key.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Flat US shipping placeholder; Plan B will switch to Lulu's shipping calculator + Stripe Tax.
const FLAT_SHIPPING_CENTS = 499
const FLAT_TAX_CENTS = 0

async function authUser(token) {
  const r = await fetch(`${SUPABASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  return await r.json()
}

async function fetchBook(userId, bookId) {
  const r = await fetch(
    `${SUPABASE}/rest/v1/user_books?user_id=eq.${userId}&book_id=eq.${encodeURIComponent(bookId)}&select=book_data,title`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const rows = await r.json()
  return rows?.[0] ?? null
}

async function insertOrder(row) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`insert failed (${r.status}): ${await r.text()}`)
  const arr = await r.json()
  return arr[0]
}

async function createPaymentIntent({ amountCents, orderId, userId, email }) {
  const params = new URLSearchParams()
  params.set('amount', String(amountCents))
  params.set('currency', 'usd')
  params.set('automatic_payment_methods[enabled]', 'true')
  params.set('receipt_email', email)
  params.set('metadata[type]', 'print_order')
  params.set('metadata[order_id]', orderId)
  params.set('metadata[user_id]', userId)
  params.set('description', 'My Book Lab — physical print order')

  const r = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  if (!r.ok) throw new Error(`stripe create PI failed (${r.status}): ${await r.text()}`)
  return await r.json()
}

function bad(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') return bad(405, 'Method not allowed')

  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!tok) return bad(401, 'Missing token')
  const user = await authUser(tok)
  if (!user?.id) return bad(401, 'Invalid token')

  const body = await req.json().catch(() => null)
  if (!body) return bad(400, 'Bad JSON')

  const { bookId, format, quantity, shipping } = body
  if (!bookId) return bad(400, 'Missing bookId')
  if (format !== 'hardcover' && format !== 'softcover') return bad(400, 'Bad format')
  const qty = Number.parseInt(quantity, 10)
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return bad(400, 'Bad quantity')
  // phone is required by Lulu's API on the shipping address — collect at
  // checkout. The other fields are required by US Postal address rules.
  for (const k of ['name','address_line1','city','state','postal_code','email','phone']) {
    if (!shipping?.[k]) return bad(400, `Missing shipping.${k}`)
  }
  if ((shipping.country ?? 'US') !== 'US') return bad(400, 'US shipping only in v1')

  const book = await fetchBook(user.id, bookId)
  if (!book) return bad(404, 'Book not found')
  if (!Array.isArray(book.book_data?.pages) || book.book_data.pages.length < 1) {
    return bad(400, 'Book has no pages')
  }

  const unitCents = unitPriceCents(format)
  const shippingCents = FLAT_SHIPPING_CENTS
  const taxCents = FLAT_TAX_CENTS
  const total = totalCents({ format, quantity: qty, shippingCents, taxCents })

  const inserted = await insertOrder({
    user_id: user.id,
    book_id: bookId,
    book_snapshot: book.book_data,
    format,
    quantity: qty,
    unit_price_cents: unitCents,
    shipping_cents: shippingCents,
    tax_cents: taxCents,
    total_cents: total,
    ship_name: shipping.name,
    ship_address_line1: shipping.address_line1,
    ship_address_line2: shipping.address_line2 ?? null,
    ship_city: shipping.city,
    ship_state: shipping.state,
    ship_postal_code: shipping.postal_code,
    ship_country: shipping.country ?? 'US',
    ship_email: shipping.email,
    ship_phone: shipping.phone ?? null,
    status: 'pending',
  })

  const pi = await createPaymentIntent({
    amountCents: total,
    orderId: inserted.id,
    userId: user.id,
    email: shipping.email,
  })

  await fetch(`${SUPABASE}/rest/v1/print_orders?id=eq.${inserted.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ stripe_payment_intent_id: pi.id }),
  })

  return new Response(
    JSON.stringify({ orderId: inserted.id, clientSecret: pi.client_secret, totalCents: total }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
