import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
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

// The mid-keystroke regression this fixes lived in TWO places a pure-function
// test of shouldOfferBreakpointCheckIn can never reach: which array PageEditor's
// effect depends on, and which guard it calls the offer with. Proof: reverting
// the wiring to the exact broken pattern (bare book?.pages back in the deps,
// a raw isEligibleForPrompt(...) call in place of shouldOfferBreakpointCheckIn)
// left all the tests above green, because they only exercise the guard function
// in isolation with hand-supplied counts — they never touch PageEditor.jsx.
//
// This repo runs pure-function tests under environment: 'node' with no DOM/
// render harness, so a real "mount PageEditor and type a keystroke" test isn't
// available here (adding @testing-library/react is a repo-wide precedent this
// task isn't the place to set). Parsing the source text is a source-level
// stand-in for that render test — same technique tests/badge-parity.test.js
// uses to keep three files honest without executing any of them — and it is a
// stopgap: a real render test, if this repo ever grows one, is the better
// long-term answer.
describe('PageEditor source guards against the mid-keystroke regression', () => {
  const src = readFileSync('src/components/editor/PageEditor.jsx', 'utf8')

  // Isolate the one effect that can call openCheckIn('breakpoint'), from its
  // `useEffect(` opening through its dependency array, so a change to some
  // unrelated effect elsewhere in the file can't accidentally satisfy these
  // assertions.
  const effectMatch = src.match(
    /useEffect\(\(\) => \{[\s\S]*?openCheckIn\('breakpoint'\)[\s\S]*?\}, \[([^\]]*)\]\)/
  )
  const [effectBlock, deps] = effectMatch ?? [null, '']

  it('finds the check-in effect in PageEditor.jsx', () => {
    expect(effectBlock).not.toBeNull()
  })

  it('does not depend on the bare book?.pages array (a new reference every keystroke)', () => {
    // book?.pages?.length is fine and required (next test) — only the bare
    // array reference is what reintroduces the per-keystroke re-run.
    expect(/book\?\.pages(?!\?\.length)\b/.test(deps)).toBe(false)
  })

  it('does depend on book?.pages?.length (page add/remove must stay reactive)', () => {
    expect(deps).toContain('book?.pages?.length')
  })

  it('gates the offer with the written-count guard, not a bare isEligibleForPrompt call', () => {
    expect(effectBlock ?? '').toContain('shouldOfferBreakpointCheckIn(')
    expect(effectBlock ?? '').not.toMatch(/isEligibleForPrompt\(/)
  })
})
