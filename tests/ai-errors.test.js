// Raw English server errors must never reach an Italian child's screen.
import { describe, it, expect } from 'vitest'
import { friendlyAiError } from '../src/lib/aiErrors.js'

const t = (k) => k

describe('friendlyAiError', () => {
  it('maps the sentences a child can hit', () => {
    expect(friendlyAiError(new Error("You've reached today's creation limit — come back tomorrow!"), t)).toBe('errors:ai.daily_limit')
    expect(friendlyAiError(new Error("Let's keep our story kind and friendly — try different words!"), t)).toBe('errors:ai.unkind')
    expect(friendlyAiError(new Error('Too many requests. Please try again in an hour.'), t)).toBe('errors:ai.rate_limited')
    expect(friendlyAiError(new Error('Story Buddy is unavailable right now.'), t)).toBe('errors:ai.buddy_unavailable')
  })

  it('falls back to a generic translated line, never the raw message', () => {
    expect(friendlyAiError(new Error('API error: 500'), t)).toBe('errors:ai.generic')
    expect(friendlyAiError(undefined, t)).toBe('errors:ai.generic')
  })
})
