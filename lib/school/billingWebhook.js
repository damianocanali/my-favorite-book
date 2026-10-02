// School billing webhook (Stage 4). Called by api/stripe-webhook.js AFTER
// the signature check, and BEFORE any consumer branch, so a school event
// can never reach upsertSubscription (which would overwrite the teacher's
// personal `subscriptions` row — schools spec §6).
//
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
// invoice.finalized, customer.subscription.updated / .deleted.
//
// Never trusts client data for amounts or seats: seats come from the
// Stripe subscription/invoice quantity in the signed event (or a
// server-to-server read of the subscription); the tier from the Price id;
// identity (owner, class) from the metadata OUR server put on the session.
//
// Idempotency: each event id is claimed in stripe_school_events before it
// is applied; a duplicate is a no-op. If applying fails the claim is
// released and the caller answers 500 so Stripe retries. Ordering is by
// Stripe's period / event time, never by arrival (lib/school/billingState.js).
// Writes are compare-and-swap on updated_at, so two events for the same
// license can't interleave.
import { sb as defaultSb } from '../../api/_school.js'
import { SCHOOL_TYPES, stripe as defaultStripe, readInvoice, readSubscription } from './stripe.js'
import { onInvoicePaid, onInvoiceFailed, onInvoiceOpened, onSubscriptionUpdated, onSubscriptionDeleted, mirrorFromPlan } from './billingState.js'
import { tierForPriceId } from './pricing.js'
import { sendOwnerAlert } from '../notify/ownerAlert.js'

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

export const LICENSE_SELECT =
  'id,owner_user_id,classroom_id,status,origin,seats,pending_seats,image_allowance,images_used,starts_at,expires_at,' +
  'stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_period_start,stripe_event_at,cancel_at_period_end,' +
  'school_plan_id,price_tier,billing_method,school_name,dpa_version,updated_at'
export const PLAN_SELECT =
  'id,owner_user_id,school_name,status,billing_method,seats,pending_seats,price_tier,starts_at,expires_at,' +
  'stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_period_start,stripe_event_at,cancel_at_period_end,dpa_version,updated_at'

const TABLE = { license: 'class_licenses', plan: 'school_plans' }
const SELECT = { license: LICENSE_SELECT, plan: PLAN_SELECT }
const MAX_CAS = 4
const enc = encodeURIComponent

class Upstream extends Error {}

async function rows(sb, path) {
  const res = await sb(path)
  if (!res.ok) throw new Upstream(`read ${path.split('?')[0]} ${res.status}`)
  const out = await res.json()
  return Array.isArray(out) ? out : []
}

async function byId(sb, kind, id) {
  return (await rows(sb, `/rest/v1/${TABLE[kind]}?id=eq.${id}&select=${SELECT[kind]}`))[0] ?? null
}

async function bySubscription(sb, subId) {
  if (!subId) return null
  const plan = (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subId)}&select=${PLAN_SELECT}`))[0]
  if (plan) return { kind: 'plan', rec: plan }
  const lic = (await rows(sb, `/rest/v1/class_licenses?stripe_subscription_id=eq.${enc(subId)}&school_plan_id=is.null&select=${LICENSE_SELECT}`))[0]
  return lic ? { kind: 'license', rec: lic } : null
}

/// Compare-and-swap PATCH: recompute from a fresh read if someone else
/// wrote in between. `compute(rec)` → patch | null.
async function casApply(sb, kind, rec, compute) {
  let cur = rec
  for (let i = 0; i < MAX_CAS; i++) {
    const patch = compute(cur)
    if (!patch) return cur
    const res = await sb(`/rest/v1/${TABLE[kind]}?id=eq.${cur.id}&updated_at=eq.${enc(cur.updated_at)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) throw new Upstream(`patch ${TABLE[kind]} ${res.status}`)
    const out = await res.json().catch(() => [])
    if (Array.isArray(out) && out.length) return out[0]
    cur = await byId(sb, kind, cur.id)
    if (!cur) return null
  }
  throw new Upstream(`contention on ${TABLE[kind]}`)
}

