// Stage 4: the pure billing state machine (lib/school/billingState.js) and
// the price math (lib/school/pricing.js).
import { describe, it, expect } from 'vitest'
import {
  onInvoicePaid, onInvoiceFailed, onInvoiceOpened, onSubscriptionUpdated, onSubscriptionDeleted,
  planSeatChange, mirrorFromPlan, GRACE_DAYS,
} from '../lib/school/billingState.js'
import {
  quoteClass, quoteSchool, isFoundingEligible, classTier, priceIdFor, tierForPriceId, seatAddQuote,
  FOUNDING_LOCKED_FOR_LIFE, SCHOOL_PLAN_FOUNDING_PRICE_CENTS,
  imageAllowanceFor, SEAT_PRICE_CENTS, MIN_CLASS_SEATS, MAX_CLASS_SEATS, MIN_SCHOOL_SEATS, FOUNDING_ENDS_AT,
} from '../lib/school/pricing.js'

const D = (s) => Date.parse(s)
const Y1 = D('2026-09-01T00:00:00Z')
const Y2 = D('2027-09-01T00:00:00Z')
const Y3 = D('2028-09-01T00:00:00Z')
const iso = (t) => new Date(t).toISOString()

const paidLicense = {
  status: 'active', seats: 25, pending_seats: null, starts_at: iso(Y1), stripe_period_start: iso(Y1),
  expires_at: iso(Y2), image_allowance: 7500, images_used: 4000, cancel_at_period_end: false, stripe_event_at: null,
}

describe('pricing', () => {
  it('has the owner-approved prices', () => {
    expect(SEAT_PRICE_CENTS).toEqual({ standard: 1900, founding: 1500, school: 1700 })
    expect([MIN_CLASS_SEATS, MAX_CLASS_SEATS, MIN_SCHOOL_SEATS]).toEqual([10, 35, 150])
  })
  it('class seats: at least 10, at most 35, whole numbers', () => {
    expect(quoteClass(9, new Date('2028-01-01')).code).toBe('below_minimum')
    expect(quoteClass(36, new Date('2028-01-01')).code).toBe('above_maximum')
    expect(quoteClass(12.5).code).toBe('bad_seats')
    expect(quoteClass('20').code).toBe('bad_seats')
    expect(quoteClass(10, new Date('2028-01-01'))).toMatchObject({ ok: true, tier: 'standard', unit_cents: 1900, total_cents: 19000 })
    expect(quoteClass(35, new Date('2028-01-01')).total_cents).toBe(66500)
  })
  it('founding $15 for purchases through 31 July 2027 (US Pacific), applied automatically', () => {
    expect(isFoundingEligible(new Date('2026-10-02T12:00:00Z'))).toBe(true)
    expect(isFoundingEligible(new Date('2027-08-01T06:59:59Z'))).toBe(true) // 23:59 PDT on the 31st
    expect(isFoundingEligible(new Date(FOUNDING_ENDS_AT))).toBe(false)
    expect(isFoundingEligible(new Date('2027-09-01T00:00:00Z'))).toBe(false)
    expect(classTier(new Date('2027-07-31T20:00:00Z'))).toBe('founding')
    expect(quoteClass(25, new Date('2026-10-02'))).toMatchObject({ tier: 'founding', unit_cents: 1500, total_cents: 37500 })
  })
  it('school plan: $17, at least 150 seats; $15 in the founding window (SCHOOL_PLAN_FOUNDING_PRICE_CENTS)', () => {
    expect(quoteSchool(149).code).toBe('below_minimum')
    expect(quoteSchool(150, new Date('2027-09-01'))).toMatchObject({ ok: true, tier: 'school', unit_cents: 1700, total_cents: 255000 })
    expect(quoteSchool(150, new Date('2026-10-02'))).toMatchObject({ ok: true, tier: 'school_founding', unit_cents: 1500, total_cents: 225000 })
  })
  it('owner decisions are one-line constants with the agreed defaults', () => {
    expect(FOUNDING_LOCKED_FOR_LIFE).toBe(true)
    expect(SCHOOL_PLAN_FOUNDING_PRICE_CENTS).toBe(1500)
    // The school founding tier reuses the founding Price when the amounts match.
    expect(priceIdFor('school_founding', { STRIPE_PRICE_SEAT_FOUNDING: 'price_f' })).toBe('price_f')
    expect(tierForPriceId('price_f', { STRIPE_PRICE_SEAT_FOUNDING: 'price_f' }, 'plan')).toBe('school_founding')
    expect(tierForPriceId('price_f', { STRIPE_PRICE_SEAT_FOUNDING: 'price_f' }, 'license')).toBe('founding')
  })
  it('seats added mid-term cost the FULL yearly price at the record\'s tier (review I5)', () => {
    expect(seatAddQuote('founding', 2)).toEqual({ unit_cents: 1500, added: 2, total_cents: 3000, currency: 'usd' })
    expect(seatAddQuote('standard', 5).total_cents).toBe(9500)
    expect(seatAddQuote('school', 10).total_cents).toBe(17000)
    expect(seatAddQuote('school_founding', 10).total_cents).toBe(15000)
    expect(seatAddQuote('standard', 0)).toBe(null)
    expect(seatAddQuote('nope', 3)).toBe(null)
  })
  it('Stripe Price ids come from env, both ways; an unknown price is never guessed', () => {
    const env = { STRIPE_PRICE_SEAT: 'price_s', STRIPE_PRICE_SEAT_FOUNDING: 'price_f', STRIPE_PRICE_SCHOOL_SEAT: 'price_p' }
    expect(priceIdFor('founding', env)).toBe('price_f')
    expect(priceIdFor('standard', {})).toBe(null)
    expect(tierForPriceId('price_p', env)).toBe('school')
    expect(tierForPriceId('price_other', env)).toBe(null)
    expect(tierForPriceId(undefined, env)).toBe(null)
  })
  it('pictures: 300 per seat', () => {
    expect(imageAllowanceFor(25)).toBe(7500)
    expect(imageAllowanceFor(150)).toBe(45000)
  })
})

