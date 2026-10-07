// Webhook adapters: turn Stripe / RevenueCat events into "first paid
// payment" and "refund" for lib/atlas/report.js. Called AFTER the webhook
// has done its own work. Never throws, never changes the webhook's
// response; the Atlas call itself runs after the response (ctx.waitUntil)
// when the runtime offers it, and is awaited otherwise (tests, Node).
//
// What counts as the FIRST paid payment (cancellations never count):
//   Stripe  checkout.session.completed, mode subscription, payment_status
//           'paid', family plan (no-trial family checkout pays here), or
//           invoice.paid, amount_paid > 0, family plan, billing_reason
//           subscription_create — or subscription_cycle when it is the
//           first period after a trial (a trial that converts) on a
//           subscription created after the referral token was issued.
//           Whichever arrives first; the claim makes it once.
//   RC      INITIAL_PURCHASE with period_type NORMAL (or a paid INTRO), or
//           RENEWAL with is_trial_conversion = true.
// Test-mode Stripe events (livemode false) and RevenueCat SANDBOX events
// are ignored unless ATLAS_REPORT_TEST_PAYMENTS = "true", so App Review and
// preview purchases never bill Atlas.
import { atlasConfig } from './referral.js'
import { recordFirstPayment, recordRefund } from './report.js'
import { readInvoice, readSubscription } from '../school/stripe.js'

const isFamilyPlan = (plan) => typeof plan === 'string' && plan.startsWith('family')
const idOf = (x) => (typeof x === 'string' ? x : x?.id ?? null)
const testAllowed = () => process.env.ATLAS_REPORT_TEST_PAYMENTS === 'true'

async function defer(ctx, out) {
  if (!out?.deferred) return
  const p = out.deferred.catch(() => {})
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(p)
  else await p
}

/**
 * @param {object} event  verified Stripe event
 * @param {{ sb, stripe, ctx?, cfg?, fetchImpl? }} deps  stripe: lib/school/stripe.js's stripe()
 */
export async function atlasOnStripeEvent(event, deps) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.capture || !event?.type) return
  if (event.livemode === false && !testAllowed()) return
  const d = { ...deps, cfg }
  try {
    const obj = event.data?.object ?? {}
    if (event.type === 'checkout.session.completed') {
      const md = obj.metadata ?? {}
      if (obj.mode !== 'subscription' || obj.payment_status !== 'paid' || md.type === 'coin_pack') return
      if (!md.user_id || !isFamilyPlan(md.plan || 'family') || !obj.subscription) return
      await defer(deps.ctx, await recordFirstPayment({ userId: md.user_id, externalRef: idOf(obj.subscription), paymentRef: idOf(obj.invoice) }, d))
      return
    }
    if (event.type === 'invoice.paid') {
      const inv = readInvoice(obj)
      if (!inv?.subscriptionId || !(obj.amount_paid > 0)) return
      if (!['subscription_create', 'subscription_cycle'].includes(inv.billingReason)) return
      let md = inv.metadata ?? {}
      let sub = null
      const loadSub = async () => {
        if (sub) return sub
        const r = await deps.stripe(`subscriptions/${inv.subscriptionId}`)
        if (!r.ok) throw new Error(`subscription read ${r.status}`)
        sub = { ...readSubscription(r.data), trialEnd: r.data.trial_end ?? null, created: r.data.created ?? null }
        return sub
      }
      if (!md.user_id) md = (await loadSub()).metadata ?? {}
      if (!md.user_id || !isFamilyPlan(md.plan || 'family')) return
      const precheck = inv.billingReason === 'subscription_create' ? undefined : async (row) => {
        const s = await loadSub()
        if (!s.trialEnd || inv.periodStart == null) return false
        const firstAfterTrial = inv.periodStart <= (s.trialEnd + 3600) * 1000
        const afterReferral = !row.token_iat || (s.created ?? 0) * 1000 >= Date.parse(row.token_iat) - 300000
        return firstAfterTrial && afterReferral
      }
      await defer(deps.ctx, await recordFirstPayment({ userId: md.user_id, externalRef: inv.subscriptionId, paymentRef: inv.id, precheck }, d))
      return
    }
    if (event.type === 'charge.refunded') {
      // Full or partial: both are reported (see recordRefund).
      let invoiceId = idOf(obj.invoice)
      if (!invoiceId && obj.payment_intent) {
        // 2025 "basil" API: charges no longer carry the invoice.
        const r = await deps.stripe('invoice_payments', { params: { payment: { type: 'payment_intent', payment_intent: idOf(obj.payment_intent) }, limit: 1 } })
        invoiceId = r.ok ? idOf(r.data?.data?.[0]?.invoice) : null
      }
      if (!invoiceId) return // not a subscription payment (coins, print)
      const r = await deps.stripe(`invoices/${invoiceId}`)
      if (!r.ok) throw new Error(`invoice read ${r.status}`)
      const inv = readInvoice(r.data)
      if (!inv?.subscriptionId) return
      await defer(deps.ctx, await recordRefund({ externalRef: inv.subscriptionId, paymentRef: invoiceId }, d))
    }
  } catch (e) {
    console.error('[atlas] stripe hook failed', event.type, e?.message)
  }
}

/**
 * @param {object} ev  RevenueCat's event.event
 * @param {{ sb, ctx?, cfg?, fetchImpl? }} deps
 */
export async function atlasOnRevenueCatEvent(ev, deps) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.capture || !ev?.type) return
  if (ev.environment === 'SANDBOX' && !testAllowed()) return
  const d = { ...deps, cfg }
  const externalRef = ev.original_transaction_id || ev.transaction_id
  if (!externalRef) return
  const family = !String(ev.product_id ?? '').includes('teacher')
  try {
    const paid =
      (ev.type === 'INITIAL_PURCHASE' && (ev.period_type === 'NORMAL' || (ev.period_type === 'INTRO' && Number(ev.price) > 0))) ||
      (ev.type === 'RENEWAL' && ev.is_trial_conversion === true)
    if (paid && family && ev.app_user_id) {
      await defer(deps.ctx, await recordFirstPayment({ userId: ev.app_user_id, externalRef, paymentRef: ev.transaction_id ?? null }, d))
      return
    }
    // RevenueCat reports an App Store refund as a CANCELLATION whose
    // cancel_reason is CUSTOMER_SUPPORT. Their webhook docs ("Event Types and
    // Fields", cancel_reason): "CUSTOMER_SUPPORT: Customer received a refund
    // from Apple support, a Google Play subscription was refunded through
    // RevenueCat, an Amazon subscription was refunded through Amazon
    // support, or a web subscription was refunded". Every other
    // cancel_reason (UNSUBSCRIBE, BILLING_ERROR, …) is a cancellation: nothing.
    if (ev.type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT') {
      await defer(deps.ctx, await recordRefund({ externalRef, paymentRef: ev.transaction_id ?? null }, d))
    }
  } catch (e) {
    console.error('[atlas] revenuecat hook failed', ev.type, e?.message)
  }
}
