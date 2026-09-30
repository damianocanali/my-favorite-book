// src/lib/classDevice.js: the teacher-set class browser that replaced the
// implicit "who's signing in" / class-code memory. Covers the stored
// record (round trip, every kind of bad value, storage throwing), the
// legacy purge, and the signed-out redirect decision.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CLASS_DEVICE_KEY, LEGACY_KEYS,
  validateClassDevice, readClassDevice, writeClassDevice, clearClassDevice,
  purgeLegacySignInMemory, signedOutRedirect, isClassUnavailable,
} from '../src/lib/classDevice.js'

const good = { classId: 'c-1', code: 'ABC234', name: '3B' }

describe('classDevice storage', () => {
  beforeEach(() => localStorage.clear())

  it('is null when nothing is stored', () => {
    expect(readClassDevice()).toBeNull()
  })

  it('round-trips a set-up class, and only its three fields', () => {
    expect(writeClassDevice({ ...good, extra: 'nope' })).toBe(true)
    expect(readClassDevice()).toEqual(good)
  })

  it('uppercases the code', () => {
    writeClassDevice({ ...good, code: 'abc234' })
    expect(readClassDevice().code).toBe('ABC234')
  })

  it('refuses to save a malformed record', () => {
    expect(writeClassDevice({ classId: '', code: 'ABC234', name: 'x' })).toBe(false)
    expect(writeClassDevice({ classId: 'c', code: 'ABC23', name: 'x' })).toBe(false)
    expect(writeClassDevice({ classId: 'c', code: 'ABC-34', name: 'x' })).toBe(false)
    expect(writeClassDevice(null)).toBe(false)
    expect(localStorage.getItem(CLASS_DEVICE_KEY)).toBeNull()
  })

  it('reads a corrupted or partial stored value as "not set up"', () => {
    for (const raw of ['not json', '"ABC234"', '{}', JSON.stringify({ classId: 'c', code: 'nope!!' })]) {
      localStorage.setItem(CLASS_DEVICE_KEY, raw)
      expect(readClassDevice()).toBeNull()
    }
  })

  it('a missing name reads as empty, not as a broken record', () => {
    expect(validateClassDevice({ classId: 'c', code: 'ABC234' })).toEqual({ classId: 'c', code: 'ABC234', name: '' })
  })

  it('clearClassDevice removes it', () => {
    writeClassDevice(good)
    clearClassDevice()
    expect(readClassDevice()).toBeNull()
  })

  it('never throws when storage itself throws', () => {
    const original = globalThis.localStorage
    const boom = () => { throw new Error('blocked') }
    globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom, clear: boom }
    try {
      expect(readClassDevice()).toBeNull()
      expect(writeClassDevice(good)).toBe(false)
      expect(() => clearClassDevice()).not.toThrow()
      expect(() => purgeLegacySignInMemory()).not.toThrow()
    } finally {
      globalThis.localStorage = original
    }
  })
})

describe('purgeLegacySignInMemory', () => {
  beforeEach(() => localStorage.clear())

  it('forgets the old "who" choice and remembered class code, and nothing else', () => {
    localStorage.setItem('mybooklab-signin-who', 'kid')
    localStorage.setItem('mybooklab-class-code', 'ABC234')
    writeClassDevice(good)
    purgeLegacySignInMemory()
    for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBeNull()
    expect(readClassDevice()).toEqual(good)
  })
})

describe('signedOutRedirect', () => {
  it('sends a signed-out visitor on a class browser to /class', () => {
    expect(signedOutRedirect({ device: good, signedIn: false })).toBe('/class')
  })

  it('stays put without a class browser', () => {
    expect(signedOutRedirect({ device: null, signedIn: false })).toBeNull()
  })

  it('stays put when someone is signed in', () => {
    expect(signedOutRedirect({ device: good, signedIn: true })).toBeNull()
  })

  it('stays put when "Not in <class>?" asked for the chooser', () => {
    expect(signedOutRedirect({ device: good, signedIn: false, choose: true })).toBeNull()
  })
})

describe('isClassUnavailable', () => {
  it('is true for the roster 404/423 codes only', () => {
    for (const c of ['class_not_found', 'class_resting', 'sign_in_closed', 'class_paused']) {
      expect(isClassUnavailable(c)).toBe(true)
    }
    for (const c of ['too_many', 'upstream', undefined, null, 'generic']) {
      expect(isClassUnavailable(c)).toBe(false)
    }
  })
})
