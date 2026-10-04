// "Plan & billing" for one class (Stage 4).
//
// GET  ?classId=            → { license, students, plan, offers, can_manage_billing, billing_admin }
//      Status, seats used/total, renew date. NO prices: the web shows them
//      from lib/school/pricing.js, the iPad shows none (App Store 3.1.3).
// GET  ?classId=&invoices=1 → { invoices } (the payer only)
// POST { classId, action: 'portal' }          → { url } Stripe Customer Portal (the payer only)
// POST { classId, action: 'seats', seats }    → seat change on a CARD class license:
//      more seats now (prorated by Stripe), fewer at the renewal, never
//      below the students enrolled. Verified teachers only.
// POST { action: 'offer_accept'|'offer_decline', offerId } → a school
//      admin's seat block offered to this teacher's class.
//
// Owner feedback round 5: invoices, the portal and seat changes need a
// school billing admin (lib/school/billingAdmin.js) — 403
// billing_admin_required otherwise. The status GET and answering a seat
// offer (no money moves for the teacher) stay open to the class owner;
// `billing_admin` tells the web whether to show Plan & billing or only the
// neutral status line.
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireTeacher, teacherVerification, billingAdminFailure, sb, json, isUuid } from '../_school.js'
import { isBillingAdmin } from '../../lib/school/billingAdmin.js'
import { checkoutBaseUrl } from '../_origin.js'
import { stripe as defaultStripe } from '../../lib/school/stripe.js'
import { listInvoices, portalUrl, subscriptionItem, setQuantity, chargeSeatAdd } from '../../lib/school/billingApi.js'
import { refundInvoice } from '../../lib/school/stripe.js'
import { sendOwnerAlert } from '../../lib/notify/ownerAlert.js'
import { planSeatChange } from '../../lib/school/billingState.js'
import { MIN_CLASS_SEATS, MAX_CLASS_SEATS, imageAllowanceFor, seatAddQuote } from '../../lib/school/pricing.js'

export const deps = { stripe: defaultStripe }

