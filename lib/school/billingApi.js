// Shared Stripe steps for the schools billing endpoints (api/school/
// checkout.js, billing.js, plan.js). Every call goes through
// lib/school/stripe.js; the `stripe` argument lets tests pass a mock.
//
// Customer data minimisation: email of the buying teacher, the SCHOOL name,
// our user id. Never a child's anything.

/// The NDPA the buyer confirms will be signed (schools spec D6).
export const DPA_VERSION = 'SDPC-NDPA-2.1'
export const NDPA_PATH = '/schools#ndpa'

const enc = encodeURIComponent

/// The teacher's existing Stripe customer (from any license or plan they
/// bought), so one school keeps one customer and one invoice history.
/// Only records the teacher PAYS for: their own school plan, or a class
/// license of theirs that is not a seat block (a block never carries the
/// plan's Customer, and the filter makes sure — review C1).
export async function ownerCustomerId(sb, userId) {
  const lookups = [
    `/rest/v1/school_plans?owner_user_id=eq.${enc(userId)}&stripe_customer_id=not.is.null&select=stripe_customer_id&limit=1`,
    `/rest/v1/class_licenses?owner_user_id=eq.${enc(userId)}&school_plan_id=is.null&stripe_customer_id=not.is.null&select=stripe_customer_id&limit=1`,
  ]
  for (const path of lookups) {
    const res = await sb(path)
    if (!res.ok) throw new Error(`customer lookup ${res.status}`)
    const rows = await res.json()
    if (rows?.[0]?.stripe_customer_id) return rows[0].stripe_customer_id
  }
  return null
}

export async function ensureCustomer(sb, stripe, { userId, email, schoolName }) {
  const existing = await ownerCustomerId(sb, userId)
  if (existing) return { ok: true, id: existing }
  const r = await stripe('customers', {
    method: 'POST',
    params: { email, name: schoolName, metadata: { owner_user_id: userId, kind: 'school' } },
  })
  return r.ok && r.data?.id ? { ok: true, id: r.data.id } : { ok: false }
}

export async function subscriptionItem(stripe, subId) {
  const r = await stripe(`subscriptions/${enc(subId)}`)
  if (!r.ok) return null
  const item = r.data?.items?.data?.[0]
  if (!item?.id) return null
  const pm = r.data.default_payment_method
  return {
    itemId: item.id, quantity: item.quantity, collectionMethod: r.data.collection_method, status: r.data.status,
    customer: typeof r.data.customer === 'string' ? r.data.customer : r.data.customer?.id ?? null,
    paymentMethod: typeof pm === 'string' ? pm : pm?.id ?? null,
  }
}

/**
 * Sets a subscription's seat count WITHOUT proration, ever (review I2/I5):
 *   * an increase is charged separately and in full first (chargeSeatAdd),
 *     so Stripe must not prorate it again;
 *   * a decrease refunds nothing and bills the new count from the renewal.
 * → { ok, quantity }
 */
export async function setQuantity(stripe, subId, itemId, quantity, idempotencyKey) {
  const r = await stripe(`subscriptions/${enc(subId)}`, {
    method: 'POST',
    params: { items: [{ id: itemId, quantity }], proration_behavior: 'none' },
    idempotencyKey,
  })
  if (!r.ok) return { ok: false, status: r.status }
  return { ok: true, quantity: r.data?.items?.data?.[0]?.quantity ?? null }
}

/**
 * Seats added mid-term: the FULL yearly per-seat price for each added seat
 * (owner ruling, review I5 — every seat includes a printed book), as one
 * stand-alone invoice holding exactly this one item (review N6: the
 * invoice is created first and the item attached to it, so no other
 * pending item of the customer is swept in).
 *   card:    charged now with the subscription's payment method. If `pay`
 *            fails, the invoice is RE-READ: paid after all → success; else
 *            voided (a failed void is reported for an owner alert).
 *   invoice: finalized and sent, net 30; the caller grants the seats only
 *            when it is paid (review N3, webhook).
 * Every Stripe call carries an idempotency key derived from `key`, which
 * the caller builds from (record id, from, to, client request id): a
 * double submit replays the same invoice and charges once (review N2).
 * `quote` comes from lib/school/pricing.js seatAddQuote (never the client).
 * → { ok: true, invoiceId, paid, dueDate? } | { ok: false, code: 'payment_failed'|'upstream', voidFailed? }
 */
