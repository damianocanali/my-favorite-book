import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useBookshelfStore, setBookshelfUserId } from './useBookshelfStore'
import { useBookStore } from './useBookStore'
import { useAvatarStore } from './useAvatarStore'
import { useRewardsStore } from './useRewardsStore'
import { useCheckInStore } from './useCheckInStore'
import { usePrintOrderStore } from './usePrintOrderStore'
import { clearClassDeviceSkip } from '../lib/classDevice'
import { Capacitor } from '@capacitor/core'

// getSession() should be near-instant — it reads the stored session and
// only triggers a background refresh if it's near expiry — but a broken
// storage shim, a browser extension eating fetch, or Supabase itself
// wedged on a bad refresh must never leave AppShell/HomeRoute's `loading`
// gate (Task D2 fix round) spinning forever. This is a last-resort escape
// hatch, not the expected path: initialize()'s own try/catch/finally
// already clears `loading` the moment getSession settles, one way or the
// other, and cancels this timer — it only ever fires if that somehow
// doesn't happen.
const INIT_SAFETY_TIMEOUT_MS = 8000

// The local-only, per-person state that must never survive a change of
// WHO is signed in on this device: a child's books, their in-progress
// draft, their check-in entries, and a parent's shipping address. Shared
// by signOut() and the onAuthStateChange listener below so the two can't
// drift — the leak this fixes (student B seeing student A's books, or a
// child seeing a parent's shipping address) happened specifically because
// the listener used to run only a subset of this.
function clearLocalUserData() {
  // "Not in <class>?" was for the person who just left: the next one on a
  // class browser starts on the class list again.
  clearClassDeviceSkip()
  // zustand/persist would otherwise leave the previous person's books and
  // in-progress book sitting in localStorage, so the next person on this
  // device would see them.
  useBookshelfStore.setState({ books: [], deletedBookIds: [] })
  useBookStore.getState().resetBook()
  // Feelings are per-child and never leave the device.
  useCheckInStore.getState().clear()
  // The print-order form persists a full shipping address — name, street,
  // city, postcode, email and phone. That is the most identifying thing
  // the app keeps in localStorage, and this is a shared/family device by
  // assumption, so it must not outlive the person who entered it.
  usePrintOrderStore.getState().reset()
}

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  initialize: async () => {
    if (!supabase) { set({ loading: false }); return }

    // See INIT_SAFETY_TIMEOUT_MS's own comment: this is the fallback, not
    // the expected path. Cleared in `finally` below the moment the real
    // getSession() call settles.
    const safetyTimer = setTimeout(() => {
      console.warn('useAuthStore.initialize: getSession did not settle within', INIT_SAFETY_TIMEOUT_MS, 'ms — forcing loading false')
      set({ loading: false })
    }, INIT_SAFETY_TIMEOUT_MS)

    let user = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      user = session?.user ?? null
    } catch (e) {
      // A broken session (corrupted storage, a rejected refresh, Supabase
      // itself erroring) must never leave `loading` stuck true — that
      // would hang AppShell/HomeRoute's chrome-decision spinner forever.
      // Treating it as signed-out is the safe default: every protected
      // route already re-checks the real session server-side regardless
      // of what this store believes client-side.
      console.warn('useAuthStore.initialize: getSession failed, treating as signed-out', e)
    } finally {
      clearTimeout(safetyTimer)
      set({ user, loading: false })
    }

    if (user) {
      setBookshelfUserId(user.id)
      useBookshelfStore.getState().loadCloudBooks(user.id)
      useAvatarStore.getState().refreshCoins()
      useAvatarStore.getState().loadInventory()
      useRewardsStore.getState().loadBadges()
      useRewardsStore.getState().loadStreak()
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      const previousId = get().user?.id ?? null
      const newId = newUser?.id ?? null
      // Guarded on an actual id change so a background token refresh for
      // the same user doesn't wipe today's data.
      if (newId !== previousId) {
        if (previousId) {
          // Switching identity AWAY from a real signed-in user — to a
          // different account, or to signed-out — via any path other than
          // this store's own signOut() (which already does this locally):
          // another tab signing out, a session expiring, or a student
          // sign-in that bypasses the email/password signOut() call. That
          // person's local-only data must not leak to whoever uses this
          // browser next, same as an explicit sign-out.
          clearLocalUserData()
        } else {
          // Signed-out → signed-in (an ordinary login). A visitor's local
          // drafts made before they had an account are expected to survive
          // into their own first session, so only check-in entries — always
          // per-child regardless — are cleared here, not the full reset.
          useCheckInStore.getState().clear()
        }
      }
      set({ user: newUser })
      setBookshelfUserId(newUser?.id ?? null)
      if (newUser) {
        useBookshelfStore.getState().loadCloudBooks(newUser.id)
        useAvatarStore.getState().refreshCoins()
        useAvatarStore.getState().loadInventory()
        useRewardsStore.getState().loadBadges()
        useRewardsStore.getState().loadStreak()
      }
    })
  },

  signUp: async (email, password, metadata = {}) => {
    if (!supabase) throw new Error('Auth not configured')
    const redirectTo = Capacitor.isNativePlatform()
      ? 'com.myfavoritebook.app://auth/callback'
      : `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: redirectTo },
    })
    if (error) throw error

    // Supabase deliberately returns 200 with NO email sent when the address
    // is already registered — it refuses to confirm whether an account
    // exists (user-enumeration defence), logging `user_repeated_signup`
    // server-side. The only tell in the response is an empty `identities`
    // array. Without checking it we told people to go looking for a
    // confirmation email that was never sent.
    const identities = data?.user?.identities
    if (Array.isArray(identities) && identities.length === 0) {
      return { status: 'already_registered', data }
    }
    // A session means confirmations are off and they're signed in already;
    // otherwise a confirmation email really is on its way.
    return { status: data?.session ? 'active' : 'confirm_email', data }
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setBookshelfUserId(null)
    clearLocalUserData()
    set({ user: null })
  },

  updateDisplayName: async (newName) => {
    if (!supabase) throw new Error('Auth not configured')
    const trimmed = (newName ?? '').trim()
    if (trimmed.length === 0) throw new Error('Name cannot be empty')
    if (trimmed.length > 60) throw new Error('Name must be 60 characters or less')
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    })
    if (error) throw error
    // Push the freshly-updated user back into the store immediately;
    // onAuthStateChange would also fire, but doing it inline keeps the
    // UI snappy.
    set({ user: data.user })
    return data.user
  },

  // Marks a signed-in, non-student account as a class owner so
  // selectIsTeacher grants it the Classroom link/console from then on.
  // Called once from TeacherPage — an existing class owner who reached
  // /teacher directly still has to type the URL every time otherwise —
  // and from AccountPage's "Use My Book Lab in my classroom" card. Mirrors
  // updateDisplayName's shape: throws on failure so callers decide how to
  // handle it (both call sites treat this as best-effort and swallow the
  // error rather than blocking navigation on it).
  markClassroomOwner: async () => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.updateUser({
      data: { classroom: true },
    })
    if (error) throw error
    set({ user: data.user })
    return data.user
  },

  // Student sign-in (Task 10) never touches email/password — api/school/
  // sign-in.js already checked the picture secret server-side and handed
  // back a ready-made session. setSession's own onAuthStateChange fires
  // from this, which the listener wired up in initialize() picks up
  // exactly like any other sign-in.
  //
  // Devices are shared at school, and often at home too: a parent might be
  // signed in when a child picks up the same tablet to sign into class, or
  // one child's session might still be live when the next child sits down.
  // Signing out FIRST — not just relying on the listener's identity-change
  // guard — means the outgoing person's books/draft/check-ins/shipping
  // address are gone from this device before the new session even lands,
  // rather than for however long setSession's async onAuthStateChange
  // takes to fire.
  signInAsStudent: async ({ access_token, refresh_token }) => {
    if (!supabase) throw new Error('Auth not configured')
    if (get().user) await get().signOut()
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
  },

  signInWithProvider: async (provider) => {
    if (!supabase) throw new Error('Auth not configured')
    const native = Capacitor.isNativePlatform()
    const redirectTo = native
      ? 'com.myfavoritebook.app://auth/callback'
      : `${window.location.origin}/auth/callback`

    // On native we open the OAuth flow inside @capacitor/browser so the
    // Capacitor WebView never navigates away from the app. The provider
    // redirects to the custom URL scheme, which Capacitor's App plugin
    // catches via the appUrlOpen listener wired up in src/capacitor.js
    // (it calls supabase.auth.exchangeCodeForSession).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: native },
    })
    if (error) throw error
    if (native && data?.url) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url, presentationStyle: 'popover' })
    }
    return data
  },
}))

// Selector helpers
export const selectDisplayName = (s) => {
  const m = s.user?.user_metadata
  // Prefer the user's own display_name (set via email signup or the
  // account page editor). OAuth providers (Google in particular) send
  // `full_name` or `name`; fall back through those before we resort to
  // the email-prefix slug, which usually looks like a username.
  return m?.display_name
    || m?.full_name
    || m?.name
    || s.user?.email?.split('@')[0]
    || null
}

export const selectRole = (s) =>
  s.user?.user_metadata?.role ?? null

// `app_metadata` is set only by trusted server code (mirrors api/_school.js's
// own `isStudent`) — a signed-in student can never write it themselves,
// unlike `user_metadata` above, which is exactly why selectRole must never
// be used to gate a class account.
export const selectIsStudent = (s) => s.user?.app_metadata?.role === 'student'

// Whether this account should see the Classroom link/console: signed in,
// not a student, and either the email sign-up "teacher" choice or having
// reached /teacher as an existing class owner (TeacherPage/AccountPage call
// markClassroomOwner the first time that happens — see above). UI-only,
// same caveat as selectRole above: `user_metadata` is user-writable, so
// this can decide whether a link is shown but never whether a request
// succeeds — every server endpoint that matters (creating/renaming a
// class, adding students, …) re-checks real class ownership itself
// (requireClassOwner in api/_school.js).
export const selectIsTeacher = (s) =>
  Boolean(s.user) &&
  !selectIsStudent(s) &&
  (s.user?.user_metadata?.role === 'teacher' || s.user?.user_metadata?.classroom === true)
