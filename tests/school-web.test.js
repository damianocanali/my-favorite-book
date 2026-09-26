// Web-side pieces of student sign-in (Task 10) that are testable outside a
// DOM: the auth-store plumbing, the roster fetch's error mapping, and i18n
// coverage for the picture aria-labels. ClassSignInPage/NameTiles/PicturePad
// are exercised by hand (simulator/browser) and by `npx vite build` — this
// suite runs in vitest's `node` environment, with no DOM.
import { describe, it, expect, vi } from 'vitest'
import { PICTURE_IDS } from '../lib/school/pictures.js'

// `app_metadata` is only ever set server-side (see api/_school.js's
// `isStudent`); `user_metadata` is user-writable and must never gate
// anything — mirrors the same rule enforced server-side.
//
// `onAuthStateChange` is a bare `vi.fn()` rather than a no-op: the
// shared-device tests below need to grab the callback the store actually
// registers (via `.mock.calls`) and fire it by hand to simulate an
// identity change, the same way the listener would in a real browser.
// `from` is a minimal chainable stub — just enough for
// useAvatarStore.loadInventory / useRewardsStore.loadBadges (both fired,
// unawaited, from the listener whenever it lands on a real user) to
// resolve to "nothing found" instead of throwing on `supabase.from` being
// undefined.
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve) => resolve({ data: null, error: null }),
      }),
    }),
  },
}))

import { supabase } from '../src/lib/supabase'
import { useAuthStore, selectIsStudent } from '../src/stores/useAuthStore'
import { useBookshelfStore } from '../src/stores/useBookshelfStore'
import { usePrintOrderStore } from '../src/stores/usePrintOrderStore'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { fetchRoster } from '../src/lib/schoolApi.js'
import enSchool from '../src/i18n/locales/en/school.json'
import itSchool from '../src/i18n/locales/it/school.json'

// Every listener test below hits this same "some other student's data is
// still on screen" scenario. Fetch is stubbed to a blanket non-ok response
// so the listener's fire-and-forget loadCloudBooks/refreshCoins/loadStreak
// calls (real network calls in the app) all take their early-return path
// instead of trying to reach a server.
function stubNetwork() {
  globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 }))
}

function seedOtherUsersLocalData() {
  useBookshelfStore.setState({ books: [{ id: 'their-book' }], deletedBookIds: ['their-deleted-id'] })
  usePrintOrderStore.getState().setShipping({ email: 'previous-person@example.com' })
}

describe('selectIsStudent', () => {
  it('is true when app_metadata.role is student', () => {
    expect(selectIsStudent({ user: { app_metadata: { role: 'student' } } })).toBe(true)
  })

  it('is false for user_metadata.role — that field is client-writable and must never gate access', () => {
    expect(selectIsStudent({ user: { user_metadata: { role: 'student' } } })).toBe(false)
  })

  it('is false with no user at all', () => {
    expect(selectIsStudent({ user: null })).toBe(false)
  })
})

