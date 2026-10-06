// Buying seats (Stage 4). Web only — the iOS app never calls this and shows
// no price (App Store 3.1.3). Verified school billing admins only (the
// owner, or app_metadata.billing_admin — lib/school/billingAdmin.js);
// anyone else gets 403 billing_admin_required.
//
// POST { kind: 'class', classId, seats, school_name, dpa_accept: true }
//   → Stripe Checkout (subscription, yearly, quantity = seats). The founding
//     price is applied automatically while eligible. → { url }
// POST { kind: 'school', seats, school_name, dpa_accept: true, billing: 'card'|'invoice' }
//   card    → Stripe Checkout for the school plan → { url }
//   invoice → a plan request (status pending_approval) for the OWNER to
//             approve (review I6; api/admin/school-plans.js). Nothing is
//             usable and nothing is sent to Stripe until then; the owner is
//             alerted. Approval creates the send_invoice subscription (net
//             30) and makes the plan usable as pending_payment. → { plan }
//   One open unpaid plan per teacher (also a unique index, migration 034).
//
// The amount is never taken from the client: the Price comes from env via
// lib/school/pricing.js and the seat count is validated here; the webhook
// then reads seats back from Stripe (lib/school/billingWebhook.js).
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireBillingAdmin, sb, json, isUuid } from '../_school.js'
import { checkoutBaseUrl } from '../_origin.js'
import { quoteClass, quoteSchool, priceIdFor } from '../../lib/school/pricing.js'
import { stripe as defaultStripe } from '../../lib/school/stripe.js'
import { ensureCustomer, purchaseBasics, expireOpenSessions } from '../../lib/school/billingApi.js'
import { sendOwnerAlert } from '../../lib/notify/ownerAlert.js'

// A class that already has a paid or comped license can't be bought again
// (change seats instead). Trial / lapsed / canceled / none can.
const BUYABLE = ['trial', 'lapsed', 'canceled']

export const deps = { stripe: defaultStripe }

