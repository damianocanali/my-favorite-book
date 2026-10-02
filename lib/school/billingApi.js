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
export async function ownerCustomerId(sb, userId) {
  for (const table of ['school_plans', 'class_licenses']) {
    const res = await sb(`/rest/v1/${table}?owner_user_id=eq.${enc(userId)}&stripe_customer_id=not.is.null&select=stripe_customer_id&limit=1`)
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
  return { itemId: item.id, quantity: item.quantity, collectionMethod: r.data.collection_method, status: r.data.status }
}

/**
 * Changes a subscription's seat count.
 *   increase → prorated and invoiced now. Card: pending_if_incomplete, so
 *              the seats only apply once the proration is paid. Invoice
 *              billing: the proration invoice is sent (net 30) and the seats
 *              apply now.
 *   decrease → proration none: nothing is refunded; the next renewal bills
 *              the new count (our side keeps the seats until then).
 * → { ok, quantity (as Stripe now has it), pending (an unpaid increase) }
 */
export async function changeQuantity(stripe, subId, { itemId, collectionMethod }, quantity, mode) {
  const params = { items: [{ id: itemId, quantity }] }
  if (mode === 'increase') {
    params.proration_behavior = 'always_invoice'
    if (collectionMethod !== 'send_invoice') params.payment_behavior = 'pending_if_incomplete'
  } else {
    params.proration_behavior = 'none'
  }
  const r = await stripe(`subscriptions/${enc(subId)}`, { method: 'POST', params })
  if (!r.ok) return { ok: false, status: r.status }
  const q = r.data?.items?.data?.[0]?.quantity ?? null
  return { ok: true, quantity: q, pending: !!r.data?.pending_update }
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
