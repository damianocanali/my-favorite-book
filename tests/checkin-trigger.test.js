import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { isEligibleForPrompt } from '../src/lib/checkIn'

describe('breakpoint eligibility', () => {
  beforeEach(() => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null }))

  it('offers once, then stays quiet for the rest of the session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: useCheckInStore.getState().lastPromptedAt })).toBe(true)
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().dismiss()
    expect(isEligibleForPrompt({ lastPromptedAt: useCheckInStore.getState().lastPromptedAt })).toBe(false)
  })

  it('never rate-limits the child-initiated button', () => {
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().dismiss()
    // The button ignores eligibility entirely.
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().current).toMatchObject({ source: 'button' })
  })
})
