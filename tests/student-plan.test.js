import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getPlan } from '../src/lib/plans'
import { planKeyFor } from '../src/hooks/useSubscription'

// A class (student) account must get a class-appropriate plan, not the
// consumer free tier — see the controller ruling this test was added for.
// The real, authoritative image cap is enforced server-side
// (api/_school.js's enforceStudentImageCap / RPC school_bump_image,
// 15/student/day); the client-side plan value below is UX only, but it must
// at least be in the same ballpark rather than the free tier's 2/day, or a
// student hits a false "limit reached" wall well before their real one.
const student = { id: 'u', app_metadata: { role: 'student' } }
const consumer = { id: 'p', app_metadata: {}, user_metadata: { role: 'student' } }

describe('getPlan(\'student\')', () => {
  const plan = getPlan('student')

  it('has the class image allowance, not the free tier\'s', () => {
    expect(plan.imagesPerDay).toBe(15)
  })

  it('never exports PDF — that is a consumer (paid) feature, not something a class license unlocks', () => {
    expect(plan.pdfExport).toBe(false)
  })

  it('has no book limit — a class account is never told to upgrade for more books', () => {
    expect(plan.maxBooks).toBe(Infinity)
  })
})

describe('planKeyFor', () => {
  it('resolves a class (student) account to \'student\' regardless of any subscription row', () => {
    expect(planKeyFor(student, null)).toBe('student')
    // Even a row that would otherwise say 'family'/'active' must not win —
    // app_metadata.role is the one field a signed-in student can't rewrite,
    // so it has to override anything a stale or bugged row claims.
    expect(planKeyFor(student, { plan: 'family', status: 'active' })).toBe('student')
  })

  it('never trusts a spoofed user_metadata role to grant the student plan', () => {
    expect(planKeyFor(consumer, null)).toBe('free')
  })

  it('keeps today\'s logic for a consumer account: active/trialing row wins, otherwise free', () => {
    expect(planKeyFor(consumer, null)).toBe('free')
    expect(planKeyFor(consumer, { plan: 'family', status: 'active' })).toBe('family')
    expect(planKeyFor(consumer, { plan: 'teacher', status: 'trialing' })).toBe('teacher')
    expect(planKeyFor(consumer, { plan: 'family', status: 'canceled' })).toBe('free')
  })
})

describe('PricingPage never lists the student plan', () => {
  // PricingPage hardcodes three named cards (free/family/teacher) rather
  // than iterating PLANS — if that ever changes to a blind
  // Object.keys(PLANS)/.values(PLANS)/.entries(PLANS) loop, 'student' would
  // start appearing as a purchasable card with no price, which must never
  // happen (a class account is never sold anything, and never reaches this
  // route-guarded page in the first place). This is a regression fence for
  // that specific rewrite, not a claim that PricingPage does this today.
  const src = readFileSync('src/pages/PricingPage.jsx', 'utf8')

  it('does not iterate PLANS', () => {
    expect(src).not.toMatch(/Object\s*\.\s*(keys|values|entries)\s*\(\s*PLANS\s*\)/)
  })

  it('never mentions the student plan key', () => {
    expect(src).not.toMatch(/['"`]student['"`]/)
  })
})