describe('onInvoicePaid — the term rule', () => {
  it('a renewal into a NEW paid period moves starts_at to that period start, resets pictures, applies seats', () => {
    const p = onInvoicePaid({ ...paidLicense, pending_seats: 20 }, { periodStart: Y2, periodEnd: Y3, quantity: 20, billingReason: 'subscription_cycle' })
    expect(p).toMatchObject({
      status: 'active', starts_at: iso(Y2), stripe_period_start: iso(Y2), expires_at: iso(Y3),
      seats: 20, image_allowance: 6000, images_used: 0, pending_seats: null,
    })
  })
  it('the same period paid again (late payment / retry / replay) never moves starts_at', () => {
    expect(onInvoicePaid(paidLicense, { periodStart: Y1, periodEnd: Y2, quantity: 25, billingReason: 'subscription_cycle' })).toBe(null)
    const late = onInvoicePaid({ ...paidLicense, status: 'grace' }, { periodStart: Y1, periodEnd: Y2, quantity: 25, billingReason: 'subscription_cycle' })
    expect(late).toEqual({ status: 'active' })
  })
  it('an older period arriving out of order is ignored', () => {
    const renewed = { ...paidLicense, starts_at: iso(Y2), stripe_period_start: iso(Y2), expires_at: iso(Y3) }
    expect(onInvoicePaid(renewed, { periodStart: Y1, periodEnd: Y2, quantity: 25, billingReason: 'subscription_cycle' })).toBe(null)
  })
  it('a proration invoice (seat increase) never starts a term', () => {
    expect(onInvoicePaid(paidLicense, { periodStart: D('2027-01-10T00:00:00Z'), periodEnd: Y2, quantity: 30, billingReason: 'subscription_update' })).toBe(null)
  })
  it('a trial converting to paid starts its first paid term', () => {
    const trial = { status: 'trial', seats: 35, starts_at: iso(D('2026-09-20T00:00:00Z')), stripe_period_start: null, expires_at: iso(D('2026-10-20T00:00:00Z')) }
    const p = onInvoicePaid(trial, { periodStart: D('2026-10-02T10:00:00Z'), periodEnd: D('2027-10-02T10:00:00Z'), quantity: 22, billingReason: 'subscription_create' })
    expect(p).toMatchObject({ status: 'active', starts_at: '2026-10-02T10:00:00.000Z', seats: 22, image_allowance: 6600, images_used: 0 })
  })
  it('never resurrects a canceled license; plans carry no picture allowance', () => {
    expect(onInvoicePaid({ ...paidLicense, status: 'canceled' }, { periodStart: Y2, periodEnd: Y3, quantity: 25, billingReason: 'subscription_cycle' })).toBe(null)
    const plan = onInvoicePaid({ status: 'pending_payment', seats: 200, stripe_period_start: null, expires_at: iso(Y1) }, { periodStart: Y1, periodEnd: Y2, quantity: 200, billingReason: 'subscription_create' }, 'plan')
    expect(plan).toEqual({ status: 'active', starts_at: iso(Y1), stripe_period_start: iso(Y1), expires_at: iso(Y2), pending_seats: null, seats: 200 })
  })
  it('a class quantity above 35 is clamped to the table limit (and flagged)', () => {
    expect(onInvoicePaid({ ...paidLicense, stripe_period_start: null }, { periodStart: Y2, periodEnd: Y3, quantity: 50, billingReason: 'subscription_create' }).seats).toBe(35)
  })
})