/// A plan's class licenses mirror its status, expiry and TERM. Two writes,
/// both idempotent: licenses still on an older term move to the plan's
/// term with a fresh picture allowance; then every block gets the mirror.
async function propagatePlan(sb, plan) {
  if (!plan) return
  const m = mirrorFromPlan(plan)
  const now = new Date().toISOString()
  const behind = await sb(
    `/rest/v1/class_licenses?school_plan_id=eq.${plan.id}&starts_at=neq.${enc(plan.starts_at)}`,
    { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...m, images_used: 0, updated_at: now }) }
  )
  if (!behind.ok) throw new Upstream(`propagate term ${behind.status}`)
  const all = await sb(`/rest/v1/class_licenses?school_plan_id=eq.${plan.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...m, updated_at: now }),
  })
  if (!all.ok) throw new Upstream(`propagate ${all.status}`)
}

const cleanText = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/// Link/ownership fields every school record gets from OUR metadata plus
/// Stripe's ids. Only fills what is missing, so a replay changes nothing.
function linkPatch(rec, { customer, subscriptionId, priceId, md, billingMethod }) {
  const p = {}
  if (customer && rec.stripe_customer_id !== customer) p.stripe_customer_id = customer
  if (subscriptionId && rec.stripe_subscription_id !== subscriptionId) {
    p.stripe_subscription_id = subscriptionId
    // A NEW subscription for a class whose old one ended (resolve() refuses
    // a live one): it is unpaid until its first invoice is applied, and
    // its events are ordered afresh.
    if (rec.stripe_subscription_id && ['lapsed', 'canceled'].includes(rec.status)) {
      p.status = 'pending_payment'
      p.stripe_event_at = null
      p.cancel_at_period_end = false
    }
  }
  if (priceId && rec.stripe_price_id !== priceId) {
    p.stripe_price_id = priceId
    const tier = tierForPriceId(priceId)
    if (tier) p.price_tier = tier
  }
  // A class bought on its own after its school-plan block ended leaves the
  // plan: otherwise the plan's next propagation would overwrite it.
  if (md?.type === 'class_license' && rec.school_plan_id) p.school_plan_id = null
  if (billingMethod && rec.billing_method !== billingMethod && (!rec.school_plan_id || p.school_plan_id === null)) p.billing_method = billingMethod
  if (md?.school_name && !rec.school_name && 'classroom_id' in rec) p.school_name = cleanText(md.school_name, 120)
  if (md?.dpa_version && !rec.dpa_version) {
    p.dpa_version = cleanText(md.dpa_version, 40)
    p.dpa_accepted_at = cleanText(md.dpa_accepted_at, 40)
    p.dpa_accepted_by = md.owner_user_id ?? null
  }
  return Object.keys(p).length ? p : null
}

/// The class license a class purchase pays for, created if the class has
/// none (e.g. a class made after the trials ran out). Null if the class is
/// gone or not the buyer's.
async function licenseForClass(sb, md) {
  const classroomId = md.classroom_id
  const owner = md.owner_user_id
  if (!classroomId || !owner) return null
  const cls = (await rows(sb, `/rest/v1/classrooms?id=eq.${enc(classroomId)}&owner_user_id=eq.${enc(owner)}&select=id`))[0]
  if (!cls) return null
  const existing = (await rows(sb, `/rest/v1/class_licenses?classroom_id=eq.${enc(classroomId)}&select=${LICENSE_SELECT}`))[0]
  if (existing) return existing
  // Unusable until a paid invoice is applied: pending_payment, already expired.
  const ins = await sb('/rest/v1/class_licenses', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_user_id: owner, classroom_id: classroomId, origin: 'purchase', status: 'pending_payment',
      billing_method: 'card', seats: 10, image_allowance: 0, expires_at: new Date().toISOString(),
      school_name: cleanText(md.school_name, 120),
    }),
  })
  if (ins.status === 409) return (await rows(sb, `/rest/v1/class_licenses?classroom_id=eq.${enc(classroomId)}&select=${LICENSE_SELECT}`))[0] ?? null
  if (!ins.ok) throw new Upstream(`insert license ${ins.status}`)
  return (await ins.json())[0] ?? null
}

/// The school plan a subscription pays for, created from our metadata on
/// the first event that sees it (card plans; invoice plans are inserted by
/// api/school/checkout.js before the invoice exists).
async function planForSubscription(sb, subId, md, { customer, quantity, priceId }) {
  const found = (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subId)}&select=${PLAN_SELECT}`))[0]
  if (found) return found
  if (!md?.owner_user_id || !cleanText(md.school_name, 120) || !Number.isInteger(quantity)) return null
  const ins = await sb('/rest/v1/school_plans', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_user_id: md.owner_user_id, school_name: cleanText(md.school_name, 120), status: 'pending_payment',
      billing_method: 'card', seats: quantity, price_tier: tierForPriceId(priceId) ?? 'school',
      expires_at: new Date().toISOString(), stripe_customer_id: customer, stripe_subscription_id: subId, stripe_price_id: priceId,
      dpa_version: cleanText(md.dpa_version, 40), dpa_accepted_at: cleanText(md.dpa_accepted_at, 40), dpa_accepted_by: md.owner_user_id,
    }),
  })
  if (ins.status === 409) return (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subId)}&select=${PLAN_SELECT}`))[0] ?? null
  if (!ins.ok) throw new Upstream(`insert plan ${ins.status}`)
  return (await ins.json())[0] ?? null
}

/// Resolves which record an event is about. Metadata first (it is on the
/// session, the subscription, and the invoice's subscription_details),
/// then our own rows by subscription id.
async function resolve(sb, { md, subscriptionId, customer, quantity, priceId, create }) {
  if (md?.type === 'school_plan' && subscriptionId) {
    const rec = create
      ? await planForSubscription(sb, subscriptionId, md, { customer, quantity, priceId })
      : (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subscriptionId)}&select=${PLAN_SELECT}`))[0]
    return rec ? { kind: 'plan', rec } : null
  }
  if (md?.type === 'class_license') {
    const rec = create ? await licenseForClass(sb, md) : null
    if (rec) {
      // A class already paid by ANOTHER live subscription: never re-point it.
      if (rec.stripe_subscription_id && rec.stripe_subscription_id !== subscriptionId && ['active', 'grace', 'pending_payment'].includes(rec.status) && !rec.school_plan_id) {
        return { kind: 'license', rec, conflict: true }
      }
      if (rec.school_plan_id && rec.status !== 'lapsed' && rec.status !== 'canceled') return { kind: 'license', rec, conflict: true }
      return { kind: 'license', rec }
    }
  }
  return bySubscription(sb, subscriptionId)
}

