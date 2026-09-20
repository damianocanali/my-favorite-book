import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { isEligibleForPrompt, shouldOfferBreakpointCheckIn } from '../src/lib/checkIn'

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

// PageEditor's milestone/check-in effect re-runs on every keystroke (the
// page array is a new reference each character), so the guard that decides
// whether to offer a breakpoint check-in has to be pure and pinned on its
// own — rendering the component wouldn't isolate the one thing that matters
// here: does typing WITHIN an already-written page ever offer, versus a
// page genuinely crossing empty→written.
describe('shouldOfferBreakpointCheckIn (the guard PageEditor calls)', () => {
  it('does NOT offer for a keystroke inside an already-written page', () => {
    // writtenCount unchanged (2 -> 2): the child is still typing on a page
    // already counted as written, not finishing a new one.
    expect(shouldOfferBreakpointCheckIn({
      prevWritten: 2,
      writtenCount: 2,
      milestoneFired: false,
      lastPromptedAt: null,
    })).toBe(false)
  })

  it('offers when a page genuinely crosses empty→written', () => {
    expect(shouldOfferBreakpointCheckIn({
      prevWritten: 1,
      writtenCount: 2,
      milestoneFired: false,
      lastPromptedAt: null,
    })).toBe(true)
  })

  it('never offers in the same beat a milestone fired', () => {
    expect(shouldOfferBreakpointCheckIn({
      prevWritten: 1,
      writtenCount: 2,
      milestoneFired: true,
      lastPromptedAt: null,
    })).toBe(false)
  })

  it('still defers to the quiet window even on genuine progress', () => {
    expect(shouldOfferBreakpointCheckIn({
      prevWritten: 1,
      writtenCount: 2,
      milestoneFired: false,
      lastPromptedAt: Date.now(),
    })).toBe(false)
  })
})
