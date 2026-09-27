import { describe, it, expect } from 'vitest'
import { createRequestToken } from '../src/lib/requestToken'

// Pure logic behind CheckInHost.jsx's 'grownup' help-ask guard — see the
// controller ruling this was added for: an in-flight askForHelp('grownup')
// promise resolving late must not silently reopen TeacherHelpScreen after
// the child already closed it, and must not overwrite a second, newer ask
// with a stale result from the first.

describe('createRequestToken', () => {
  it('accepts a resolve that is still the only, current request', () => {
    const token = createRequestToken()
    const t1 = token.next()
    expect(token.isCurrent(t1)).toBe(true)
  })

  it('rejects a stale resolve once a newer request has started', () => {
    const token = createRequestToken()
    const t1 = token.next()
    const t2 = token.next()
    expect(token.isCurrent(t1)).toBe(false)
    expect(token.isCurrent(t2)).toBe(true)
  })

  it('rejects a stale resolve after clear() — "the child closed the screen before it resolved"', () => {
    const token = createRequestToken()
    const t1 = token.next()
    token.clear()
    expect(token.isCurrent(t1)).toBe(false)
  })

  it('a fresh request after clear() never collides with a still-in-flight older one', () => {
    // The exact scenario a naive "reset the counter to 0/null on clear()"
    // implementation gets wrong: ask #1 gets token 1 and is still in
    // flight; the child closes (clear()); a fresh ask #2 starts. Because
    // the counter here never rewinds, ask #2's token is guaranteed to be
    // one this instance has never issued before, so ask #1's late resolve
    // (still holding token 1) can never be mistaken for ask #2's.
    const token = createRequestToken()
    const t1 = token.next()
    token.clear()
    const t2 = token.next()
    expect(t1).not.toBe(t2)
    expect(token.isCurrent(t1)).toBe(false)
    expect(token.isCurrent(t2)).toBe(true)
  })

  it('clear() with no request yet is a harmless no-op', () => {
    const token = createRequestToken()
    expect(() => token.clear()).not.toThrow()
    const t1 = token.next()
    expect(token.isCurrent(t1)).toBe(true)
  })
})
