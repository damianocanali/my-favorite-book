// Raw English server errors must never reach an Italian child's screen.
import { describe, it, expect } from 'vitest'
import { friendlyAiError } from '../src/lib/aiErrors.js'

const t = (k) => k
const withCode = (code, message = 'whatever the server said') => Object.assign(new Error(message), { code })

describe('friendlyAiError', () => {
  it('maps by code first', () => {
    expect(friendlyAiError(withCode('class_image_limit'), t)).toBe('errors:ai.class_image_limit')
    expect(friendlyAiError(withCode('rate_limited'), t)).toBe('errors:ai.rate_limited')
    expect(friendlyAiError(withCode('scene_unavailable'), t)).toBe('errors:ai.try_again')
    expect(friendlyAiError(withCode('timeout', 'Prompt is too long'), t)).toBe('errors:ai.timeout')
  })

  it('the daily cap says "come back tomorrow", with or without a code', () => {
    const withCodeAndStatus = Object.assign(new Error('x'), { status: 429, code: 'daily_limit' })
    expect(friendlyAiError(withCodeAndStatus, t)).toBe('errors:ai.daily_limit')
    const oldServer = Object.assign(new Error("You've reached today's creation limit — come back tomorrow!"), { status: 429 })
    expect(friendlyAiError(oldServer, t)).toBe('errors:ai.daily_limit')
  })

  it('treats an HTTP 504 without a code as a timeout', () => {
    expect(friendlyAiError(Object.assign(new Error('Image generation took too long. Please try again.'), { status: 504 }), t)).toBe('errors:ai.timeout')
  })

  it('treats an HTTP 429 without a code as rate limited', () => {
    expect(friendlyAiError(Object.assign(new Error('x'), { status: 429 }), t)).toBe('errors:ai.rate_limited')
  })

  it('falls back to known sentences when there is no code', () => {
    expect(friendlyAiError(new Error("You've reached today's creation limit — come back tomorrow!"), t)).toBe('errors:ai.daily_limit')
    expect(friendlyAiError(new Error("That's all the pictures for today. Ask your teacher."), t)).toBe('errors:ai.class_image_limit')
    expect(friendlyAiError(new Error("Let's keep our story kind and friendly — try different words!"), t)).toBe('errors:ai.unkind')
    expect(friendlyAiError(new Error('Too many requests. Please try again in an hour.'), t)).toBe('errors:ai.rate_limited')
    expect(friendlyAiError(new Error('Prompt is too long'), t)).toBe('errors:ai.too_long')
    expect(friendlyAiError(new Error('Story Buddy is unavailable right now.'), t)).toBe('errors:ai.buddy_unavailable')
  })

  it('never reads a timeout as "make it shorter"', () => {
    expect(friendlyAiError(new Error('The request took too long'), t)).toBe('errors:ai.timeout')
    expect(friendlyAiError(new Error('Upstream timed out'), t)).toBe('errors:ai.timeout')
  })

  it('falls back to a generic translated line, never the raw message', () => {
    expect(friendlyAiError(new Error('API error: 500'), t)).toBe('errors:ai.generic')
    expect(friendlyAiError(undefined, t)).toBe('errors:ai.generic')
  })
})
