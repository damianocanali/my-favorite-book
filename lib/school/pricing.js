// School prices — the server's copy, and the one that counts (Stage 4,
// spec 2026-10-01 §4). Same rule as lib/catalog.js for coins: the web
// pricing page only DISPLAYS these; Stripe charges the Price whose id is in
// the env var named here, and tests/school-pricing.test.js fails if the
// page and this file drift. The iOS app shows no price at all (App Store
// 3.1.3; tests/ios-catalog-keys.test.js).
//
// Prices are per student (seat) per year, USD only (schools spec D1).

export const CURRENCY = 'usd'

/// Cents per seat per year.
export const SEAT_PRICE_CENTS = {
  standard: 1900, // a class, any time
  founding: 1500, // a class bought for the 2026–27 school year
  school: 1700, // the school plan (one invoice, many classes)
}

// ── Owner decisions still open: each is a ONE-LINE change here ─────────
/// true: a founding purchase keeps renewing at the founding price for as
/// long as it renews. false: after the founding window, the nightly job
/// (lib/school/foundingReprice.js) moves each founding subscription to the
/// standard / school price from its NEXT renewal (no proration).
export const FOUNDING_LOCKED_FOR_LIFE = true
/// The school plan's price for purchases in the founding window (2026–27).
/// Set to null to charge SEAT_PRICE_CENTS.school from the start.
export const SCHOOL_PLAN_FOUNDING_PRICE_CENTS = 1500
// ───────────────────────────────────────────────────────────────────────

/// Cents per seat per year, by the tier stored on a license or plan.
export function unitCentsForTier(tier) {
  if (tier === 'school_founding') return SCHOOL_PLAN_FOUNDING_PRICE_CENTS ?? SEAT_PRICE_CENTS.school
  return SEAT_PRICE_CENTS[tier] ?? null
}

/// Pictures per seat while an approved invoice plan is still unpaid
/// (Stage 4 review I6); 300 once paid.
export const UNPAID_IMAGES_PER_SEAT = 50

export const MIN_CLASS_SEATS = 10
export const MAX_CLASS_SEATS = 35
export const MIN_SCHOOL_SEATS = 150
export const MAX_SCHOOL_SEATS = 20000

/// Founding price: purchases made on or before 31 July 2027 (end of the
/// 2026–27 school year). The day ends at midnight US Pacific, so a teacher
/// anywhere in the contiguous US still gets it on the 31st.
export const FOUNDING_LAST_DAY = '2027-07-31'
export const FOUNDING_ENDS_AT = '2027-08-01T07:00:00.000Z'

/// What a seat includes besides every feature.
export const IMAGES_PER_SEAT = 300
export const BOOKS_PER_SEAT_PER_TERM = 1

/// Env vars holding the Stripe Price ids (the owner creates the Prices).
export const PRICE_ENV = {
  standard: 'STRIPE_PRICE_SEAT',
  founding: 'STRIPE_PRICE_SEAT_FOUNDING',
  school: 'STRIPE_PRICE_SCHOOL_SEAT',
  // Falls back to STRIPE_PRICE_SEAT_FOUNDING when the amounts are the same
  // (the default: both $15), so no extra Stripe Price is needed.
  school_founding: 'STRIPE_PRICE_SCHOOL_SEAT_FOUNDING',
}

export function isFoundingEligible(now = new Date()) {
  return new Date(now).getTime() < Date.parse(FOUNDING_ENDS_AT)
}

/// The tier a CLASS purchase made at `now` gets. The founding price is
/// applied automatically while eligible.
export const classTier = (now = new Date()) => (isFoundingEligible(now) ? 'founding' : 'standard')

/// The tier a SCHOOL PLAN purchase made at `now` gets.
export const schoolTier = (now = new Date()) =>
  (SCHOOL_PLAN_FOUNDING_PRICE_CENTS != null && isFoundingEligible(now) ? 'school_founding' : 'school')

/// Quantity limits per kind of record, for anything Stripe reports
/// (review I12): a class 10–35, a school plan 150–20000.
export function quantityProblem(kind, q) {
  if (!Number.isInteger(q)) return 'bad_seats'
  const [min, max] = kind === 'plan' ? [MIN_SCHOOL_SEATS, MAX_SCHOOL_SEATS] : [MIN_CLASS_SEATS, MAX_CLASS_SEATS]
  if (q < min) return 'below_minimum'
  if (q > max) return 'above_maximum'
  return null
}

const isInt = (n) => Number.isInteger(n)

export function validateClassSeats(seats) {
  if (!isInt(seats)) return 'bad_seats'
  if (seats < MIN_CLASS_SEATS) return 'below_minimum'
  if (seats > MAX_CLASS_SEATS) return 'above_maximum'
  return null
}

export function validateSchoolSeats(seats) {
  if (!isInt(seats)) return 'bad_seats'
  if (seats < MIN_SCHOOL_SEATS) return 'below_minimum'
  if (seats > MAX_SCHOOL_SEATS) return 'above_maximum'
  return null
}

/// { ok, kind:'class', tier, seats, unit_cents, total_cents } or { ok:false, code }.
export function quoteClass(seats, now = new Date()) {
  const code = validateClassSeats(seats)
  if (code) return { ok: false, code }
  const tier = classTier(now)
  const unit = SEAT_PRICE_CENTS[tier]
  return { ok: true, kind: 'class', tier, seats, unit_cents: unit, total_cents: unit * seats, currency: CURRENCY }
}

export function quoteSchool(seats, now = new Date()) {
  const code = validateSchoolSeats(seats)
  if (code) return { ok: false, code }
  const tier = schoolTier(now)
  const unit = unitCentsForTier(tier)
  return { ok: true, kind: 'school', tier, seats, unit_cents: unit, total_cents: unit * seats, currency: CURRENCY }
}

/// Seats ADDED mid-term are charged the full yearly per-seat price for the
/// current term, never prorated down: each seat includes a printed book
/// and 300 pictures for the year (Stage 4 review I5, owner ruling). Priced
/// at the tier the record already pays.
export function seatAddQuote(tier, added) {
  const unit = unitCentsForTier(tier)
  if (!unit || !Number.isInteger(added) || added < 1) return null
  return { unit_cents: unit, added, total_cents: unit * added, currency: CURRENCY }
}

export function priceIdFor(tier, env = process.env) {
  const name = PRICE_ENV[tier]
  if (tier === 'school_founding' && !(name && env[name]) && SCHOOL_PLAN_FOUNDING_PRICE_CENTS === SEAT_PRICE_CENTS.founding) {
    return env[PRICE_ENV.founding] || null
  }
  return (name && env[name]) || null
}

/// Reverse lookup for webhooks: which tier a Stripe Price id is. Null for a
/// price that isn't one of ours (never guessed).
export function tierForPriceId(priceId, env = process.env, kind = 'license') {
  if (!priceId) return null
  // A school plan on the shared founding Price is 'school_founding'.
  if (kind === 'plan' && priceId === priceIdFor('school_founding', env)) return 'school_founding'
  for (const [tier, name] of Object.entries(PRICE_ENV)) if (env[name] && env[name] === priceId) return tier
  return null
}

export const imageAllowanceFor = (seats) => IMAGES_PER_SEAT * Math.max(0, Number(seats) || 0)

/// "$19" from 1900 (display only; whole dollars).
export const dollars = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
