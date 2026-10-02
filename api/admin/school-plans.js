// Owner-only: invoice-billed school plans waiting for approval (Stage 4
// review I6). Nothing about an invoice plan is usable, and nothing is sent
// to Stripe, until the owner approves it here.
//
//   GET  → { rows: [{ id, owner_user_id, school_name, seats, price_tier, created_at }] }
//   POST { id, decision: 'approve'|'decline', reason }
//        approve → Stripe Customer (the teacher's email + school name) and a
//                  send_invoice subscription (net 30), plan → pending_payment
//                  (usable with 50 pictures per seat, never printable, no
//                  seat increases) until the invoice is paid.
//        decline → plan → declined with the reason (required).
//
// Every call is written to admin_access_log (migration 032). A decision's
// row is written BEFORE anything changes and is REQUIRED: no log, no change.
export const config = { runtime: 'edge' }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, isUuid } from '../_school.js'
import { ownerAuth, logAdminAccess, reasonFrom } from '../_adminLog.js'
import { stripe as defaultStripe, readSubscription } from '../../lib/school/stripe.js'
import { ensureCustomer } from '../../lib/school/billingApi.js'
import { priceIdFor } from '../../lib/school/pricing.js'

export const deps = { stripe: defaultStripe }

const INVOICE_DAYS = 30
const DAY = 86400000
const SELECT = 'id,owner_user_id,school_name,seats,price_tier,status,created_at,dpa_version,dpa_accepted_at'

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const owner = await ownerAuth(req)
  if (!owner.ok) return owner.response

  try {
    if (req.method === 'GET') {
      const res = await sb(`/rest/v1/school_plans?status=eq.pending_approval&select=${SELECT}&order=created_at.asc&limit=200`)
      if (!res.ok) throw new Error(`plans read ${res.status}`)
      const rows = (await res.json()).map(({ dpa_version: _v, dpa_accepted_at: _a, ...r }) => r)
      await logAdminAccess({ actor: owner.ownerId, action: 'school_plan.list_pending', targetTable: 'school_plans', detail: { count: rows.length } })
      return reply(req, 200, { rows })
    }
    if (req.method !== 'POST') return reply(req, 405, { error: 'Method not allowed' })

    const body = await req.json().catch(() => ({}))
    if (!isUuid(body.id)) return reply(req, 400, { error: 'Invalid plan id', code: 'bad_request' })
    if (body.decision !== 'approve' && body.decision !== 'decline') return reply(req, 400, { error: 'decision must be approve or decline', code: 'bad_request' })
    const reason = reasonFrom(req, body)
    if (body.decision === 'decline' && !reason) return reply(req, 400, { error: 'A reason is required to decline', code: 'reason_required' })

    const r = await sb(`/rest/v1/school_plans?id=eq.${body.id}&select=${SELECT}`)
    if (!r.ok) throw new Error(`plan read ${r.status}`)
    const [plan] = await r.json()
    if (!plan) return reply(req, 404, { error: 'Not found', code: 'not_found' })
    if (plan.status !== 'pending_approval') return reply(req, 409, { error: 'Already decided', code: 'already_decided', status: plan.status })

    const logged = await logAdminAccess({
      actor: owner.ownerId, action: `school_plan.${body.decision}`, targetTable: 'school_plans', targetId: plan.id, reason,
      detail: { owner_user_id: plan.owner_user_id, seats: plan.seats },
    }, { required: true })
    if (!logged) return reply(req, 503, { error: 'Could not write the access log; nothing changed', code: 'log_failed' })

    const nowIso = new Date().toISOString()
    if (body.decision === 'decline') {
      const p = await sb(`/rest/v1/school_plans?id=eq.${plan.id}&status=eq.pending_approval`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'declined', decline_reason: reason, approved_by: owner.ownerId, approved_at: nowIso, updated_at: nowIso }),
      })
      if (!p.ok) return reply(req, 502, { error: 'Could not update the plan', code: 'upstream' })
      return reply(req, 200, { ok: true, id: plan.id, status: 'declined' })
    }

    const price = priceIdFor(plan.price_tier ?? 'school')
    if (!price) return reply(req, 503, { error: 'Payments not configured', code: 'not_configured' })
    const u = await sb(`/auth/v1/admin/users/${encodeURIComponent(plan.owner_user_id)}`)
    const teacher = u.ok ? await u.json().catch(() => null) : null
    if (!teacher?.email) return reply(req, 409, { error: 'The teacher has no email address', code: 'no_email' })
    const customer = await ensureCustomer(sb, deps.stripe, { userId: plan.owner_user_id, email: teacher.email, schoolName: plan.school_name })
    if (!customer.ok) return reply(req, 502, { error: 'Could not create the Stripe customer', code: 'upstream' })
    const metadata = {
      type: 'school_plan', plan_id: plan.id, owner_user_id: plan.owner_user_id, school_name: plan.school_name,
      dpa_version: plan.dpa_version, dpa_accepted_at: plan.dpa_accepted_at,
    }
    // Review N7: a retry (even after the 24 h idempotency window) reuses a
    // subscription an earlier attempt already created for this plan.
    const existing = await deps.stripe('subscriptions', { params: { customer: customer.id, status: 'all', limit: 100 } })
    const prior = existing.ok
      ? (existing.data?.data ?? []).find((x) => x?.metadata?.plan_id === plan.id && !['canceled', 'incomplete_expired'].includes(x.status))
      : null
    const sub = prior ? { ok: true, data: prior } : await deps.stripe('subscriptions', {
      method: 'POST',
      idempotencyKey: `school-plan-approve-${plan.id}`,
      params: {
        customer: customer.id,
        items: [{ price, quantity: plan.seats }],
        collection_method: 'send_invoice',
        days_until_due: INVOICE_DAYS,
        metadata,
      },
    })
    if (!sub.ok || !sub.data?.id) return reply(req, 502, { error: 'Could not create the invoice', code: 'upstream' })
    const s = readSubscription(sub.data)
    const p = await sb(`/rest/v1/school_plans?id=eq.${plan.id}&status=eq.pending_approval`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'pending_payment', approved_by: owner.ownerId, approved_at: nowIso,
        // Usable while the invoice is open (net 30); the paid invoice sets
        // the real term from Stripe's period.
        starts_at: nowIso, expires_at: new Date(Date.now() + INVOICE_DAYS * DAY).toISOString(),
        stripe_customer_id: customer.id, stripe_subscription_id: s.id, stripe_price_id: price, updated_at: nowIso,
      }),
    })
    if (!p.ok) return reply(req, 502, { error: 'Invoice created but the plan was not updated — retry approve (it is idempotent)', code: 'upstream' })
    return reply(req, 200, { ok: true, id: plan.id, status: 'pending_payment' })
  } catch (e) {
    console.error('[admin/school-plans] error', e?.message)
    return reply(req, 503, { error: 'Service unavailable, try again' })
  }
}