const LICENSE_COLS =
  'id,owner_user_id,status,origin,seats,pending_seats,expires_at,starts_at,billing_method,cancel_at_period_end,' +
  'school_plan_id,image_allowance,images_used,stripe_customer_id,stripe_subscription_id,price_tier,last_seat_add_invoice,updated_at'

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
    // The tier NAME (the web looks the amount up in lib/school/pricing.js;
    // the iPad never shows it).
    tier: l.price_tier ?? null,
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
  if (!checkRateLimit(`school-offer-answer:${t.auth.userId}`, 30).allowed) {
    return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
  }
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
      const billingAdmin = isBillingAdmin(o.auth, process.env.OWNER_USER_ID)
      if (params.get('invoices') === '1') {
        const denied = billingAdminFailure(req, o.auth)
        if (denied) return denied
        if (!isPayer || !pay.customer) return json(req, 200, { invoices: [] })
        const invoices = await listInvoices(deps.stripe, pay.customer, pay.subscription)
        if (!invoices) return json(req, 502, { error: 'Could not load invoices', code: 'upstream' })
        return json(req, 200, { invoices })
      }
      const students = await enrolled(o.classroom.id)
      return json(req, 200, {
        license: licenseView(license),
        students,
        // Review I4: more children than paid seats (e.g. enrolled during the
        // trial, then fewer seats bought). Adding children is blocked until
        // seats ≥ enrolled; the class print takes at most `seats` books.
        over_seats: !!license && Number.isInteger(license.seats) && students > license.seats,
        plan: plan ? { school_name: plan.school_name, status: plan.status, mine: plan.owner_user_id === o.auth.userId } : null,
        offers: await offersFor(o.classroom.id),
        can_manage_billing: billingAdmin && isPayer && !!pay.customer,
        billing_admin: billingAdmin,
      })
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = await req.json().catch(() => ({}))
    if (body.action === 'offer_accept' || body.action === 'offer_decline') return await handleOffer(req, body)

    const o = await requireClassOwner(req, body.classId)
    if (!o.ok) return o.response
    const denied = billingAdminFailure(req, o.auth)
    if (denied) return denied
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
      // Review N2: the browser sends one request_id per seat form, reused on
      // a retry or double click, so Stripe sees the same idempotency keys.
      if (!isUuid(body.request_id)) return json(req, 400, { error: 'Missing request id', code: 'bad_request' })
      const requestId = body.request_id
      // Review N8: no seat purchases while the renewal payment is failing.
      if (change.mode === 'increase' && license.status === 'grace') {
        return json(req, 409, { error: 'Pay the renewal first, then add seats', code: 'renewal_failed' })
      }
      const item = await subscriptionItem(deps.stripe, license.stripe_subscription_id)
      if (!item) return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      const setStripe = (q) => setQuantity(deps.stripe, license.stripe_subscription_id, item.itemId, q, `seats-${license.id}-${q}-${requestId}`)
      const patchRow = async (patch) => {
        const upd = await sb(`/rest/v1/class_licenses?id=eq.${license.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        })
        if (!upd.ok) return null
        const [after] = await upd.json()
        return after ?? { ...license, ...patch }
      }

      if (change.mode === 'increase') {
        // Added seats cost the FULL yearly per-seat price for this term
        // (review I5), measured from the PAID seats — never from a pending
        // reduction's lower Stripe quantity (review I2).
        const added = body.seats - license.seats
        const quote = seatAddQuote(license.price_tier ?? 'standard', added)
        if (!quote) return json(req, 503, { error: 'Payments not configured', code: 'not_configured' })
        const charged = await chargeSeatAdd(deps.stripe, {
          customer: item.customer ?? license.stripe_customer_id,
          paymentMethod: item.paymentMethod,
          collectionMethod: item.collectionMethod,
          quote,
          description: `${added} more seat${added === 1 ? '' : 's'} for the current school year`,
          metadata: { type: 'class_license_seats', license_id: license.id, classroom_id: o.classroom.id, seats_from: String(license.seats), seats_to: String(body.seats) },
          key: `seat-add-${license.id}-${license.seats}-${body.seats}-${requestId}`,
        })
        if (!charged.ok) {
          if (charged.voidFailed) await sendOwnerAlert({ subject: 'Seat-add invoice not voided', lines: [`Class license ${license.id}: invoice ${charged.invoiceId} failed to charge and could not be voided. Check it in Stripe.`] })
          return charged.code === 'payment_failed'
            ? json(req, 402, { error: 'The card was declined; seats are unchanged', code: 'payment_failed' })
            : json(req, 502, { error: 'Could not change seats', code: 'upstream' })
        }
        // Our row first (only if it still has the seats we charged from —
        // review N2), then Stripe: the webhook then sees quantity == seats.
        const cas = await sb(`/rest/v1/class_licenses?id=eq.${license.id}&seats=eq.${license.seats}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ seats: body.seats, image_allowance: imageAllowanceFor(body.seats), pending_seats: null, last_seat_add_invoice: charged.invoiceId, updated_at: new Date().toISOString() }),
        })
        if (!cas.ok) {
          await sendOwnerAlert({ subject: 'Seats paid but not recorded', lines: [`Class license ${license.id}: seats ${license.seats} → ${body.seats} were paid (invoice ${charged.invoiceId}) but the row update failed.`] })
          return json(req, 502, { error: 'Seats paid; refresh in a minute', code: 'upstream' })
        }
        let [after] = await cas.json().catch(() => [])
        if (!after) {
          const now = await loadLicense(o.classroom.id)
          // A replay of THIS request (same invoice) already applied it.
          // Anything else — another tab's change, even to the same count —
          // won the race: give this charge back (review R1).
          if (now?.last_seat_add_invoice !== charged.invoiceId) {
            const refunded = await refundInvoice(deps.stripe, charged.invoiceId, `seat-add-refund-${charged.invoiceId}`)
            await sendOwnerAlert({ subject: 'Seat add refunded (seats changed meanwhile)', lines: [`Class license ${license.id}: ${license.seats} → ${body.seats} charged on invoice ${charged.invoiceId}, but the seats had changed. Refunded: ${refunded ? 'yes' : 'NO — refund it in Stripe'}.`] })
            return refunded
              ? json(req, 409, { error: 'The seats changed meanwhile. Nothing was charged; take another look.', code: 'seats_changed' })
              : json(req, 409, { error: "The seats changed meanwhile. We're refunding this charge; contact support if it doesn't appear.", code: 'seats_changed_refunding' })
          }
          after = now
        }
        const q = await setStripe(body.seats)
        if (!q.ok) await sendOwnerAlert({ subject: 'Stripe quantity not raised', lines: [`Class license ${license.id} paid for ${body.seats} seats (invoice ${charged.invoiceId}); set the subscription quantity to ${body.seats} (no proration).`] })
        return json(req, 200, { license: licenseView(after), mode: 'increase' })
      }

      // A reduction (or undoing one): our row first, then Stripe, no
      // proration — nothing is refunded; the renewal bills the new count.
      const pending = change.mode === 'decrease' ? body.seats : null
      const after = await patchRow({ pending_seats: pending })
      if (!after) return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      const q = await setStripe(pending ?? license.seats)
      if (!q.ok) {
        await patchRow({ pending_seats: license.pending_seats ?? null })
        return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      }
      return json(req, 200, { license: licenseView(after), mode: change.mode })
    }

    return json(req, 400, { error: 'Unknown action', code: 'bad_request' })
  } catch (e) {
    console.error('[school/billing] error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
