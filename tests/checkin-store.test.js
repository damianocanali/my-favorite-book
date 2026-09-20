import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { useAuthStore } from '../src/stores/useAuthStore'

const reset = () => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null })

describe('useCheckInStore', () => {
  beforeEach(reset)

  it('opens at the feeling step', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'feeling', source: 'button' })
  })

  it('advances to the need step, holding the feeling', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('angry')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'need', feeling: 'angry' })
  })

  it('records nothing when dismissed at the feeling step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().dismiss()
    expect(useCheckInStore.getState().entries).toEqual([])
    expect(useCheckInStore.getState().current).toBeNull()
  })

  it('records the feeling alone when dismissed at the need step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().dismiss()
    const { entries } = useCheckInStore.getState()
    expect(entries).toHaveLength(1)
    expect(entries[0].feeling).toBe('sad')
    expect(entries[0].need).toBeUndefined()
  })

  it('records feeling and need when completed', () => {
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('tired')
    useCheckInStore.getState().pickNeed('break')
    const { entries, current } = useCheckInStore.getState()
    expect(entries[0]).toMatchObject({ feeling: 'tired', need: 'break' })
    expect(current).toBeNull()
  })

  it('stamps lastPromptedAt only for an automatic prompt', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().lastPromptedAt).toBeNull()
    reset()
    useCheckInStore.getState().open('breakpoint')
    expect(useCheckInStore.getState().lastPromptedAt).toBeTypeOf('number')
  })

  it('clear() empties entries, lastPromptedAt and current, for sign-out', () => {
    // 'breakpoint' so lastPromptedAt is a real timestamp beforehand —
    // otherwise asserting it's null after clear() wouldn't prove anything.
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('happy')
    useCheckInStore.getState().pickNeed('keep_going')
    useCheckInStore.getState().clear()
    const { entries, lastPromptedAt, current } = useCheckInStore.getState()
    expect(entries).toEqual([])
    expect(lastPromptedAt).toBeNull()
    expect(current).toBeNull()
  })

  it('persists entries and lastPromptedAt to localStorage, excluding current', () => {
    // The persist middleware defaults to `window.localStorage`, which does
    // not exist in this node test environment — if the store's `storage`
    // option ever regresses to that default, persist falls back to a no-op
    // that warns instead of throwing, and every assertion below would fail
    // silently instead of loudly. Spying on console.warn turns that failure
    // mode into a hard test failure rather than a swallowed warning.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('proud')
    useCheckInStore.getState().pickNeed('help')

    const raw = localStorage.getItem('my-favorite-book-checkin')
    expect(raw).not.toBeNull()
    const { state } = JSON.parse(raw)
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]).toMatchObject({ feeling: 'proud', need: 'help' })
    // partialize's whole job is to drop transient UI state from what's
    // written to disk — this is the assertion that actually exercises it.
    expect(state).not.toHaveProperty('current')

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('storage is currently unavailable'))
    warn.mockRestore()
  })
})

describe('sign-out', () => {
  // Without this, the entry the previous describe block's last test leaves
  // in the (module-singleton) store would inflate the length assertion below
  // and fail the test for a reason that has nothing to do with sign-out.
  beforeEach(reset)

  it('clears a child\'s entries so the next user sees none', async () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().pickNeed('break')
    expect(useCheckInStore.getState().entries).toHaveLength(1)

    await useAuthStore.getState().signOut().catch(() => {})
    expect(useCheckInStore.getState().entries).toEqual([])
  })
})
