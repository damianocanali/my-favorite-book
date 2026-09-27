// Pure helpers behind the teacher web UI (Task 12): parsing a pasted roster
// textarea into clean names, working out trial days remaining for the
// LicenseBadge, and paginating sign-in cards 6-to-a-page for print. These
// are exercised here in isolation (no DOM) because TeacherPage/
// TeacherClassPage/RosterTable/AddStudents/SignInCards are exercised by hand
// (simulator/browser) and by `npx vite build`, same convention as
// school-web.test.js for the sign-in side.
import { describe, it, expect } from 'vitest'
import { parseRosterText, trialDaysLeft, chunk } from '../src/components/school/rosterText.js'

describe('parseRosterText', () => {
  it('splits on newlines and commas, trims, collapses spaces, drops empties, dedupes case-insensitively keeping the first', () => {
    const input = 'Maya R\nleo, Maya r\n\n  Zoë   K '
    expect(parseRosterText(input)).toEqual(['Maya R', 'leo', 'Zoë K'])
  })

  it('cuts a name over 24 characters down to 24', () => {
    const longName = '123456789012345678901234567890' // 30 chars
    expect(parseRosterText(longName)).toEqual([longName.slice(0, 24)])
  })

  it('returns an empty array for empty or whitespace-only input', () => {
    expect(parseRosterText('')).toEqual([])
    expect(parseRosterText('   \n\n  ,  ')).toEqual([])
  })

  it('handles undefined/null input without throwing', () => {
    expect(parseRosterText(undefined)).toEqual([])
    expect(parseRosterText(null)).toEqual([])
  })
})

describe('trialDaysLeft', () => {
  it('ceils fractional days remaining', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const license = { status: 'trial', expires_at: new Date(now.getTime() + 29.2 * 86_400_000).toISOString() }
    expect(trialDaysLeft(license, now)).toBe(30)
  })

  it('never goes below 0 once expired', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const license = { status: 'trial', expires_at: new Date(now.getTime() - 5 * 86_400_000).toISOString() }
    expect(trialDaysLeft(license, now)).toBe(0)
  })

  it('is null for a non-trial license', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(trialDaysLeft({ status: 'active', expires_at: now.toISOString() }, now)).toBeNull()
    expect(trialDaysLeft({ status: 'comped', expires_at: now.toISOString() }, now)).toBeNull()
  })

  it('is null when there is no license at all', () => {
    expect(trialDaysLeft(null, new Date())).toBeNull()
  })
})

describe('chunk', () => {
  it('splits an array into fixed-size groups, with a shorter last group', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([[1, 2, 3, 4, 5, 6], [7]])
  })

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 6)).toEqual([])
  })

  it('handles an exact multiple with no short trailing group', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })
})