/// True when this event belongs to the schools billing. Reads only.
export async function isSchoolEvent(event, { sb = defaultSb } = {}) {
  if (!HANDLED_EVENTS.includes(event?.type)) return false
  const obj = event.data?.object ?? {}
  if (event.type === 'checkout.session.completed') return SCHOOL_TYPES.includes(obj.metadata?.type)
  if (event.type.startsWith('customer.subscription.')) {
    if (SCHOOL_TYPES.includes(obj.metadata?.type)) return true
    return !!(await bySubscription(sb, obj.id))
  }
  const inv = readInvoice(obj)
  if (SCHOOL_TYPES.includes(inv?.metadata?.type)) return true
  return !!(inv?.subscriptionId && (await bySubscription(sb, inv.subscriptionId)))
}

async function claim(sb, event) {
  const res = await sb('/rest/v1/stripe_school_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ event_id: event.id, type: event.type, object_id: event.data?.object?.id ?? null }),
  })
  if (res.status === 409) return 'duplicate'
  if (!res.ok) throw new Upstream(`claim ${res.status}`)
  return 'claimed'
}

async function release(sb, eventId) {
  await sb(`/rest/v1/stripe_school_events?event_id=eq.${enc(eventId)}`, { method: 'DELETE' }).catch(() => {})
}

async function alert(subject, lines) {
  await sendOwnerAlert({ subject, lines }).catch(() => {})
}

async function applyTerm(sb, target, compute) {
  const after = await casApply(sb, target.kind, target.rec, compute)
  if (target.kind === 'plan') await propagatePlan(sb, after)
  return after
}

async function onCheckout(sb, stripe, session) {
  const md = session.metadata ?? {}
  if (session.mode !== 'subscription' || !session.subscription) return
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
  // Server-to-server read: the period and seats come from Stripe, never
  // from the browser.
  const got = await stripe(`subscriptions/${enc(subId)}`)
  if (!got.ok) throw new Upstream(`subscription read ${got.status}`)
  const sub = readSubscription(got.data)
  const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? sub.customer
  const target = await resolve(sb, { md, subscriptionId: subId, customer, quantity: sub.quantity, priceId: sub.priceId, create: true })
  if (!target) {
    await alert('School payment with no class', [`A ${md.type} checkout completed but its class/plan could not be found.`, `Subscription: ${subId}`, 'Refund or attach it by hand.'])
    return
  }
  if (target.conflict) {
    await alert('Second payment for one class', [`Class license ${target.rec.id} is already on another plan or subscription.`, `New subscription: ${subId}`, 'Refund or cancel one of them in Stripe.'])
    return
  }
  const linked = await casApply(sb, target.kind, target.rec, (r) => linkPatch(r, { customer, subscriptionId: subId, priceId: sub.priceId, md, billingMethod: 'card' }))
  if (session.payment_status === 'paid' && sub.periodStart && sub.periodEnd) {
    await applyTerm(sb, { kind: target.kind, rec: linked }, (r) =>
      onInvoicePaid(r, { periodStart: sub.periodStart, periodEnd: sub.periodEnd, quantity: sub.quantity, billingReason: 'subscription_create' }, target.kind))
  }
}

