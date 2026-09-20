import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { supabase } from '../src/lib/supabase'
import { useBookshelfStore } from '../src/stores/useBookshelfStore'
import { useAvatarStore } from '../src/stores/useAvatarStore'
import { useRewardsStore } from '../src/stores/useRewardsStore'
import { MAX_AGE_DAYS } from '../src/lib/checkIn'

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

describe('retention enforced on read, not just on write', () => {
  const KEY = 'my-favorite-book-checkin'
  const DAY = 24 * 60 * 60 * 1000

  afterEach(() => {
    localStorage.removeItem(KEY)
    reset()
  })

  it('prunes an already-stale entry on rehydrate', async () => {
    // appendEntry prunes on every write, but an entry that was written
    // weeks ago and never touched since never goes through that path
    // again — it just sits on disk. Seed localStorage directly, as if the
    // app were relaunched days later with this already there, then
    // rehydrate and confirm the stale entry doesn't survive being read.
    const stale = { at: new Date(Date.now() - (MAX_AGE_DAYS + 1) * DAY).toISOString(), feeling: 'sad' }
    localStorage.setItem(KEY, JSON.stringify({
      state: { entries: [stale], lastPromptedAt: null },
      version: 0,
    }))

    await useCheckInStore.persist.rehydrate()

    expect(useCheckInStore.getState().entries).toEqual([])
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

describe('identity-change guard (onAuthStateChange)', () => {
  beforeEach(reset)

  it('clears entries only on an actual id change, not a same-user re-fire', async () => {
    // initialize() reaches into these stores whenever a user is present —
    // real implementations call apiFetchAuthed / supabase.from, which would
    // otherwise turn this into a real network test. Stub them so only the
    // check-in guard itself is under test.
    vi.spyOn(useBookshelfStore.getState(), 'loadCloudBooks').mockResolvedValue()
    vi.spyOn(useAvatarStore.getState(), 'refreshCoins').mockResolvedValue()
    vi.spyOn(useAvatarStore.getState(), 'loadInventory').mockResolvedValue()
    vi.spyOn(useRewardsStore.getState(), 'loadBadges').mockResolvedValue()
    vi.spyOn(useRewardsStore.getState(), 'loadStreak').mockResolvedValue()

    // Simulate an already-signed-in user reloading the page: getSession()
    // resolves with a live session, and we capture the real callback
    // onAuthStateChange registers so we can fire it directly, the way
    // supabase-js really does (including firing INITIAL_SESSION immediately
    // on subscription).
    let handler
    vi.spyOn(supabase.auth, 'getSession')
      .mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((cb) => {
      handler = cb
      return { data: { subscription: { unsubscribe: () => {} } } }
    })

    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().user).toMatchObject({ id: 'user-1' })

    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('happy')
    useCheckInStore.getState().pickNeed('keep_going')
    expect(useCheckInStore.getState().entries).toHaveLength(1)

    // Same user id fired again — the token-refresh and page-reload case.
    // supabase-js fires INITIAL_SESSION immediately on subscription, so
    // without the guard this alone would wipe an already-signed-in user's
    // entries on every reload.
    handler('INITIAL_SESSION', { user: { id: 'user-1' } })
    expect(useCheckInStore.getState().entries).toHaveLength(1)
    handler('TOKEN_REFRESHED', { user: { id: 'user-1' } })
    expect(useCheckInStore.getState().entries).toHaveLength(1)

    // A different user id — the sibling-on-one-family-account case.
    handler('SIGNED_IN', { user: { id: 'user-2' } })
    expect(useCheckInStore.getState().entries).toEqual([])

    // A null user — sign-out observed through the listener rather than
    // the explicit signOut() action — must also clear.
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().pickNeed('break')
    expect(useCheckInStore.getState().entries).toHaveLength(1)
    handler('SIGNED_OUT', null)
    expect(useCheckInStore.getState().entries).toEqual([])

    vi.restoreAllMocks()
    useAuthStore.setState({ user: null, loading: true })
  })
})
