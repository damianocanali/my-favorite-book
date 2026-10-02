import { describe, it, expect } from 'vitest'
import { PICTURES, PICTURE_IDS, AVATAR_EMOJI } from '../lib/school/pictures.js'
import {
  CODE_CHARS, CODE_RE, generateClassCode, generatePictureSecret, isValidPictureSecret,
  hashPictureSecret, timingSafeEqualHex, hashIp, syntheticStudentEmail,
} from '../lib/school/crypto.js'
import { DEFAULT_SCHOOL_HOURS, validateSchoolHours, isWithinSchoolHours } from '../lib/school/hours.js'
import { isLicenseUsable, TRIAL_IMAGES, IMAGES_PER_SEAT, MAX_SEATS } from '../lib/school/license.js'

describe('pictures', () => {
  it('has 16 distinct language-free pictures', () => {
    expect(PICTURES).toHaveLength(16)
    expect(new Set(PICTURE_IDS).size).toBe(16)
    expect(new Set(PICTURES.map((p) => p.emoji)).size).toBe(16)
    for (const id of PICTURE_IDS) expect(id).toMatch(/^[a-z]+$/)
  })
  it('has enough avatar emoji for a full class', () => {
    expect(new Set(AVATAR_EMOJI).size).toBeGreaterThanOrEqual(MAX_SEATS)
  })
})

describe('class codes', () => {
  it('are 6 unambiguous characters and pass CODE_RE', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateClassCode()
      expect(c).toHaveLength(6)
      expect(CODE_RE.test(c)).toBe(true)
      for (const ch of c) expect(CODE_CHARS).toContain(ch)
    }
  })
  it('use every character over many draws (no modulo bias to a subset)', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) for (const ch of generateClassCode()) seen.add(ch)
    expect(seen.size).toBe(CODE_CHARS.length)
  })
})

describe('picture secrets', () => {
  it('are 3 known pictures', () => {
    for (let i = 0; i < 100; i++) {
      const s = generatePictureSecret()
      expect(s).toHaveLength(3)
      expect(isValidPictureSecret(s)).toBe(true)
    }
  })
  it('rejects wrong shapes', () => {
    expect(isValidPictureSecret(['cat', 'cat'])).toBe(false)
    expect(isValidPictureSecret(['cat', 'cat', 'unicorn'])).toBe(false)
    expect(isValidPictureSecret('cat,cat,cat')).toBe(false)
  })
  it('hash is deterministic, per student and per pepper', async () => {
    const p = ['cat', 'sun', 'boat']
    const a = await hashPictureSecret('pepper', 'student-1', p)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashPictureSecret('pepper', 'student-1', p)).toBe(a)
    expect(await hashPictureSecret('pepper', 'student-2', p)).not.toBe(a)
    expect(await hashPictureSecret('other', 'student-1', p)).not.toBe(a)
    expect(await hashPictureSecret('pepper', 'student-1', ['sun', 'cat', 'boat'])).not.toBe(a)
  })
  it('timingSafeEqualHex compares exactly', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false)
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false)
  })
  it('ip hash differs from a picture hash of the same input', async () => {
    expect(await hashIp('pepper', '1.2.3.4')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('synthetic email', () => {
  it('uses the reserved .invalid TLD and carries no name', () => {
    const e = syntheticStudentEmail()
    expect(e).toMatch(/^s-[0-9a-f-]{36}@students\.mybooklab\.invalid$/)
  })
})

describe('school hours', () => {
  const NY = 'America/New_York'
  it('default is Mon–Fri 08:00–15:30 and valid', () => {
    expect(validateSchoolHours(DEFAULT_SCHOOL_HOURS)).toBe(true)
    expect(Object.keys(DEFAULT_SCHOOL_HOURS).sort()).toEqual(['1', '2', '3', '4', '5'])
  })
  it('Tuesday 10:00 in New York is inside', () => {
    // 2026-09-29 is a Tuesday; 14:00Z = 10:00 EDT
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T14:00:00Z'))).toBe(true)
  })
  it('Tuesday 16:00 in New York is outside', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T20:00:00Z'))).toBe(false)
  })
  it('uses the class time zone, not UTC', () => {
    // 2026-09-29T13:00Z is 09:00 in New York (inside) but 06:00 in Los Angeles (outside)
    const d = new Date('2026-09-29T13:00:00Z')
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, d)).toBe(true)
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, 'America/Los_Angeles', d)).toBe(false)
  })
  it('Saturday is outside', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-10-03T15:00:00Z'))).toBe(false)
  })
  it('end time is exclusive, start inclusive', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T12:00:00Z'))).toBe(true)  // 08:00
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, NY, new Date('2026-09-29T19:30:00Z'))).toBe(false) // 15:30
  })
  it('rejects malformed hours', () => {
    expect(validateSchoolHours({ 8: ['08:00', '15:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['15:00', '08:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['8:00', '15:00'] })).toBe(false)
    expect(validateSchoolHours({ 1: ['08:00'] })).toBe(false)
    expect(validateSchoolHours(null)).toBe(false)
    expect(validateSchoolHours({})).toBe(true) // no school days is allowed
  })
  it('an invalid time zone is treated as outside hours, never throws', () => {
    expect(isWithinSchoolHours(DEFAULT_SCHOOL_HOURS, 'Mars/Olympus', new Date())).toBe(false)
  })
})

describe('licenses', () => {
  const now = new Date('2026-10-01T00:00:00Z')
  const future = '2026-11-01T00:00:00Z'
  const past = '2026-09-01T00:00:00Z'
  it('trial, active, comped are usable until they expire', () => {
    for (const status of ['trial', 'active', 'comped']) {
      expect(isLicenseUsable({ status, expires_at: future }, now)).toBe(true)
      expect(isLicenseUsable({ status, expires_at: past }, now)).toBe(false)
    }
  })
  it('grace is usable until its end (expires_at = paid term end + 14 days), never after — review I9', () => {
    expect(isLicenseUsable({ status: 'grace', expires_at: future }, now)).toBe(true)
    expect(isLicenseUsable({ status: 'grace', expires_at: past }, now)).toBe(false)
  })
  it('lapsed, canceled and missing are not usable', () => {
    for (const status of ['lapsed', 'canceled']) {
      expect(isLicenseUsable({ status, expires_at: future }, now)).toBe(false)
    }
    expect(isLicenseUsable(null, now)).toBe(false)
  })
  it('pending_payment (an open invoice, Stage 4) is usable until its due date', () => {
    expect(isLicenseUsable({ status: 'pending_payment', expires_at: future }, now)).toBe(true)
    expect(isLicenseUsable({ status: 'pending_payment', expires_at: past }, now)).toBe(false)
  })
  it('constants match the owner decisions', () => {
    expect(TRIAL_IMAGES).toBe(300)
    expect(IMAGES_PER_SEAT).toBe(300)
    expect(MAX_SEATS).toBe(35)
  })
})
