import { describe, it, expect, beforeEach } from 'vitest'
import { getRememberedClassId, setRememberedClassId, pickClassId } from '../src/lib/dashboardClass.js'

beforeEach(() => {
  localStorage.clear()
})

describe('getRememberedClassId / setRememberedClassId', () => {
  it('returns null when nothing is stored', () => {
    expect(getRememberedClassId()).toBeNull()
  })

  it('round-trips a stored id', () => {
    setRememberedClassId('class-1')
    expect(getRememberedClassId()).toBe('class-1')
  })

  it('ignores an attempt to store a falsy id', () => {
    setRememberedClassId('class-1')
    setRememberedClassId(null)
    setRememberedClassId('')
    expect(getRememberedClassId()).toBe('class-1')
  })

  it('never throws when localStorage is blocked', () => {
    const real = globalThis.localStorage
    globalThis.localStorage = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
    }
    try {
      expect(() => setRememberedClassId('class-1')).not.toThrow()
      expect(getRememberedClassId()).toBeNull()
    } finally {
      globalThis.localStorage = real
    }
  })
})

describe('pickClassId', () => {
  const classes = [{ id: 'a' }, { id: 'b' }]

  it('returns null when there are no classes', () => {
    expect(pickClassId([], 'a')).toBeNull()
  })

  it('prefers the remembered id when it is still one of the classes', () => {
    expect(pickClassId(classes, 'b')).toBe('b')
  })

  it('falls back to the first class when nothing is remembered', () => {
    expect(pickClassId(classes, null)).toBe('a')
  })

  it('falls back to the first class when the remembered id is stale', () => {
    expect(pickClassId(classes, 'deleted-class')).toBe('a')
  })
})
