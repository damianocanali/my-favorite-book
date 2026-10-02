// "Plan & billing" for one class (Stage 4).
//
// GET  ?classId=            → { license, students, plan, offers, can_manage_billing }
//      Status, seats used/total, renew date. NO prices: the web shows them
//      from lib/school/pricing.js, the iPad shows none (App Store 3.1.3).
// GET  ?classId=&invoices=1 → { invoices } (the payer only)
// POST { classId, action: 'portal' }          → { url } Stripe Customer Portal (the payer only)
// POST { classId, action: 'seats', seats }    → seat change on a CARD class license:
//      more seats now (prorated by Stripe), fewer at the renewal, never
//      below the students enrolled. Verified teachers only.
// POST { action: 'offer_accept'|'offer_decline', offerId } → a school
//      admin's seat block offered to this teacher's class.
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireTeacher, teacherVerification, sb, json, isUuid } from '../_school.js'
import { checkoutBaseUrl } from '../_origin.js'
import { stripe as defaultStripe } from '../../lib/school/stripe.js'
import { listInvoices, portalUrl, subscriptionItem, changeQuantity } from '../../lib/school/billingApi.js'
import { planSeatChange } from '../../lib/school/billingState.js'
import { MIN_CLASS_SEATS, MAX_CLASS_SEATS, imageAllowanceFor } from '../../lib/school/pricing.js'

export const deps = { stripe: defaultStripe }

const LICENSE_COLS =
  'id,owner_user_id,status,origin,seats,pending_seats,expires_at,starts_at,billing_method,cancel_at_period_end,' +
  'school_plan_id,image_allowance,images_used,stripe_customer_id,stripe_subscription_id,updated_at'

async function loadLicense(classroomId) {
  const res = await sb(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=${LICENSE_COLS}`)
  if (!res.ok) throw new Error(`license ${res.status}`)
  return (await res.json())[0] ?? null
}

async function loadPlan(planId) {
  if (!planId) return null
  const res = await sb(`/rest/v1/school_plans?id=eq.${planId}&select=id,owner_user_id,school_name,status,expires_at,billing_method,cancel_at_period_end,stripe_customer_id,stripe_subscription_id`)
  if (!res.ok) throw new Error(`plan ${res.status}`)
  return (await res.json())[0] ?? null
}

async function enrolled(classroomId) {
  const res = await sb(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id`)
  if (!res.ok) throw new Error(`students ${res.status}`)
  return (await res.json()).length
}

/// Who pays: a card class license → its owner; a seat block → the plan's owner.
function payer(license, plan) {
  if (!license) return null
  if (license.school_plan_id) return plan ? { userId: plan.owner_user_id, customer: plan.stripe_customer_id, subscription: plan.stripe_subscription_id } : null
  return { userId: license.owner_user_id, customer: license.stripe_customer_id, subscription: license.stripe_subscription_id }
}

function licenseView(l) {
  if (!l) return null
  return {
    status: l.status, origin: l.origin, seats: l.seats, pending_seats: l.pending_seats ?? null,
    expires_at: l.expires_at, billing_method: l.billing_method ?? null, cancel_at_period_end: !!l.cancel_at_period_end,
    image_allowance: l.image_allowance, images_used: l.images_used, school_plan: !!l.school_plan_id,
  }
}

async function offersFor(classroomId) {
  const res = await sb(`/rest/v1/school_seat_offers?classroom_id=eq.${classroomId}&status=eq.pending&select=id,seats,created_at,school_plans(school_name)`)
  if (!res.ok) throw new Error(`offers ${res.status}`)
  return (await res.json()).map((o) => ({ id: o.id, seats: o.seats, created_at: o.created_at, school_name: (Array.isArray(o.school_plans) ? o.school_plans[0] : o.school_plans)?.school_name ?? null }))
}

