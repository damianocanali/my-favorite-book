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
import { SCHOOL_TYPES, stripe as defaultStripe, readInvoice, readSubscription, cancelAndRefund } from './stripe.js'
import { onInvoicePaid, onInvoiceFailed, onInvoiceOpened, onSubscriptionUpdated, onSubscriptionDeleted, mirrorFromPlan } from './billingState.js'
import { tierForPriceId, IMAGES_PER_SEAT, UNPAID_IMAGES_PER_SEAT } from './pricing.js'
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
  'school_plan_id,price_tier,billing_method,school_name,dpa_version,needs_review,review_reason,updated_at'
export const PLAN_SELECT =
  'id,owner_user_id,school_name,status,billing_method,seats,pending_seats,price_tier,starts_at,expires_at,' +
  'stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_period_start,stripe_event_at,cancel_at_period_end,dpa_version,needs_review,review_reason,updated_at'

const TABLE = { license: 'class_licenses', plan: 'school_plans' }
const SELECT = { license: LICENSE_SELECT, plan: PLAN_SELECT }
const MAX_CAS = 4
/// A claim with no processed_at older than this was abandoned (the function
/// was killed mid-apply): the next delivery may take it over (review I10).
export const STALE_CLAIM_MS = 5 * 60 * 1000
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

/// A plan's class licenses (seat blocks) mirror its status, expiry and
/// TERM — never its Stripe ids. Per block, idempotent: a block still on an
/// older term moves to the plan's term with a fresh picture allowance; the
/// allowance is 300 per seat once paid, 50 while the plan is unpaid
/// (review I6).
async function propagatePlan(sb, plan) {
  if (!plan) return
  const m = mirrorFromPlan(plan)
  const perSeat = plan.status === 'pending_payment' ? UNPAID_IMAGES_PER_SEAT : IMAGES_PER_SEAT
  const blocks = await rows(sb, `/rest/v1/class_licenses?school_plan_id=eq.${plan.id}&select=id,seats,starts_at,status,expires_at,image_allowance,stripe_period_start,cancel_at_period_end`)
  for (const b of blocks) {
    const patch = {}
    for (const [k, v] of Object.entries(m)) if (b[k] !== v) patch[k] = v
    const allowance = perSeat * (b.seats ?? 0)
    if (b.image_allowance !== allowance) patch.image_allowance = allowance
    if (b.starts_at !== plan.starts_at) patch.images_used = 0
    if (!Object.keys(patch).length) continue
    const res = await sb(`/rest/v1/class_licenses?id=eq.${b.id}&school_plan_id=eq.${plan.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) throw new Upstream(`propagate ${res.status}`)
  }
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
    const tier = tierForPriceId(priceId, process.env, 'classroom_id' in rec ? 'license' : 'plan')
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
  if (found) return { rec: found }
  // An invoice plan approved by the owner carries its plan id (the plan row
  // existed before the subscription; an event may beat the row update).
  if (md?.plan_id) {
    const byPlan = (await rows(sb, `/rest/v1/school_plans?id=eq.${enc(md.plan_id)}&owner_user_id=eq.${enc(md.owner_user_id ?? '')}&select=${PLAN_SELECT}`))[0]
    if (!byPlan) return null
    if (byPlan.stripe_subscription_id && byPlan.stripe_subscription_id !== subId) return { rec: byPlan, conflict: true }
    return { rec: byPlan }
  }
  if (!md?.owner_user_id || !cleanText(md.school_name, 120) || !Number.isInteger(quantity)) return null
  // A card plan: one live or unpaid plan per school admin (review I11).
  const other = (await rows(sb, `/rest/v1/school_plans?owner_user_id=eq.${enc(md.owner_user_id)}&status=in.(pending_approval,pending_payment,active,grace)&select=${PLAN_SELECT}`))[0]
  if (other) return { rec: other, conflict: true }
  const ins = await sb('/rest/v1/school_plans', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_user_id: md.owner_user_id, school_name: cleanText(md.school_name, 120), status: 'pending_payment',
      billing_method: 'card', seats: quantity, price_tier: tierForPriceId(priceId, process.env, 'plan') ?? 'school',
      expires_at: new Date().toISOString(), stripe_customer_id: customer, stripe_subscription_id: subId, stripe_price_id: priceId,
      dpa_version: cleanText(md.dpa_version, 40), dpa_accepted_at: cleanText(md.dpa_accepted_at, 40), dpa_accepted_by: md.owner_user_id,
    }),
  })
  if (ins.status === 409) {
    const again = (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subId)}&select=${PLAN_SELECT}`))[0]
    return again ? { rec: again } : null
  }
  if (!ins.ok) throw new Upstream(`insert plan ${ins.status}`)
  const rec = (await ins.json())[0]
  return rec ? { rec } : null
}

