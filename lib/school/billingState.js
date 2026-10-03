// School billing state machine (Stage 4). PURE: (current record, Stripe
// facts) → a patch, or null for "nothing to change". No I/O, no clock reads
// except where `now` is passed in, so every rule here is unit-tested.
//
// A "record" is a class license (class_licenses) or a school plan
// (school_plans); both carry status, starts_at, expires_at, seats,
// pending_seats, stripe_period_start, stripe_event_at, cancel_at_period_end.
//
// THE TERM RULE (docs/superpowers/notes/stage4-license-terms.md):
// `starts_at` identifies the license term, and each term prints the class
// books once. So `starts_at` moves ONLY when Stripe's current_period_start of
// a newly PAID period is later than the last paid one (stripe_period_start).
// It never moves on grace, a late payment for the same period, a replayed
// or out-of-order event, an admin edit, a seat change, a retry, or a
// cancellation, and it is never set from the clock at webhook time.
// Ordering is by Stripe's period (invoices) or event `created` time
// (subscription updates), never by arrival.

import { imageAllowanceFor, quantityProblem, MAX_CLASS_SEATS, MAX_SCHOOL_SEATS } from './pricing.js'

export const GRACE_DAYS = 14
const DAY = 86400000

/// Invoices that pay for a TERM. Proration invoices (seat increases,
/// 'subscription_update') and anything else never start a term.
export const TERM_REASONS = ['subscription_create', 'subscription_cycle']

const ms = (v) => (v == null ? null : typeof v === 'number' ? v : Date.parse(v))
const iso = (t) => new Date(t).toISOString()

/// For a class license, seats also set the picture allowance (300 × seats).
function seatFields(kind, seats) {
  return kind === 'license' ? { seats, image_allowance: imageAllowanceFor(seats) } : { seats }
}

/// Seats from a PAID quantity, never more than was paid and within the
/// table limits; an out-of-range quantity (set outside the app, e.g. the
/// Customer Portal) is also flagged for the owner (review I12).
function paidSeats(kind, q) {
  if (!Number.isInteger(q) || q < 1) return { seats: null, review: q == null ? null : `invalid quantity ${q}` }
  const problem = quantityProblem(kind, q)
  const seats = Math.min(q, kind === 'license' ? MAX_CLASS_SEATS : MAX_SCHOOL_SEATS)
  return { seats, review: problem ? `quantity ${q} (${problem})` : null }
}

const review = (reason) => ({ needs_review: true, review_reason: String(reason).slice(0, 500) })

/**
 * A term invoice was PAID.
 * @param rec  current record (null = none yet: the caller inserts)
 * @param inv  { periodStart, periodEnd, quantity, billingReason } (ms or ISO)
 * @param kind 'license' | 'plan'
 */
export function onInvoicePaid(rec, inv, kind = 'license') {
  if (!TERM_REASONS.includes(inv.billingReason)) return null
  const ps = ms(inv.periodStart)
  const pe = ms(inv.periodEnd)
  if (!Number.isFinite(ps) || !Number.isFinite(pe) || pe <= ps) return null
  if (rec?.status === 'canceled') return null // never resurrect a canceled license
  const cur = ms(rec?.stripe_period_start)

  if (cur == null || ps > cur) {
    // A genuinely new paid term: the next free print opens.
    const paid = paidSeats(kind, inv.quantity)
    const seats = paid.seats ?? rec?.seats ?? null
    return {
      status: 'active',
      starts_at: iso(ps),
      stripe_period_start: iso(ps),
      expires_at: iso(pe),
      pending_seats: null,
      ...(seats ? seatFields(kind, seats) : {}),
      ...(kind === 'license' ? { images_used: 0 } : {}),
      ...(paid.review ? review(paid.review) : {}),
    }
  }
  if (ps === cur) {
    // Late payment / retry / replay for the SAME term: status and expiry
    // only. starts_at stays, so no second print.
    const patch = {}
    if (['grace', 'pending_payment', 'lapsed'].includes(rec.status)) patch.status = 'active'
    if (!(ms(rec.expires_at) >= pe)) patch.expires_at = iso(pe)
    return Object.keys(patch).length ? patch : null
  }
  return null // an older period arriving late: ignore
}

/**
 * A term invoice FAILED. A renewal that can't be collected puts an active
 * record into grace for GRACE_DAYS from the end of the paid term. The
 * nightly job (lib/school/lifecycle.js endExpiredGrace) lapses it after.
 */
export function onInvoiceFailed(rec, inv) {
  if (!rec || !TERM_REASONS.includes(inv.billingReason)) return null
  const ps = ms(inv.periodStart)
  const cur = ms(rec.stripe_period_start)
  if (!Number.isFinite(ps)) return null
  // Only a NEW period's invoice can fail into grace; the paid term's own
  // (or an older) invoice failing again is a replay.
  if (cur != null && ps <= cur) return null
  if (rec.status !== 'active') return null // trial, pending_payment, grace already, lapsed…
  const graceFrom = Math.max(ms(rec.expires_at) ?? ps, ps)
  return { status: 'grace', expires_at: iso(graceFrom + GRACE_DAYS * DAY) }
}