export async function chargeSeatAdd(stripe, { customer, paymentMethod, collectionMethod, quote, description, metadata, key }) {
  const sendInvoice = collectionMethod === 'send_invoice'
  const inv = await stripe('invoices', {
    method: 'POST',
    params: {
      customer,
      collection_method: sendInvoice ? 'send_invoice' : 'charge_automatically',
      ...(sendInvoice ? { days_until_due: 30 } : paymentMethod ? { default_payment_method: paymentMethod } : {}),
      pending_invoice_items_behavior: 'exclude',
      auto_advance: 'false',
      description,
      metadata,
    },
    idempotencyKey: `${key}-invoice`,
  })
  if (!inv.ok || !inv.data?.id) return { ok: false, code: 'upstream' }
  const id = inv.data.id
  const item = await stripe('invoiceitems', {
    method: 'POST',
    params: { customer, invoice: id, amount: quote.total_cents, currency: quote.currency, description, metadata },
    idempotencyKey: `${key}-item`,
  })
  if (!item.ok) {
    await stripe(`invoices/${enc(id)}`, { method: 'DELETE' })
    return { ok: false, code: 'upstream' }
  }
  const fin = await stripe(`invoices/${enc(id)}/finalize`, { method: 'POST', params: { auto_advance: 'false' }, idempotencyKey: `${key}-finalize` })
  if (!fin.ok) {
    // A replayed request finds it already finalized: carry on from its state.
    const now = await stripe(`invoices/${enc(id)}`)
    if (!now.ok || now.data?.status === 'draft') {
      await stripe(`invoices/${enc(id)}`, { method: 'DELETE' })
      return { ok: false, code: 'upstream' }
    }
    if (now.data?.status === 'paid') return { ok: true, invoiceId: id, paid: true }
  }
  if (sendInvoice) {
    const sent = await stripe(`invoices/${enc(id)}/send`, { method: 'POST', idempotencyKey: `${key}-send` })
    const due = fin.data?.due_date ?? inv.data?.due_date ?? null
    return sent.ok ? { ok: true, invoiceId: id, paid: false, dueDate: due ? new Date(due * 1000).toISOString() : null } : { ok: false, code: 'upstream' }
  }
  const pay = await stripe(`invoices/${enc(id)}/pay`, { method: 'POST', params: paymentMethod ? { payment_method: paymentMethod } : {}, idempotencyKey: `${key}-pay` })
  if (pay.ok && pay.data?.status === 'paid') return { ok: true, invoiceId: id, paid: true }
  // Ambiguous or failed: what does Stripe say now?
  const now = await stripe(`invoices/${enc(id)}`)
  if (now.ok && now.data?.status === 'paid') return { ok: true, invoiceId: id, paid: true }
  const v = await stripe(`invoices/${enc(id)}/void`, { method: 'POST', idempotencyKey: `${key}-void` })
  return { ok: false, code: 'payment_failed', voidFailed: !v.ok, invoiceId: id }
}

/// Expires every OPEN Checkout session of this customer for the same
/// class (or the same school-plan purchase), so two tabs can't pay twice
/// (review I11). Best-effort; the webhook cancels a duplicate anyway.
export async function expireOpenSessions(stripe, customer, match) {
  const r = await stripe('checkout/sessions', { params: { customer, status: 'open', limit: 100 } })
  if (!r.ok) return 0
  let n = 0
  for (const s of r.data?.data ?? []) {
    if (!match(s.metadata ?? {})) continue
    const x = await stripe(`checkout/sessions/${enc(s.id)}/expire`, { method: 'POST' })
    if (x.ok) n++
  }
  return n
}

export async function portalUrl(stripe, customer, returnUrl) {
  const r = await stripe('billing_portal/sessions', { method: 'POST', params: { customer, return_url: returnUrl } })
  return r.ok && r.data?.url ? r.data.url : null
}

/// The invoices a teacher sees: number, status, amounts, dates and Stripe's
/// hosted links. Nothing else from the invoice object.
export async function listInvoices(stripe, customer, subscription) {
  const params = { customer, limit: 12 }
  if (subscription) params.subscription = subscription
  const r = await stripe('invoices', { params })
  if (!r.ok) return null
  return (r.data?.data ?? []).map((i) => ({
    id: i.id,
    number: i.number ?? null,
    status: i.status,
    amount_due: i.amount_due,
    amount_paid: i.amount_paid,
    currency: i.currency,
    created: i.created ? new Date(i.created * 1000).toISOString() : null,
    due_date: i.due_date ? new Date(i.due_date * 1000).toISOString() : null,
    hosted_invoice_url: i.hosted_invoice_url ?? null,
    invoice_pdf: i.invoice_pdf ?? null,
  }))
}

/// Body fields every purchase needs: the school name and the NDPA
/// confirmation (schools spec §5/§6). → { ok, schoolName, dpa } | { ok:false, code }
export function purchaseBasics(body, now = new Date()) {
  const schoolName = typeof body?.school_name === 'string' ? body.school_name.trim().slice(0, 120) : ''
  if (!schoolName) return { ok: false, code: 'school_name_required' }
  if (body?.dpa_accept !== true) return { ok: false, code: 'dpa_required' }
  return { ok: true, schoolName, dpa: { dpa_version: DPA_VERSION, dpa_accepted_at: new Date(now).toISOString() } }
}
