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
}

export function isFoundingEligible(now = new Date()) {
  return new Date(now).getTime() < Date.parse(FOUNDING_ENDS_AT)
}

/// The tier a CLASS purchase made at `now` gets. The founding price is
/// applied automatically while eligible.
export const classTier = (now = new Date()) => (isFoundingEligible(now) ? 'founding' : 'standard')

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

export function quoteSchool(seats) {
  const code = validateSchoolSeats(seats)
  if (code) return { ok: false, code }
  const unit = SEAT_PRICE_CENTS.school
  return { ok: true, kind: 'school', tier: 'school', seats, unit_cents: unit, total_cents: unit * seats, currency: CURRENCY }
}

export function priceIdFor(tier, env = process.env) {
  const name = PRICE_ENV[tier]
  return (name && env[name]) || null
}

/// Reverse lookup for webhooks: which tier a Stripe Price id is. Null for a
/// price that isn't one of ours (never guessed).
export function tierForPriceId(priceId, env = process.env) {
  if (!priceId) return null
  for (const [tier, name] of Object.entries(PRICE_ENV)) if (env[name] && env[name] === priceId) return tier
  return null
}

export const imageAllowanceFor = (seats) => IMAGES_PER_SEAT * Math.max(0, Number(seats) || 0)

/// "$19" from 1900 (display only; whole dollars).
export const dollars = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