/**
 * An invoice-billed (send_invoice) term invoice was FINALIZED (sent, due
 * in 30 days). The class keeps working until the due date: expires_at is
 * extended (never shortened) to it. Status and starts_at are untouched:
 * the new term starts only when this invoice is PAID (onInvoicePaid).
 */
export function onInvoiceOpened(rec, inv) {
  if (!rec || !TERM_REASONS.includes(inv.billingReason)) return null
  const ps = ms(inv.periodStart)
  const due = ms(inv.dueDate)
  const cur = ms(rec.stripe_period_start)
  if (!Number.isFinite(ps) || !Number.isFinite(due)) return null
  if (cur != null && ps <= cur) return null // already paid (or older)
  if (!['active', 'pending_payment'].includes(rec.status)) return null
  if (ms(rec.expires_at) >= due) return null
  return { expires_at: iso(due) }
}

/**
 * customer.subscription.updated. Never the term, and never MORE seats:
 * seats are added only through the app, paid in full first (review I5),
 * which updates our row before Stripe's quantity — so an update that
 * raises the quantity above our seats came from outside the app and is
 * flagged, not mirrored (review I12).
 *   * quantity down → pending_seats (applied by the next term invoice),
 *                     unless out of range or below `floor` (students
 *                     enrolled / seats given out): flagged instead
 *   * quantity back to seats → the pending reduction is dropped
 *   * status 'canceled' → canceled; 'unpaid' (dunning gave up) → lapsed
 * `eventCreated` (seconds or ms) orders these events.
 */
export function onSubscriptionUpdated(rec, sub, eventCreated, kind = 'license', { floor = null } = {}) {
  if (!rec) return null
  const at = normaliseCreated(eventCreated)
  if (rec.stripe_event_at && at != null && at < ms(rec.stripe_event_at)) return null // older than what we applied
  const patch = {}
  if (at != null) patch.stripe_event_at = iso(at)

  const q = sub.quantity
  if (Number.isInteger(q)) {
    if (q > rec.seats) {
      Object.assign(patch, review(`quantity raised to ${q} outside the app (seats ${rec.seats})`))
    } else if (q < rec.seats) {
      const problem = quantityProblem(kind, q) ?? (floor != null && q < floor ? `below ${floor} in use` : null)
      if (problem) Object.assign(patch, review(`quantity lowered to ${q} (${problem})`))
      else if (rec.pending_seats !== q) patch.pending_seats = q
    } else if (rec.pending_seats != null) patch.pending_seats = null
  }
  const cape = !!sub.cancelAtPeriodEnd
  if (cape !== !!rec.cancel_at_period_end) patch.cancel_at_period_end = cape

  if (sub.status === 'canceled' && rec.status !== 'canceled') patch.status = 'canceled'
  else if (sub.status === 'unpaid' && ['active', 'grace', 'pending_payment'].includes(rec.status)) patch.status = 'lapsed'

  if (patch.needs_review && rec.needs_review && rec.review_reason === patch.review_reason) {
    delete patch.needs_review
    delete patch.review_reason
  }
  const meaningful = Object.keys(patch).some((k) => k !== 'stripe_event_at')
  return meaningful ? patch : null
}

export function onSubscriptionDeleted(rec, eventCreated) {
  if (!rec) return null
  const at = normaliseCreated(eventCreated)
  const patch = { cancel_at_period_end: false }
  if (at != null) patch.stripe_event_at = iso(Math.max(at, ms(rec.stripe_event_at) ?? 0))
  if (rec.status !== 'canceled' && rec.status !== 'lapsed') patch.status = 'canceled'
  if (!patch.status && !rec.cancel_at_period_end) return null
  return patch
}

/// Stripe `created` is in seconds; tests may pass ms or ISO.
function normaliseCreated(v) {
  if (v == null) return null
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/// Fields a school plan's class licenses mirror from the plan (seat blocks
/// keep their own seats). starts_at included: a block's term IS the plan's
/// term, so a plan renewal opens the next print for every class on it.
export function mirrorFromPlan(plan) {
  return {
    status: plan.status,
    starts_at: plan.starts_at,
    expires_at: plan.expires_at,
    stripe_period_start: plan.stripe_period_start ?? null,
    cancel_at_period_end: !!plan.cancel_at_period_end,
  }
}

// ── Seat changes requested by the teacher / school admin ───────────────

/**
 * What a seat change does. Increases are immediate (Stripe prorates);
 * decreases wait for the renewal and may never go below what is in use.
 * → { ok:true, mode:'increase'|'decrease'|'cancel_decrease'|'none' } | { ok:false, code, min? }
 */
export function planSeatChange({ current, pending, requested, inUse, min, max }) {
  if (!Number.isInteger(requested)) return { ok: false, code: 'bad_seats' }
  if (requested < min) return { ok: false, code: 'below_minimum', min }
  if (requested > max) return { ok: false, code: 'above_maximum', max }
  if (requested < inUse) return { ok: false, code: 'below_enrolled', min: inUse }
  if (requested > current) return { ok: true, mode: 'increase' }
  if (requested < current) return { ok: true, mode: 'decrease' }
  return { ok: true, mode: pending != null ? 'cancel_decrease' : 'none' }
}
