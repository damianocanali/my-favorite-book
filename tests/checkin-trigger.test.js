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

// The automatic breakpoint trigger was removed from PageEditor entirely: its
// text-change effect has no "page saved" event, so no guard on it — however
// carefully written — can honestly mean "a page just finished" rather than
// "a character just landed". Two proven defects followed from that wrong
// seam (see the comment above the milestone effect in PageEditor.jsx): it
// fired on the FIRST CHARACTER typed into a blank page, stealing focus
// mid-word, and separately could go permanently silent once a milestone id
// was already in the store's `seen` set.
//
// This guard is the regression fence for that removal: a future change that
// reintroduces an automatic offer from THIS effect — the tempting "just add
// the guard back" fix — is exactly what must not happen without hooking a
// different seam (addPage, page navigation, illustration success). Parsing
// the source text is a source-level stand-in for a render test, which this
// repo has no harness for (see tests/badge-parity.test.js for the same
// technique); a real "mount PageEditor and type a keystroke" test, if this
// repo ever grows @testing-library/react, would be the better long-term
// fence.
describe('PageEditor does not offer an automatic breakpoint check-in', () => {
  const src = readFileSync('src/components/editor/PageEditor.jsx', 'utf8')

  it('never calls open(\'breakpoint\') from any effect', () => {
    expect(src).not.toContain('open(\'breakpoint\')')
  })

  it('does not import the check-in store or its trigger guard', () => {
    expect(src).not.toContain('useCheckInStore')
    expect(src).not.toContain('shouldOfferBreakpointCheckIn')
  })

  it('still depends on book?.pages?.length in the milestone effect (page add/remove must stay reactive)', () => {
    const effectMatch = src.match(
      /useEffect\(\(\) => \{[\s\S]*?fireMilestone\(beat\)[\s\S]*?\}, \[([^\]]*)\]\)/
    )
    expect(effectMatch).not.toBeNull()
    expect(effectMatch[1]).toContain('book?.pages?.length')
  })
})