async function activeStudentCount(classroomId) {
  const res = await sb(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id`)
  if (!res.ok) throw new Error(`students ${res.status}`)
  return (await res.json()).length
}

async function buyClass(req, auth, body, basics) {
  if (!isUuid(body.classId)) return json(req, 400, { error: 'Invalid class id', code: 'bad_request' })
  const cls = await sb(`/rest/v1/classrooms?id=eq.${body.classId}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=id,archived_at,class_licenses(status,school_plan_id)`)
  if (!cls.ok) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  const [row] = await cls.json()
  if (!row || row.archived_at) return json(req, 404, { error: 'Class not found', code: 'class_not_found' })
  const lic = Array.isArray(row.class_licenses) ? row.class_licenses[0] : row.class_licenses
  if (lic && !BUYABLE.includes(lic.status)) return json(req, 409, { error: 'This class already has a plan', code: 'already_licensed' })

  const quote = quoteClass(body.seats)
  if (!quote.ok) return json(req, 400, { error: 'Choose between 10 and 35 students', code: quote.code })
  const enrolled = await activeStudentCount(row.id)
  if (body.seats < enrolled) return json(req, 400, { error: 'Fewer seats than students in the class', code: 'below_enrolled', min: enrolled })
  const price = priceIdFor(quote.tier)
  if (!price) return json(req, 503, { error: 'Payments not configured', code: 'not_configured' })

  const customer = await ensureCustomer(sb, deps.stripe, { userId: auth.userId, email: auth.email, schoolName: basics.schoolName })
  if (!customer.ok) return json(req, 502, { error: 'Could not start checkout', code: 'upstream' })
  // Two tabs can't pay for one class twice (review I11): any other open
  // session for this class is expired first; the webhook cancels and
  // refunds a duplicate that still gets through.
  await expireOpenSessions(deps.stripe, customer.id, (md) => md.type === 'class_license' && md.classroom_id === row.id)
  const metadata = { type: 'class_license', owner_user_id: auth.userId, classroom_id: row.id, school_name: basics.schoolName, ...basics.dpa }
  const origin = checkoutBaseUrl(req)
  const back = `${origin}/teacher/class/${row.id}`
  const r = await deps.stripe('checkout/sessions', {
    method: 'POST',
    params: {
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: row.id,
      line_items: [{ price, quantity: body.seats }],
      metadata,
      subscription_data: { metadata },
      success_url: `${back}?billing=success`,
      cancel_url: `${back}?billing=canceled`,
    },
  })
  if (!r.ok || !r.data?.url) return json(req, 502, { error: 'Could not start checkout', code: 'upstream' })
  return json(req, 200, { url: r.data.url })
}

async function buySchool(req, auth, body, basics) {
  const quote = quoteSchool(body.seats)
  if (!quote.ok) return json(req, 400, { error: 'A school plan starts at 150 students', code: quote.code })
  const billing = body.billing === 'invoice' ? 'invoice' : body.billing === 'card' ? 'card' : null
  if (!billing) return json(req, 400, { error: 'Choose card or invoice', code: 'bad_billing' })
  const price = priceIdFor(quote.tier)
  if (!price) return json(req, 503, { error: 'Payments not configured', code: 'not_configured' })

  // One live or unpaid plan per school admin: change its seats instead.
  const live = await sb(`/rest/v1/school_plans?owner_user_id=eq.${encodeURIComponent(auth.userId)}&status=in.(pending_approval,pending_payment,active,grace)&select=id`)
  if (!live.ok) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  if ((await live.json()).length) return json(req, 409, { error: 'You already have a school plan', code: 'plan_exists' })

  if (billing === 'invoice') {
    // Review I6: the owner approves invoice plans before anything is usable.
    const now = new Date().toISOString()
    const ins = await sb('/rest/v1/school_plans', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        owner_user_id: auth.userId, school_name: basics.schoolName, status: 'pending_approval', billing_method: 'invoice',
        seats: body.seats, price_tier: quote.tier, expires_at: now,
        dpa_version: basics.dpa.dpa_version, dpa_accepted_at: basics.dpa.dpa_accepted_at, dpa_accepted_by: auth.userId,
      }),
    })
    if (ins.status === 409) return json(req, 409, { error: 'You already have a school plan', code: 'plan_exists' })
    if (!ins.ok) return json(req, 502, { error: 'Could not send the request', code: 'upstream' })
    const [plan] = await ins.json()
    await sendOwnerAlert({
      subject: 'School plan (invoice) waiting for approval',
      lines: [
        'A verified teacher asked for an invoice-billed school plan.',
        `Plan: ${plan.id}`, `Seats: ${plan.seats}`, `School: ${basics.schoolName}`, `User id: ${auth.userId}`,
        '', 'Approve or decline in the admin page: /admin (School plans waiting).',
      ],
      idempotencyKey: `school-plan-request-${plan.id}`,
    })
    return json(req, 201, { plan: { id: plan.id, status: plan.status, seats: plan.seats, school_name: plan.school_name } })
  }

  const customer = await ensureCustomer(sb, deps.stripe, { userId: auth.userId, email: auth.email, schoolName: basics.schoolName })
  if (!customer.ok) return json(req, 502, { error: 'Could not start checkout', code: 'upstream' })
  await expireOpenSessions(deps.stripe, customer.id, (md) => md.type === 'school_plan')
  const metadata = { type: 'school_plan', owner_user_id: auth.userId, school_name: basics.schoolName, ...basics.dpa }
  const origin = checkoutBaseUrl(req)
  const r = await deps.stripe('checkout/sessions', {
    method: 'POST',
    params: {
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price, quantity: body.seats }],
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/teacher/school?billing=success`,
      cancel_url: `${origin}/teacher/school?billing=canceled`,
    },
  })
  if (!r.ok || !r.data?.url) return json(req, 502, { error: 'Could not start checkout', code: 'upstream' })
  return json(req, 200, { url: r.data.url })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
  try {
    const t = await requireBillingAdmin(req)
    if (!t.ok) return t.response
    if (!checkRateLimit(`school-checkout:${t.auth.userId}`, 20).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    if (!t.auth.email) return json(req, 400, { error: 'Your account needs an email address', code: 'no_email' })
    const body = await req.json().catch(() => ({}))
    const basics = purchaseBasics(body)
    if (!basics.ok) return json(req, 400, { error: basics.code === 'dpa_required' ? 'Confirm the data privacy agreement' : 'Enter the school name', code: basics.code })
    if (body.kind === 'class') return await buyClass(req, t.auth, body, basics)
    if (body.kind === 'school') return await buySchool(req, t.auth, body, basics)
    return json(req, 400, { error: 'Unknown purchase', code: 'bad_request' })
  } catch (e) {
    console.error('[school/checkout] error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