describe('grace', () => {
  it('a failed renewal puts an active license into grace for 14 days, starts_at untouched', () => {
    const p = onInvoiceFailed(paidLicense, { periodStart: Y2, billingReason: 'subscription_cycle' })
    expect(p).toEqual({ status: 'grace', expires_at: iso(Y2 + GRACE_DAYS * 86400000) })
    expect('starts_at' in p).toBe(false)
  })
  it('a replayed failure, or one for the paid period, changes nothing', () => {
    expect(onInvoiceFailed({ ...paidLicense, status: 'grace' }, { periodStart: Y2, billingReason: 'subscription_cycle' })).toBe(null)
    expect(onInvoiceFailed(paidLicense, { periodStart: Y1, billingReason: 'subscription_cycle' })).toBe(null)
    expect(onInvoiceFailed({ ...paidLicense, status: 'trial', stripe_period_start: null }, { periodStart: Y2, billingReason: 'subscription_create' })).toBe(null)
  })
  it('an invoice-billed renewal stays usable until the due date (no status, no term change)', () => {
    const due = Y2 + 30 * 86400000
    expect(onInvoiceOpened(paidLicense, { periodStart: Y2, dueDate: due, billingReason: 'subscription_cycle' })).toEqual({ expires_at: iso(due) })
    expect(onInvoiceOpened(paidLicense, { periodStart: Y1, dueDate: due, billingReason: 'subscription_cycle' })).toBe(null)
    expect(onInvoiceOpened({ ...paidLicense, expires_at: iso(due + 1) }, { periodStart: Y2, dueDate: due, billingReason: 'subscription_cycle' })).toBe(null)
  })
})

