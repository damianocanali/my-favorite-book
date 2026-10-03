// Stage 4: the school prices a teacher SEES must be the prices the server
// CHARGES (same rule as tests/catalog.test.js for coins). lib/school/
// pricing.js is the only copy: the web pricing page, the class Plan &
// billing panel and the school plan page all render from it, and no locale
// string may carry an amount of its own.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SEAT_PRICE_CENTS, MIN_CLASS_SEATS, MIN_SCHOOL_SEATS, FOUNDING_LAST_DAY } from '../lib/school/pricing.js'

const read = (p) => readFileSync(p, 'utf8')
const MONEY = /(?:[$€£]\s?\d)|(?:\d\s?[$€£])|\bdollar|\beuro/i

function strings(obj, out = []) {
  for (const v of Object.values(obj ?? {})) {
    if (typeof v === 'string') out.push(v)
    else if (v && typeof v === 'object') strings(v, out)
  }
  return out
}

describe('school prices have one source', () => {
  it('the owner-approved numbers', () => {
    expect(SEAT_PRICE_CENTS).toEqual({ standard: 1900, founding: 1500, school: 1700 })
    expect(MIN_CLASS_SEATS).toBe(10)
    expect(MIN_SCHOOL_SEATS).toBe(150)
    expect(FOUNDING_LAST_DAY).toBe('2027-07-31')
  })

  it('the public pricing page renders every price and minimum from lib/school/pricing.js', () => {
    const src = read('src/pages/SchoolsPricingPage.jsx')
    expect(src).toMatch(/from '\.\.\/\.\.\/lib\/school\/pricing\.js'/)
    for (const tier of ['standard', 'founding', 'school']) expect(src).toContain(`SEAT_PRICE_CENTS.${tier}`)
    for (const k of ['MIN_CLASS_SEATS', 'MAX_CLASS_SEATS', 'MIN_SCHOOL_SEATS', 'FOUNDING_LAST_DAY', 'IMAGES_PER_SEAT']) expect(src).toContain(k)
    expect(src).not.toMatch(/\b(19|15|17|1900|1500|1700)\b/)
    expect(src).not.toMatch(MONEY)
  })

  it('the purchase screens quote from the same functions the server validates with', () => {
    const plan = read('src/components/school/PlanBillingSection.jsx')
    expect(plan).toMatch(/quoteClass/)
    const school = read('src/pages/TeacherSchoolPlanPage.jsx')
    expect(school).toMatch(/quoteSchool/)
    const api = read('api/school/checkout.js')
    expect(api).toMatch(/quoteClass\(body\.seats\)/)
    expect(api).toMatch(/quoteSchool\(body\.seats\)/)
    expect(api).toMatch(/priceIdFor\(/)
    for (const src of [plan, school, api]) expect(src).not.toMatch(MONEY)
  })

  it('no locale string carries a price of its own (EN and IT)', () => {
    for (const lang of ['en', 'it']) {
      const pricing = JSON.parse(read(`src/i18n/locales/${lang}/pricing.json`)).schools
      const school = JSON.parse(read(`src/i18n/locales/${lang}/school.json`)).teacher
      const all = [...strings(pricing), ...strings(school.billing), ...strings(school.school_plan), ...strings(school.verify)]
      expect(all.length).toBeGreaterThan(50)
      expect(all.filter((s) => MONEY.test(s)), lang).toEqual([])
      // Minimums and the founding date come in as {{placeholders}}.
      expect(all.filter((s) => /\b(10|150|35|2027)\b/.test(s)), lang).toEqual([])
    }
  })
})