/// Resolves which record an event is about. Metadata first (it is on the
/// session, the subscription, and the invoice's subscription_details),
/// then our own rows by subscription id.
async function resolve(sb, { md, subscriptionId, customer, quantity, priceId, create }) {
  if (md?.type === 'school_plan' && subscriptionId) {
    if (create) {
      const got = await planForSubscription(sb, subscriptionId, md, { customer, quantity, priceId })
      return got ? { kind: 'plan', ...got } : null
    }
    const rec = (await rows(sb, `/rest/v1/school_plans?stripe_subscription_id=eq.${enc(subscriptionId)}&select=${PLAN_SELECT}`))[0]
      ?? (md.plan_id ? (await rows(sb, `/rest/v1/school_plans?id=eq.${enc(md.plan_id)}&select=${PLAN_SELECT}`))[0] : null)
    return rec ? { kind: 'plan', rec } : null
  }
  if (md?.type === 'class_license') {
    const rec = create ? await licenseForClass(sb, md) : null
    if (rec) {
      // A class already paid by ANOTHER live subscription: never re-point it.
      if (rec.stripe_subscription_id && rec.stripe_subscription_id !== subscriptionId && ['active', 'grace', 'pending_payment', 'comped'].includes(rec.status) && !rec.school_plan_id) {
        return { kind: 'license', rec, conflict: true }
      }
      if (rec.school_plan_id && rec.status !== 'lapsed' && rec.status !== 'canceled') return { kind: 'license', rec, conflict: true }
      if (rec.status === 'comped') return { kind: 'license', rec, conflict: true }
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

/// 'claimed' | 'duplicate' (already processed) | 'busy' (another delivery
/// is applying it right now: answer 500 so Stripe retries later).
/// A claim that was never marked processed and is older than STALE_CLAIM_MS
/// is taken over (review I10: a function killed mid-apply never loses the
/// event for good).
async function claim(sb, event, now = Date.now()) {
  const res = await sb('/rest/v1/stripe_school_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ event_id: event.id, type: event.type, object_id: event.data?.object?.id ?? null, received_at: new Date(now).toISOString() }),
  })
  if (res.ok) return 'claimed'
  if (res.status !== 409) throw new Upstream(`claim ${res.status}`)
  const [row] = await rows(sb, `/rest/v1/stripe_school_events?event_id=eq.${enc(event.id)}&select=event_id,received_at,processed_at`)
  if (!row) return 'busy'
  if (row.processed_at) return 'duplicate'
  const cutoff = new Date(now - STALE_CLAIM_MS).toISOString()
  // Conditional takeover: only one retry can win a stale claim.
  const take = await sb(
    `/rest/v1/stripe_school_events?event_id=eq.${enc(event.id)}&processed_at=is.null&received_at=lt.${enc(cutoff)}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ received_at: new Date(now).toISOString() }) }
  )
  if (!take.ok) throw new Upstream(`reclaim ${take.status}`)
  const won = await take.json().catch(() => [])
  return Array.isArray(won) && won.length ? 'claimed' : 'busy'
}

async function markProcessed(sb, eventId) {
  const r = await sb(`/rest/v1/stripe_school_events?event_id=eq.${enc(eventId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ processed_at: new Date().toISOString() }),
  }).catch(() => null)
  // Not fatal: the event is applied; at worst a later delivery re-applies
  // it after STALE_CLAIM_MS, which the term rule makes a no-op.
  if (!r?.ok) console.error('[school/billing] could not mark processed', eventId)
}

async function release(sb, eventId) {
  await sb(`/rest/v1/stripe_school_events?event_id=eq.${enc(eventId)}&processed_at=is.null`, { method: 'DELETE' }).catch(() => {})
}

async function alert(subject, lines) {
  await sendOwnerAlert({ subject, lines }).catch(() => {})
}

/// Applies compute() with CAS; a plan's blocks follow. Anything the state
/// machine refused to mirror (needs_review) is sent to the owner.
async function applyTerm(sb, target, compute) {
  let flagged = null
  const after = await casApply(sb, target.kind, target.rec, (r) => {
    const p = compute(r)
    flagged = p?.needs_review ? p.review_reason : null
    return p
  })
  if (target.kind === 'plan') await propagatePlan(sb, after)
  if (flagged) {
    await alert('School billing needs a look', [
      `${target.kind === 'plan' ? 'School plan' : 'Class license'} ${target.rec.id}: ${flagged}.`,
      'The app did not mirror this change. Check the subscription in Stripe (quantity changes belong in the app).',
    ])
  }
  return after
}

/// A second subscription for a class or plan that already has one (review
/// I11): cancel the NEW one now, refund it, flag the record, tell the owner.
async function duplicateSubscription(sb, stripe, target, subId) {
  const out = await cancelAndRefund(stripe, subId)
  await casApply(sb, target.kind, target.rec, (r) =>
    r.needs_review ? null : { needs_review: true, review_reason: `second subscription ${subId} canceled${out.refunded ? ' and refunded' : ''}` })
  await alert('Second payment canceled', [
    `${target.kind === 'plan' ? 'School plan' : 'Class license'} ${target.rec.id} already had a plan.`,
    `New subscription ${subId}: canceled ${out.canceled ? 'yes' : 'NO — cancel it in Stripe'}, refunded ${out.refunded ? 'yes' : 'NO — check the payment'}.`,
  ])
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
  if (target.conflict) return duplicateSubscription(sb, stripe, target, subId)
  const linked = await casApply(sb, target.kind, target.rec, (r) => linkPatch(r, { customer, subscriptionId: subId, priceId: sub.priceId, md, billingMethod: 'card' }))
  if (session.payment_status === 'paid' && sub.periodStart && sub.periodEnd) {
    await applyTerm(sb, { kind: target.kind, rec: linked }, (r) =>
      onInvoicePaid(r, { periodStart: sub.periodStart, periodEnd: sub.periodEnd, quantity: sub.quantity, billingReason: 'subscription_create' }, target.kind))
  }
}

async function onInvoice(sb, stripe, event) {
  const inv = readInvoice(event.data.object)
  if (!inv?.subscriptionId) return
  const md = inv.metadata ?? {}
  // isSchoolEvent only routes an invoice here when its metadata says school
  // or its subscription is already ours, so a card purchase whose invoice
  // lacks metadata (old API) is covered by checkout.session.completed, and
  // an invoice plan's row exists before its first invoice.
  const target = await resolve(sb, { md, subscriptionId: inv.subscriptionId, customer: inv.customer, quantity: inv.quantity, priceId: inv.priceId, create: event.type === 'invoice.paid' })
  if (!target) return
  if (target.conflict) {
    if (event.type === 'invoice.paid') await duplicateSubscription(sb, stripe, target, inv.subscriptionId)
    return
  }
  if (event.type === 'invoice.paid') {
    const linked = await casApply(sb, target.kind, target.rec, (r) => linkPatch(r, { customer: inv.customer, subscriptionId: inv.subscriptionId, priceId: inv.priceId, md, billingMethod: inv.collectionMethod === 'send_invoice' ? 'invoice' : 'card' }))
    await applyTerm(sb, { kind: target.kind, rec: linked }, (r) => onInvoicePaid(r, inv, target.kind))
  } else if (event.type === 'invoice.payment_failed') {
    await applyTerm(sb, target, (r) => onInvoiceFailed(r, inv))
  } else if (event.type === 'invoice.finalized') {
    if (inv.collectionMethod !== 'send_invoice') return
    await applyTerm(sb, target, (r) => onInvoiceOpened(r, inv))
  }
}

/// What a reduction may not go below: the children enrolled in a class, or
/// the seats a plan has given to classes.
async function seatFloor(sb, target) {
  if (target.kind === 'license') {
    if (!target.rec.classroom_id) return null
    return (await rows(sb, `/rest/v1/class_students?classroom_id=eq.${target.rec.classroom_id}&status=eq.active&select=id`)).length
  }
  return (await rows(sb, `/rest/v1/class_licenses?school_plan_id=eq.${target.rec.id}&select=seats`)).reduce((n, b) => n + (b.seats ?? 0), 0)
}

async function onSubscription(sb, event) {
  const sub = readSubscription(event.data.object)
  const target = await bySubscription(sb, sub.id)
  if (!target) return
  if (event.type === 'customer.subscription.deleted') {
    await applyTerm(sb, target, (r) => onSubscriptionDeleted(r, event.created))
    return
  }
  const floor = Number.isInteger(sub.quantity) && sub.quantity < target.rec.seats ? await seatFloor(sb, target) : null
  await applyTerm(sb, target, (r) => {
    const p = onSubscriptionUpdated(r, sub, event.created, target.kind, { floor }) ?? {}
    if (sub.priceId && sub.priceId !== r.stripe_price_id) {
      p.stripe_price_id = sub.priceId
      const tier = tierForPriceId(sub.priceId, process.env, target.kind)
      if (tier) p.price_tier = tier
    }
    return Object.keys(p).length ? p : null
  })
}

/**
 * → { handled: false } (not a school event: the caller continues), or
 *   { handled: true, status } (200 applied / duplicate, 500 retry).
 */
export async function handleSchoolStripeEvent(event, { sb = defaultSb, stripe = defaultStripe, now = Date.now() } = {}) {
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
    claimed = await claim(sb, event, now)
  } catch (e) {
    console.error('[school/billing] ledger claim failed', e?.message)
    return { handled: true, status: 500 }
  }
  if (claimed === 'duplicate') return { handled: true, status: 200, duplicate: true }
  if (claimed === 'busy') return { handled: true, status: 500, busy: true }

  try {
    if (event.type === 'checkout.session.completed') await onCheckout(sb, stripe, event.data.object)
    else if (event.type.startsWith('invoice.')) await onInvoice(sb, stripe, event)
    else await onSubscription(sb, event)
  } catch (e) {
    console.error('[school/billing] apply failed', event.type, e?.message)
    await release(sb, event.id)
    return { handled: true, status: 500 }
  }
  await markProcessed(sb, event.id)
  return { handled: true, status: 200 }
}
