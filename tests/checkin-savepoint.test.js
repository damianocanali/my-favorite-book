import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// BreakScreen tells a child "Your story is saved" (checkin:response.break_title)
// without CheckInHost, BreakScreen, or anything on that path calling any kind
// of save action. It is true only because useBookStore wraps its state in
// zustand's persist middleware under the key 'my-favorite-book-current' — the
// draft is already sitting in localStorage before a child ever taps "Take a
// break". See the comment at the BreakScreen call site in CheckInHost.jsx.
// This pins that persistence so a change to useBookStore that quietly drops
// it (removing `persist`, renaming the key, switching to sessionStorage)
// fails loudly here instead of turning that copy into a lie told to a child.
//
// zustand persist's default `storage` option reads `window.localStorage`
// (useBookStore never overrides it) — unlike useCheckInStore, which is
// careful to pass `createJSONStorage(() => localStorage)` explicitly because
// `window` does not exist in this suite's node test environment. A real
// browser always has `window`, and `window.localStorage` is the very same
// object the bare `localStorage` global (stubbed in tests/setup.js) stands
// in for here, so stubbing `window` onto `globalThis` for this file
// reproduces a real browser faithfully without changing anything about how
// useBookStore is written.
describe('"your story is saved" is true', () => {
  const hadWindow = 'window' in globalThis

  beforeEach(() => {
    if (!hadWindow) globalThis.window = globalThis
    localStorage.removeItem('my-favorite-book-current')
  })

  afterEach(() => {
    if (!hadWindow) delete globalThis.window
  })

  it('persists the book to localStorage under the key the copy depends on', async () => {
    // Same technique as tests/checkin-store.test.js: if the storage option
    // ever regresses to one that doesn't exist in this environment, persist
    // falls back to a no-op that warns instead of throwing, and the
    // assertions below would otherwise fail silently rather than loudly.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { useBookStore } = await import('../src/stores/useBookStore.js')
    useBookStore.setState({ book: { id: 'book-1', title: 'A Test Story', pages: [] } })

    const raw = localStorage.getItem('my-favorite-book-current')
    expect(raw).not.toBeNull()
    const { state } = JSON.parse(raw)
    expect(state.book).toMatchObject({ id: 'book-1', title: 'A Test Story' })

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('storage is currently unavailable'))
    warn.mockRestore()
  })
})