async function onInvoice(sb, stripe, event) {
  const inv = readInvoice(event.data.object)
  if (!inv?.subscriptionId) return
  let md = inv.metadata ?? {}
  let { quantity, priceId } = inv
  // Old API versions don't copy the subscription's metadata onto the
  // invoice: read it (server-to-server) when we don't know the record yet.
  let target = await resolve(sb, { md, subscriptionId: inv.subscriptionId, customer: inv.customer, quantity, priceId, create: event.type === 'invoice.paid' })
  if (!target && event.type === 'invoice.paid' && !SCHOOL_TYPES.includes(md.type)) {
    const got = await stripe(`subscriptions/${enc(inv.subscriptionId)}`)
    if (got.ok) {
      const sub = readSubscription(got.data)
      md = sub.metadata ?? {}
      quantity = quantity ?? sub.quantity
      priceId = priceId ?? sub.priceId
      target = await resolve(sb, { md, subscriptionId: inv.subscriptionId, customer: inv.customer, quantity, priceId, create: true })
    }
  }
  if (!target || target.conflict) return
  if (event.type === 'invoice.paid') {
    const linked = await casApply(sb, target.kind, target.rec, (r) => linkPatch(r, { customer: inv.customer, subscriptionId: inv.subscriptionId, priceId, md, billingMethod: inv.collectionMethod === 'send_invoice' ? 'invoice' : 'card' }))
    await applyTerm(sb, { kind: target.kind, rec: linked }, (r) => onInvoicePaid(r, { ...inv, quantity }, target.kind))
  } else if (event.type === 'invoice.payment_failed') {
    await applyTerm(sb, target, (r) => onInvoiceFailed(r, inv))
  } else if (event.type === 'invoice.finalized') {
    if (inv.collectionMethod !== 'send_invoice') return
    await applyTerm(sb, target, (r) => onInvoiceOpened(r, inv))
  }
}

async function onSubscription(sb, event) {
  const sub = readSubscription(event.data.object)
  const target = await bySubscription(sb, sub.id)
  if (!target) return
  if (event.type === 'customer.subscription.deleted') {
    await applyTerm(sb, target, (r) => onSubscriptionDeleted(r, event.created))
    return
  }
  await applyTerm(sb, target, (r) => {
    const p = onSubscriptionUpdated(r, sub, event.created, target.kind) ?? {}
    if (sub.priceId && sub.priceId !== r.stripe_price_id) {
      p.stripe_price_id = sub.priceId
      const tier = tierForPriceId(sub.priceId)
      if (tier) p.price_tier = tier
    }
    return Object.keys(p).length ? p : null
  })
}

/**
 * → { handled: false } (not a school event: the caller continues), or
 *   { handled: true, status } (200 applied / duplicate, 500 retry).
 */
export async function handleSchoolStripeEvent(event, { sb = defaultSb, stripe = defaultStripe } = {}) {
  let school
  try {
    school = await isSchoolEvent(event, { sb })
  } catch (e) {
    // Can't tell (database down): ask Stripe to retry rather than let a
    // school event fall through to the consumer branches.
    if (HANDLED_EVENTS.includes(event?.type)) {
      console.error('[school/billing] routing read failed', e?.message)
      return { handled: true, status: 500 }
    }
    return { handled: false }
  }
  if (!school) return { handled: false }

  let claimed
  try {
    claimed = await claim(sb, event)
  } catch (e) {
    console.error('[school/billing] ledger claim failed', e?.message)
    return { handled: true, status: 500 }
  }
  if (claimed === 'duplicate') return { handled: true, status: 200, duplicate: true }

  try {
    if (event.type === 'checkout.session.completed') await onCheckout(sb, stripe, event.data.object)
    else if (event.type.startsWith('invoice.')) await onInvoice(sb, stripe, event)
    else await onSubscription(sb, event)
    return { handled: true, status: 200 }
  } catch (e) {
    console.error('[school/billing] apply failed', event.type, e?.message)
    await release(sb, event.id)
    return { handled: true, status: 500 }
  }
}