describe('signInAsStudent', () => {
  it('sets the Supabase session from both tokens', async () => {
    await useAuthStore.getState().signInAsStudent({ access_token: 'access-1', refresh_token: 'refresh-1' })
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'access-1', refresh_token: 'refresh-1' })
  })

  it('throws when Supabase rejects the session', async () => {
    supabase.auth.setSession.mockResolvedValueOnce({ data: {}, error: new Error('invalid refresh token') })
    await expect(
      useAuthStore.getState().signInAsStudent({ access_token: 'bad', refresh_token: 'bad' })
    ).rejects.toThrow('invalid refresh token')
  })

  // Shared-device leak: a parent (or another child) can still be signed in
  // when a child picks up the same device to sign into class. Without this,
  // setSession's own onAuthStateChange picking up the switch is the ONLY
  // thing that clears the outgoing person's books/print-order data — and it
  // fires asynchronously, so there's a window where the new student's
  // /bookshelf renders someone else's books.
  it('signs the previous user out — books cleared, print order reset — before setSession, when someone is already signed in', async () => {
    useAuthStore.setState({ user: { id: 'parent-1' } })
    seedOtherUsersLocalData()

    const callOrder = []
    supabase.auth.signOut.mockImplementationOnce(async () => {
      callOrder.push('signOut')
      return { error: null }
    })
    supabase.auth.setSession.mockImplementationOnce(async () => {
      callOrder.push('setSession')
      return { data: {}, error: null }
    })

    await useAuthStore.getState().signInAsStudent({ access_token: 'a', refresh_token: 'r' })

    expect(callOrder).toEqual(['signOut', 'setSession'])
    expect(useBookshelfStore.getState().books).toEqual([])
    expect(useBookshelfStore.getState().deletedBookIds).toEqual([])
    expect(usePrintOrderStore.getState().shipping.email).toBe('')
  })

  it('skips signOut when no one is currently signed in', async () => {
    useAuthStore.setState({ user: null })
    supabase.auth.signOut.mockClear()

    await useAuthStore.getState().signInAsStudent({ access_token: 'a2', refresh_token: 'r2' })

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })
})

describe('onAuthStateChange listener — shared-device cleanup', () => {
  it('does NOT run the full reset on signed-out → signed-in (a visitor\'s local drafts must survive an ordinary login)', async () => {
    stubNetwork()
    useAuthStore.setState({ user: null })
    await useAuthStore.getState().initialize()
    const onAuthChange = supabase.auth.onAuthStateChange.mock.calls.at(-1)[0]

    useBookshelfStore.setState({ books: [{ id: 'visitor-draft' }], deletedBookIds: [] })
    useCheckInStore.getState().open('button') // something for the "still clears" assertion below to bite on

    onAuthChange('SIGNED_IN', { user: { id: 'student-A' } })

    // Today's behaviour, unchanged: check-in always clears on any identity
    // change, but a visitor's books are not part of that — only a full
    // reset (a real user → someone else) touches them.
    expect(useBookshelfStore.getState().books).toEqual([{ id: 'visitor-draft' }])
    expect(useCheckInStore.getState().current).toBeNull()
  })

  it('runs the full local reset switching from one real signed-in user to a different one', async () => {
    stubNetwork()
    useAuthStore.setState({ user: null })
    await useAuthStore.getState().initialize()
    const onAuthChange = supabase.auth.onAuthStateChange.mock.calls.at(-1)[0]

    // Land on student A first (signed-out → signed-in — no full reset, per
    // the test above), then seed what "student A's session" left behind.
    onAuthChange('SIGNED_IN', { user: { id: 'student-A' } })
    seedOtherUsersLocalData()

    // Switch straight to student B — the shared-device path this fix is
    // for: no explicit sign-out in between, just a new session landing.
    onAuthChange('SIGNED_IN', { user: { id: 'student-B' } })

    expect(useBookshelfStore.getState().books).toEqual([])
    expect(useBookshelfStore.getState().deletedBookIds).toEqual([])
    expect(usePrintOrderStore.getState().shipping.email).toBe('')
  })
})

describe('fetchRoster', () => {
  it('maps a 423 class_resting response to {ok:false, code}', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Class not available', code: 'class_resting' }), { status: 423 })
    )
    const result = await fetchRoster('ABC234')
    expect(result).toMatchObject({ ok: false, code: 'class_resting' })
  })

  it('maps a 200 response to {ok:true, data}', async () => {
    const data = { classroom: { id: 'c1', name: 'Room 5', locale: 'en' }, students: [] }
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }))
    const result = await fetchRoster('ABC234')
    expect(result).toMatchObject({ ok: true, data })
  })
})

describe('school picture translations', () => {
  it('has an EN and IT aria-label for every picture id, for screen readers', () => {
    for (const id of PICTURE_IDS) {
      expect(enSchool.pictures?.[id], `en missing pictures.${id}`).toBeTypeOf('string')
      expect(itSchool.pictures?.[id], `it missing pictures.${id}`).toBeTypeOf('string')
    }
  })
})