async function handleOffer(req, body) {
  const t = await requireTeacher(req)
  if (!t.ok) return t.response
  if (!isUuid(body.offerId)) return json(req, 400, { error: 'Invalid offer', code: 'bad_request' })
  if (!(await teacherVerification(t.auth)).verified) {
    return json(req, 403, { error: "We're confirming you're a teacher — usually within a day", code: 'teacher_unverified' })
  }
  const res = await sb(`/rest/v1/school_seat_offers?id=eq.${body.offerId}&status=eq.pending&select=id,plan_id,classroom_id,seats,classrooms(owner_user_id)`)
  if (!res.ok) throw new Error(`offer ${res.status}`)
  const [offer] = await res.json()
  const owner = (Array.isArray(offer?.classrooms) ? offer.classrooms[0] : offer?.classrooms)?.owner_user_id
  // Same answer for missing and someone else's.
  if (!offer || owner !== t.auth.userId) return json(req, 404, { error: 'Offer not found', code: 'offer_not_found' })
  const now = new Date().toISOString()
  if (body.action === 'offer_decline') {
    await sb(`/rest/v1/school_seat_offers?id=eq.${offer.id}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'declined', decided_by: t.auth.userId, decided_at: now }) })
    return json(req, 200, { ok: true })
  }
  const rpc = await sb('/rest/v1/rpc/school_plan_assign', {
    method: 'POST',
    body: JSON.stringify({ p_plan_id: offer.plan_id, p_classroom_id: offer.classroom_id, p_seats: offer.seats, p_owner: t.auth.userId }),
  })
  if (!rpc.ok) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  const out = await rpc.json()
  if (out?.error) return json(req, 409, { error: 'Could not take these seats', code: out.error, ...(out.available != null ? { available: out.available } : {}) })
  await sb(`/rest/v1/school_seat_offers?id=eq.${offer.id}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted', decided_by: t.auth.userId, decided_at: now }) })
  return json(req, 200, { ok: true })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const o = await requireClassOwner(req, params.get('classId'))
      if (!o.ok) return o.response
      const license = await loadLicense(o.classroom.id)
      const plan = await loadPlan(license?.school_plan_id)
      const pay = payer(license, plan)
      const isPayer = !!pay && pay.userId === o.auth.userId
      if (params.get('invoices') === '1') {
        if (!isPayer || !pay.customer) return json(req, 200, { invoices: [] })
        const invoices = await listInvoices(deps.stripe, pay.customer, pay.subscription)
        if (!invoices) return json(req, 502, { error: 'Could not load invoices', code: 'upstream' })
        return json(req, 200, { invoices })
      }
      return json(req, 200, {
        license: licenseView(license),
        students: await enrolled(o.classroom.id),
        plan: plan ? { school_name: plan.school_name, status: plan.status, mine: plan.owner_user_id === o.auth.userId } : null,
        offers: await offersFor(o.classroom.id),
        can_manage_billing: isPayer && !!pay.customer,
      })
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = await req.json().catch(() => ({}))
    if (body.action === 'offer_accept' || body.action === 'offer_decline') return await handleOffer(req, body)

    const o = await requireClassOwner(req, body.classId)
    if (!o.ok) return o.response
    if (!checkRateLimit(`school-billing:${o.auth.userId}`, 30).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const license = await loadLicense(o.classroom.id)
    const plan = await loadPlan(license?.school_plan_id)
    const pay = payer(license, plan)

    if (body.action === 'portal') {
      if (!pay || pay.userId !== o.auth.userId || !pay.customer) return json(req, 403, { error: 'Only the person who pays can manage billing', code: 'not_payer' })
      const url = await portalUrl(deps.stripe, pay.customer, `${checkoutBaseUrl(req)}/teacher/class/${o.classroom.id}`)
      if (!url) return json(req, 502, { error: 'Could not open billing', code: 'upstream' })
      return json(req, 200, { url })
    }

    if (body.action === 'seats') {
      if (!(await teacherVerification(o.auth)).verified) {
        return json(req, 403, { error: "We're confirming you're a teacher — usually within a day", code: 'teacher_unverified' })
      }
      if (!license || license.school_plan_id) return json(req, 409, { error: 'Seats for this class are managed by the school plan', code: 'managed_by_school_plan' })
      if (!license.stripe_subscription_id || !['active', 'grace'].includes(license.status)) {
        return json(req, 409, { error: 'This class has no paid plan yet', code: 'no_paid_plan' })
      }
      const change = planSeatChange({
        current: license.seats, pending: license.pending_seats, requested: body.seats,
        inUse: await enrolled(o.classroom.id), min: MIN_CLASS_SEATS, max: MAX_CLASS_SEATS,
      })
      if (!change.ok) return json(req, 400, { error: 'That seat count is not possible', code: change.code, ...(change.min != null ? { min: change.min } : {}), ...(change.max != null ? { max: change.max } : {}) })
      if (change.mode === 'none') return json(req, 200, { license: licenseView(license) })
      const item = await subscriptionItem(deps.stripe, license.stripe_subscription_id)
      if (!item) return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      const target = change.mode === 'cancel_decrease' ? license.seats : body.seats
      const r = await changeQuantity(deps.stripe, license.stripe_subscription_id, item, target, change.mode === 'increase' ? 'increase' : 'decrease')
      if (!r.ok) return json(req, 502, { error: 'Could not change seats', code: r.status === 402 ? 'payment_failed' : 'upstream' })
      // Mirror what STRIPE now has (never the request): the webhook sends
      // the same, and is a no-op then.
      let patch = null
      if (change.mode === 'increase') {
        if (r.pending || r.quantity !== target) return json(req, 402, { error: 'The card was declined; seats are unchanged', code: 'payment_failed' })
        patch = { seats: target, image_allowance: imageAllowanceFor(target), pending_seats: null }
      } else if (change.mode === 'decrease') patch = { pending_seats: target }
      else patch = { pending_seats: null }
      const upd = await sb(`/rest/v1/class_licenses?id=eq.${license.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      })
      if (!upd.ok) return json(req, 502, { error: 'Seats changed; refresh in a minute', code: 'upstream' })
      const [after] = await upd.json()
      return json(req, 200, { license: licenseView(after ?? { ...license, ...patch }), mode: change.mode })
    }

    return json(req, 400, { error: 'Unknown action', code: 'bad_request' })
  } catch (e) {
    console.error('[school/billing] error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
