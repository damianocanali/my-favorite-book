// School plan administration (Stage 4) — the school admin is the verified
// teacher who bought the plan. Web only.
//
// GET                         → { plans: [{ ...plan, used, blocks: [{ classroom_id, class_name, seats, mine }], offers }] }
// GET  ?planId=&invoices=1    → { invoices }
// POST { action: 'assign', planId, classId, seats }   own class: give/resize its block
// POST { action: 'offer', planId, code, seats }       a colleague's class, by class code;
//                                                      nothing moves until they accept
//                                                      (api/school/billing.js offer_accept)
// POST { action: 'cancel_offer', offerId }
// POST { action: 'seats', planId, seats }             ≥150; more now (prorated), fewer at
//                                                      renewal, never below seats given out
// POST { action: 'portal', planId }                   → { url }
//
// Seat blocks are assigned atomically by school_plan_assign (migration 034),
// which locks the plan row so blocks never sum past the plan's seats.
export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, requireVerifiedTeacher, sb, json, isUuid } from '../_school.js'
import { checkoutBaseUrl } from '../_origin.js'
import { stripe as defaultStripe } from '../../lib/school/stripe.js'
import { listInvoices, portalUrl, subscriptionItem, changeQuantity } from '../../lib/school/billingApi.js'
import { planSeatChange } from '../../lib/school/billingState.js'
import { MIN_SCHOOL_SEATS, MAX_SCHOOL_SEATS, MAX_CLASS_SEATS } from '../../lib/school/pricing.js'

export const deps = { stripe: defaultStripe }

const PLAN_COLS = 'id,owner_user_id,school_name,status,billing_method,seats,pending_seats,starts_at,expires_at,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,created_at'
const CODE_RE = /^[A-Z0-9]{4,12}$/

async function ownPlan(userId, planId) {
  if (!isUuid(planId)) return null
  const res = await sb(`/rest/v1/school_plans?id=eq.${planId}&owner_user_id=eq.${encodeURIComponent(userId)}&select=${PLAN_COLS}`)
  if (!res.ok) throw new Error(`plan ${res.status}`)
  return (await res.json())[0] ?? null
}

async function blocksOf(planId) {
  const res = await sb(`/rest/v1/class_licenses?school_plan_id=eq.${planId}&select=classroom_id,seats,owner_user_id,classrooms(name,owner_user_id)`)
  if (!res.ok) throw new Error(`blocks ${res.status}`)
  return res.json()
}

function planView(p, blocks, offers, userId) {
  const { stripe_customer_id: _c, stripe_subscription_id: _s, ...rest } = p
  return {
    ...rest,
    used: blocks.reduce((n, b) => n + (b.seats ?? 0), 0),
    blocks: blocks.map((b) => {
      const cls = Array.isArray(b.classrooms) ? b.classrooms[0] : b.classrooms
      const mine = cls?.owner_user_id === userId
      // A colleague's class name stays theirs: the admin sees seats only.
      return { classroom_id: mine ? b.classroom_id : null, class_name: mine ? cls?.name ?? null : null, seats: b.seats, mine }
    }),
    offers,
  }
}

