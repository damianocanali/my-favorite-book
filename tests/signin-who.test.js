// getRememberedWho/setRememberedWho back the /login chooser's "remember my
// last choice" behaviour. Covers a clean round trip, every kind of bad
// stored value, and storage throwing outright (private browsing / a full
// quota) — none of which should ever surface as a thrown error or as one
// of the three real choices.
import { describe, it, expect, beforeEach } from 'vitest'
import { getRememberedWho, setRememberedWho } from '../src/lib/signinWho.js'

const KEY = 'mybooklab-signin-who'

describe('signinWho', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(getRememberedWho()).toBeNull()
  })

  it('round-trips each valid choice', () => {
    for (const who of ['kid', 'family', 'teacher']) {
      setRememberedWho(who)
      expect(getRememberedWho()).toBe(who)
    }
  })

  it('overwrites a previous choice', () => {
    setRememberedWho('kid')
    setRememberedWho('teacher')
    expect(getRememberedWho()).toBe('teacher')
  })

  it('ignores an attempt to store an invalid choice, leaving the previous one intact', () => {
    setRememberedWho('family')
    setRememberedWho('parent') // not one of the three real choices
    expect(getRememberedWho()).toBe('family')
  })

  it('treats a garbage stored value as no remembered choice', () => {
    localStorage.setItem(KEY, 'not-a-real-choice')
    expect(getRememberedWho()).toBeNull()
  })

  it('treats an empty string as no remembered choice', () => {
    localStorage.setItem(KEY, '')
    expect(getRememberedWho()).toBeNull()
  })

  it('reads back null gracefully when storage never had the key', () => {
    localStorage.removeItem(KEY)
    expect(getRememberedWho()).toBeNull()
  })

  it('getRememberedWho never throws when storage access itself throws', () => {
    const real = globalThis.localStorage
    globalThis.localStorage = {
      getItem() { throw new Error('storage blocked') },
    }
    try {
      expect(() => getRememberedWho()).not.toThrow()
      expect(getRememberedWho()).toBeNull()
    } finally {
      globalThis.localStorage = real
    }
  })

  it('setRememberedWho never throws when storage access itself throws', () => {
    const real = globalThis.localStorage
    globalThis.localStorage = {
      setItem() { throw new Error('quota exceeded') },
    }
    try {
      expect(() => setRememberedWho('teacher')).not.toThrow()
    } finally {
      globalThis.localStorage = real
    }
  })
})
