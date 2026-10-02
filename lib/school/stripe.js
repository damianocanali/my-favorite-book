// Stripe REST for the schools billing (Stage 4). Edge-friendly fetch, no
// SDK, same pattern as api/create-checkout.js. Key selection follows
// lib/print/stripe-key.js (test key on preview/development).
//
// Data minimisation (privacy): a Stripe Customer for a school carries the
// teacher/school-admin email, the SCHOOL name and our user id in metadata.
// Never a child's name or any student data.
import { getStripeSecretKey } from '../print/stripe-key.js'

export const SCHOOL_TYPES = ['class_license', 'school_plan']
export const STRIPE_API_VERSION_NOTE =
  'Handles both the pre-2025 shapes (subscription.current_period_*, invoice.subscription) and the 2025 "basil" shapes (items.data[].current_period_*, invoice.parent.subscription_details).'

/// Flattens { a: { b: 1 }, c: [ { d: 2 } ] } → a[b]=1&c[0][d]=2 (Stripe form encoding).
export function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))))
    else if (typeof v === 'object') formEncode(v, key, out)
    else out.append(key, String(v))
  }
  return out
}

export function stripeConfigured() {
  return !!getStripeSecretKey()
}

/**
 * One Stripe call. → { ok, status, data }. Never throws. Error bodies are
 * not logged (they can echo customer details) — status only.
 */
export async function stripe(path, { method = 'GET', params, idempotencyKey } = {}) {
  const key = getStripeSecretKey()
  if (!key) return { ok: false, status: 503, data: { error: { message: 'Stripe not configured' } } }
  const headers = { Authorization: `Bearer ${key}` }
  let url = `https://api.stripe.com/v1/${path}`
  let body
  if (method === 'GET' && params) url += `?${formEncode(params).toString()}`
  else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = formEncode(params).toString()
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  try {
    const res = await fetch(url, { method, headers, body })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) console.error(`[school/stripe] ${method} ${path.split('/')[0]} → ${res.status}`)
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    console.error('[school/stripe] request failed', e?.message)
    return { ok: false, status: 0, data: {} }
  }
}

// ── Shape readers (old and new Stripe API versions) ─────────────────────

const sec = (v) => (Number.isFinite(v) ? v * 1000 : null)

/// { id, status, customer, quantity, priceId, periodStart, periodEnd (ms), cancelAtPeriodEnd, metadata }
export function readSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null
  const item = sub.items?.data?.[0] ?? null
  return {
    id: sub.id,
    status: sub.status,
    customer: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    quantity: item?.quantity ?? sub.quantity ?? null,
    priceId: item?.price?.id ?? sub.plan?.id ?? null,
    periodStart: sec(item?.current_period_start ?? sub.current_period_start),
    periodEnd: sec(item?.current_period_end ?? sub.current_period_end),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    collectionMethod: sub.collection_method ?? null,
    metadata: sub.metadata ?? {},
  }
}

/// { id, subscriptionId, billingReason, periodStart, periodEnd, dueDate (ms), quantity, priceId, metadata, collectionMethod }
export function readInvoice(inv) {
  if (!inv || typeof inv !== 'object') return null
  const details = inv.parent?.subscription_details ?? inv.subscription_details ?? null
  const subRef = details?.subscription ?? inv.subscription ?? null
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id ?? null
  // The term lines: subscription lines (old: type 'subscription'; new:
  // parent.type 'subscription_item_details'), not proration lines. The
  // latest period among them is the one this invoice pays for.
  const lines = (inv.lines?.data ?? []).filter((l) => !l.proration && !(l.parent?.subscription_item_details?.proration))
  let best = null
  for (const l of lines) if (l.period?.start != null && (!best || l.period.start > best.period.start)) best = l
  const price = best?.price?.id ?? best?.pricing?.price_details?.price ?? null
  return {
    id: inv.id,
    subscriptionId,
    billingReason: inv.billing_reason ?? null,
    periodStart: sec(best?.period?.start),
    periodEnd: sec(best?.period?.end),
    dueDate: sec(inv.due_date),
    quantity: best?.quantity ?? null,
    priceId: typeof price === 'string' ? price : price?.id ?? null,
    metadata: details?.metadata ?? {},
    collectionMethod: inv.collection_method ?? null,
    customer: typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null,
  }
}

/// What paid an invoice, in any API version:
///   2025 "basil": invoice.payments.data[].payment.payment_intent (or .charge)
///   older:        invoice.payment_intent, else invoice.charge
/// → { payment_intent } | { charge } | null
export function invoicePayment(inv) {
  if (!inv || typeof inv !== 'object') return null
  const id = (v) => (typeof v === 'string' ? v : v?.id ?? null)
  for (const p of inv.payments?.data ?? []) {
    if (p?.payment?.payment_intent) return { payment_intent: id(p.payment.payment_intent) }
    if (p?.payment?.charge) return { charge: id(p.payment.charge) }
  }
  if (inv.payment_intent) return { payment_intent: id(inv.payment_intent) }
  if (inv.charge) return { charge: id(inv.charge) }
  return null
}

/// Back-compat: the PaymentIntent only.
export const invoicePaymentIntent = (inv) => invoicePayment(inv)?.payment_intent ?? null

/// Reads an object with an expansion that only exists on newer API
/// versions, falling back to the older expansion (review N5).
async function readExpanded(stripeCall, path, expands) {
  for (const expand of expands) {
    const r = await stripeCall(path, { params: { expand } })
    if (r.ok) return r
  }
  return { ok: false, data: {} }
}

/// Refunds whatever paid this invoice (any API version). → boolean
export async function refundInvoice(stripeCall, invoiceId, idempotencyKey) {
  const got = await readExpanded(stripeCall, `invoices/${encodeURIComponent(invoiceId)}`, [['payments'], []])
  const pay = got.ok ? invoicePayment(got.data) : null
  if (!pay) return false
  const r = await stripeCall('refunds', { method: 'POST', params: { ...pay, reason: 'duplicate' }, idempotencyKey })
  return r.ok
}

/**
 * A subscription that must not exist (a second one for the same class or
 * plan, review I11): cancel it NOW and refund what its first invoice took.
 * Idempotent (Stripe idempotency keys per subscription). → { canceled, refunded }
 */
export async function cancelAndRefund(stripeCall, subId) {
  const enc = encodeURIComponent
  const got = await readExpanded(stripeCall, `subscriptions/${enc(subId)}`, [['latest_invoice.payments'], ['latest_invoice']])
  const pay = got.ok ? invoicePayment(got.data?.latest_invoice) : null
  const del = await stripeCall(`subscriptions/${enc(subId)}`, { method: 'DELETE', idempotencyKey: `school-dup-cancel-${subId}` })
  let refunded = false
  if (pay) {
    const r = await stripeCall('refunds', { method: 'POST', params: { ...pay, reason: 'duplicate' }, idempotencyKey: `school-dup-refund-${subId}` })
    refunded = r.ok
  }
  return { canceled: del.ok || del.status === 404, refunded }
}