function rpcError(req, out) {
  const msgs = {
    plan_full: 'Not enough seats left in the school plan',
    below_enrolled: 'Fewer seats than students in the class',
    class_has_license: 'This class already has its own plan',
    plan_not_active: 'The school plan is not active',
    bad_seats: 'Choose between 1 and 35 seats',
  }
  return json(req, 409, { error: msgs[out.error] ?? 'Could not assign seats', code: out.error, ...(out.available != null ? { available: out.available } : {}), ...(out.enrolled != null ? { min: out.enrolled } : {}) })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    if (req.method === 'GET') {
      const t = await requireTeacher(req)
      if (!t.ok) return t.response
      const params = new URL(req.url).searchParams
      if (params.get('invoices') === '1') {
        const plan = await ownPlan(t.auth.userId, params.get('planId'))
        if (!plan) return json(req, 404, { error: 'Plan not found', code: 'plan_not_found' })
        const invoices = plan.stripe_customer_id ? await listInvoices(deps.stripe, plan.stripe_customer_id, plan.stripe_subscription_id) : []
        if (!invoices) return json(req, 502, { error: 'Could not load invoices', code: 'upstream' })
        return json(req, 200, { invoices })
      }
      const res = await sb(`/rest/v1/school_plans?owner_user_id=eq.${encodeURIComponent(t.auth.userId)}&select=${PLAN_COLS}&order=created_at.desc`)
      if (!res.ok) return json(req, 502, { error: 'Could not load the plan', code: 'upstream' })
      const plans = []
      for (const p of await res.json()) {
        const offersRes = await sb(`/rest/v1/school_seat_offers?plan_id=eq.${p.id}&status=eq.pending&select=id,seats,created_at`)
        const offers = offersRes.ok ? await offersRes.json() : []
        plans.push(planView(p, await blocksOf(p.id), offers, t.auth.userId))
      }
      return json(req, 200, { plans })
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const t = await requireVerifiedTeacher(req)
    if (!t.ok) return t.response
    if (!checkRateLimit(`school-plan:${t.auth.userId}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = await req.json().catch(() => ({}))
    const userId = t.auth.userId

    if (body.action === 'cancel_offer') {
      if (!isUuid(body.offerId)) return json(req, 400, { error: 'Invalid offer', code: 'bad_request' })
      const r = await sb(`/rest/v1/school_seat_offers?id=eq.${body.offerId}&status=eq.pending&select=id,school_plans(owner_user_id)`)
      if (!r.ok) throw new Error(`offer ${r.status}`)
      const [offer] = await r.json()
      const owner = (Array.isArray(offer?.school_plans) ? offer.school_plans[0] : offer?.school_plans)?.owner_user_id
      if (!offer || owner !== userId) return json(req, 404, { error: 'Offer not found', code: 'offer_not_found' })
      await sb(`/rest/v1/school_seat_offers?id=eq.${offer.id}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled', decided_by: userId, decided_at: new Date().toISOString() }) })
      return json(req, 200, { ok: true })
    }

    const plan = await ownPlan(userId, body.planId)
    if (!plan) return json(req, 404, { error: 'Plan not found', code: 'plan_not_found' })

    if (body.action === 'assign') {
      if (!isUuid(body.classId)) return json(req, 400, { error: 'Invalid class id', code: 'bad_request' })
      const own = await sb(`/rest/v1/classrooms?id=eq.${body.classId}&owner_user_id=eq.${encodeURIComponent(userId)}&archived_at=is.null&select=id`)
      if (!own.ok) throw new Error(`class ${own.status}`)
      if (!(await own.json()).length) return json(req, 404, { error: 'Class not found', code: 'class_not_found' })
      if (!Number.isInteger(body.seats) || body.seats < 1 || body.seats > MAX_CLASS_SEATS) return json(req, 400, { error: 'Choose between 1 and 35 seats', code: 'bad_seats' })
      const rpc = await sb('/rest/v1/rpc/school_plan_assign', {
        method: 'POST',
        body: JSON.stringify({ p_plan_id: plan.id, p_classroom_id: body.classId, p_seats: body.seats, p_owner: userId }),
      })
      if (!rpc.ok) return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
      const out = await rpc.json()
      if (out?.error) return rpcError(req, out)
      return json(req, 200, { ok: true })
    }

    if (body.action === 'offer') {
      const code = String(body.code ?? '').trim().toUpperCase()
      if (!CODE_RE.test(code)) return json(req, 400, { error: 'Enter the class code', code: 'bad_code' })
      if (!Number.isInteger(body.seats) || body.seats < 1 || body.seats > MAX_CLASS_SEATS) return json(req, 400, { error: 'Choose between 1 and 35 seats', code: 'bad_seats' })
      const c = await sb(`/rest/v1/classrooms?code=eq.${encodeURIComponent(code)}&archived_at=is.null&select=id,owner_user_id`)
      if (!c.ok) throw new Error(`class ${c.status}`)
      const [cls] = await c.json()
      if (!cls) return json(req, 404, { error: 'No class with that code', code: 'class_not_found' })
      if (cls.owner_user_id === userId) return json(req, 400, { error: 'This is your class: give it seats directly', code: 'own_class' })
      const ins = await sb('/rest/v1/school_seat_offers', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ plan_id: plan.id, classroom_id: cls.id, seats: body.seats, created_by: userId }),
      })
      if (ins.status === 409) return json(req, 409, { error: 'That class already has an offer waiting', code: 'offer_pending' })
      if (!ins.ok) return json(req, 502, { error: 'Could not send the offer', code: 'upstream' })
      const [offer] = await ins.json()
      return json(req, 201, { offer: { id: offer.id, seats: offer.seats } })
    }

    if (body.action === 'portal') {
      if (!plan.stripe_customer_id) return json(req, 409, { error: 'No billing account yet', code: 'no_customer' })
      const url = await portalUrl(deps.stripe, plan.stripe_customer_id, `${checkoutBaseUrl(req)}/teacher/school`)
      if (!url) return json(req, 502, { error: 'Could not open billing', code: 'upstream' })
      return json(req, 200, { url })
    }

    if (body.action === 'seats') {
      if (!plan.stripe_subscription_id || !['active', 'grace', 'pending_payment'].includes(plan.status)) {
        return json(req, 409, { error: 'This plan is not active', code: 'plan_not_active' })
      }
      const used = (await blocksOf(plan.id)).reduce((n, b) => n + (b.seats ?? 0), 0)
      const change = planSeatChange({ current: plan.seats, pending: plan.pending_seats, requested: body.seats, inUse: used, min: MIN_SCHOOL_SEATS, max: MAX_SCHOOL_SEATS })
      if (!change.ok) return json(req, 400, { error: 'That seat count is not possible', code: change.code, ...(change.min != null ? { min: change.min } : {}) })
      if (change.mode === 'none') return json(req, 200, { ok: true, mode: 'none' })
      const item = await subscriptionItem(deps.stripe, plan.stripe_subscription_id)
      if (!item) return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      const target = change.mode === 'cancel_decrease' ? plan.seats : body.seats
      const r = await changeQuantity(deps.stripe, plan.stripe_subscription_id, item, target, change.mode === 'increase' ? 'increase' : 'decrease')
      if (!r.ok) return json(req, 502, { error: 'Could not change seats', code: 'upstream' })
      let patch
      if (change.mode === 'increase') {
        if (r.pending || r.quantity !== target) return json(req, 402, { error: 'The card was declined; seats are unchanged', code: 'payment_failed' })
        patch = { seats: target, pending_seats: null }
      } else patch = { pending_seats: change.mode === 'decrease' ? target : null }
      const upd = await sb(`/rest/v1/school_plans?id=eq.${plan.id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) })
      if (!upd.ok) return json(req, 502, { error: 'Seats changed; refresh in a minute', code: 'upstream' })
      return json(req, 200, { ok: true, mode: change.mode })
    }

    return json(req, 400, { error: 'Unknown action', code: 'bad_request' })
  } catch (e) {
    console.error('[school/plan] error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