describe('subscription updates (seats, cancel) — never the term', () => {
  const created = Y1 / 1000 + 100
  it('a quantity raised outside the app is flagged for the owner, never mirrored (review I5/I12)', () => {
    const p = onSubscriptionUpdated(paidLicense, { quantity: 30 }, created)
    expect(p).toMatchObject({ needs_review: true })
    expect(p.seats).toBeUndefined()
    expect(p.image_allowance).toBeUndefined()
  })
  it('a reduction out of range or below the students enrolled is flagged, not mirrored (review I12)', () => {
    expect(onSubscriptionUpdated(paidLicense, { quantity: 8 }, created)).toMatchObject({ needs_review: true })
    expect(onSubscriptionUpdated(paidLicense, { quantity: 15 }, created, 'license', { floor: 18 })).toMatchObject({ needs_review: true })
    expect(onSubscriptionUpdated(paidLicense, { quantity: 15 }, created, 'license', { floor: 18 }).pending_seats).toBeUndefined()
    expect(onSubscriptionUpdated({ ...paidLicense, seats: 200 }, { quantity: 140 }, created, 'plan')).toMatchObject({ needs_review: true })
  })
  it('a paid term with an out-of-range quantity never grants more than was paid, and is flagged', () => {
    const p = onInvoicePaid({ ...paidLicense, stripe_period_start: null }, { periodStart: Y2, periodEnd: Y3, quantity: 5, billingReason: 'subscription_create' })
    expect(p).toMatchObject({ seats: 5, image_allowance: 1500, needs_review: true })
    const big = onInvoicePaid({ ...paidLicense, stripe_period_start: null }, { periodStart: Y2, periodEnd: Y3, quantity: 50, billingReason: 'subscription_create' })
    expect(big).toMatchObject({ seats: 35, needs_review: true })
    expect(onInvoicePaid({ ...paidLicense, stripe_period_start: null }, { periodStart: Y2, periodEnd: Y3, quantity: 20, billingReason: 'subscription_create' }).needs_review).toBeUndefined()
  })
  it('fewer seats wait for the renewal', () => {
    const p = onSubscriptionUpdated(paidLicense, { quantity: 20 }, created)
    expect(p).toMatchObject({ pending_seats: 20 })
    expect(p.seats).toBeUndefined()
  })
  it('an older event than the last applied one is ignored', () => {
    const rec = { ...paidLicense, stripe_event_at: iso(Y1 + 200000) }
    expect(onSubscriptionUpdated(rec, { quantity: 30 }, created)).toBe(null)
  })
  it('cancel at period end, canceled, unpaid', () => {
    expect(onSubscriptionUpdated(paidLicense, { quantity: 25, cancelAtPeriodEnd: true }, created)).toMatchObject({ cancel_at_period_end: true })
    expect(onSubscriptionUpdated(paidLicense, { quantity: 25, status: 'canceled' }, created)).toMatchObject({ status: 'canceled' })
    expect(onSubscriptionUpdated({ ...paidLicense, status: 'grace' }, { quantity: 25, status: 'unpaid' }, created)).toMatchObject({ status: 'lapsed' })
    expect(onSubscriptionDeleted(paidLicense, created)).toMatchObject({ status: 'canceled' })
    for (const p of [onSubscriptionUpdated(paidLicense, { quantity: 30, status: 'canceled' }, created), onSubscriptionDeleted(paidLicense, created)]) {
      expect(p.starts_at).toBeUndefined()
    }
  })
})

describe('seat change requests', () => {
  const base = { current: 25, pending: null, min: 10, max: 35 }
  it('increase now, decrease at renewal, never below the students enrolled', () => {
    expect(planSeatChange({ ...base, requested: 30, inUse: 20 })).toEqual({ ok: true, mode: 'increase' })
    expect(planSeatChange({ ...base, requested: 20, inUse: 20 })).toEqual({ ok: true, mode: 'decrease' })
    expect(planSeatChange({ ...base, requested: 19, inUse: 20 })).toEqual({ ok: false, code: 'below_enrolled', min: 20 })
    expect(planSeatChange({ ...base, requested: 9, inUse: 0 })).toMatchObject({ ok: false, code: 'below_minimum' })
    expect(planSeatChange({ ...base, requested: 36, inUse: 0 })).toMatchObject({ ok: false, code: 'above_maximum' })
    expect(planSeatChange({ ...base, pending: 20, requested: 25, inUse: 0 })).toEqual({ ok: true, mode: 'cancel_decrease' })
  })
})

it('a plan block mirrors the plan term', () => {
  expect(mirrorFromPlan({ status: 'active', starts_at: 'a', expires_at: 'b', stripe_period_start: 'a', cancel_at_period_end: false, seats: 300 }))
    .toEqual({ status: 'active', starts_at: 'a', expires_at: 'b', stripe_period_start: 'a', cancel_at_period_end: false })
})
