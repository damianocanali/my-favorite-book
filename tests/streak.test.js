import { describe, it, expect } from 'vitest'
import { isValidStreakDay } from '../api/streak.js'

// Fixed "now": 2026-06-15T12:00:00Z
const NOW = new Date('2026-06-15T12:00:00Z')

describe('isValidStreakDay', () => {
  it('accepts UTC today', () => {
    expect(isValidStreakDay('2026-06-15', NOW)).toBe(true)
  })
  it('accepts ±1 day (timezone tolerance)', () => {
    expect(isValidStreakDay('2026-06-14', NOW)).toBe(true)
    expect(isValidStreakDay('2026-06-16', NOW)).toBe(true)
  })
  it('rejects anything beyond the window', () => {
    expect(isValidStreakDay('2026-06-13', NOW)).toBe(false)
    expect(isValidStreakDay('2026-06-17', NOW)).toBe(false)
    expect(isValidStreakDay('2027-06-15', NOW)).toBe(false)
  })
  it('rejects malformed input', () => {
    expect(isValidStreakDay(undefined, NOW)).toBe(false)
    expect(isValidStreakDay(null, NOW)).toBe(false)
    expect(isValidStreakDay(20260615, NOW)).toBe(false)
    expect(isValidStreakDay('June 15, 2026', NOW)).toBe(false)
    expect(isValidStreakDay('2026-6-15', NOW)).toBe(false)
    expect(isValidStreakDay('2026-06-15T00:00:00Z', NOW)).toBe(false)
  })
  it('rejects rollover dates like Feb 31', () => {
    expect(isValidStreakDay('2026-02-31', new Date('2026-03-01T12:00:00Z'))).toBe(false)
  })
  it('handles month boundaries', () => {
    const eom = new Date('2026-07-01T02:00:00Z')
    expect(isValidStreakDay('2026-06-30', eom)).toBe(true)
    expect(isValidStreakDay('2026-07-02', eom)).toBe(true)
    expect(isValidStreakDay('2026-06-29', eom)).toBe(false)
  })
})
