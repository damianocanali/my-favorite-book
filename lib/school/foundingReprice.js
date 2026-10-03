// Founding price after the founding window — ONLY when the owner sets
// FOUNDING_LOCKED_FOR_LIFE = false (lib/school/pricing.js). With the default
// (true) this does nothing: founding purchases renew at the founding price.
//
// When enabled, after FOUNDING_ENDS_AT each live founding subscription is
// moved to the regular Price (class → standard, school plan → school) with
// proration_behavior=none, so the change takes effect at its NEXT renewal
// and nothing already paid is touched. Run nightly by api/cron/retention.js
// (respects the retention dry run). Seat blocks have no subscription.
import { FOUNDING_LOCKED_FOR_LIFE, isFoundingEligible, priceIdFor } from './pricing.js'
import { subscriptionItem } from './billingApi.js'

const BATCH = 50

export async function repriceFounding(sb, stripe, { now = new Date(), dryRun = true, locked = FOUNDING_LOCKED_FOR_LIFE } = {}) {
  if (locked || isFoundingEligible(now)) return { skipped: true, moved: 0, failed: 0 }
  const out = { skipped: false, moved: 0, would_move: 0, failed: 0 }
  const jobs = [
    { table: 'class_licenses', filter: 'price_tier=eq.founding&school_plan_id=is.null', target: 'standard' },
    { table: 'school_plans', filter: 'price_tier=eq.school_founding', target: 'school' },
  ]
  for (const j of jobs) {
    const price = priceIdFor(j.target)
    const res = await sb(`/rest/v1/${j.table}?${j.filter}&status=in.(active,grace,pending_payment)&stripe_subscription_id=not.is.null&select=id,stripe_subscription_id&limit=${BATCH}`)
    if (!res.ok) { if (res.status !== 404) out.failed++; continue }
    const list = await res.json()
    if (dryRun) { out.would_move += list.length; continue }
    if (!price) { out.failed += list.length; continue }
    for (const row of list) {
      const item = await subscriptionItem(stripe, row.stripe_subscription_id)
      const r = item && await stripe(`subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`, {
        method: 'POST',
        params: { items: [{ id: item.itemId, price }], proration_behavior: 'none' },
        idempotencyKey: `founding-reprice-${row.stripe_subscription_id}`,
      })
      if (!r?.ok) { out.failed++; continue }
      const upd = await sb(`/rest/v1/${j.table}?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ price_tier: j.target, stripe_price_id: price, updated_at: new Date().toISOString() }) })
      if (upd.ok) out.moved++
      else out.failed++
    }
  }
  return out
}
