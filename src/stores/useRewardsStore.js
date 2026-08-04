import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAvatarStore } from './useAvatarStore'
import { useAuthStore } from './useAuthStore'
import { supabase } from '../lib/supabase'
import { apiFetchAuthed } from '../lib/api'

// Effort-based badges — earned by completing steps, not quality. Coin
// values here are UI hints only; the authoritative amount and the
// idempotent "credit once" behavior live in the /api/claim-badge handler.
const BADGE_DEFINITIONS = [
  { id: 'first_page', emoji: '📝', label: 'First Page', description: 'Wrote your first page', coins: 10 },
  { id: 'first_book', emoji: '📖', label: 'Storyteller', description: 'Finished your first book', coins: 25 },
  { id: 'three_books', emoji: '📚', label: 'Bookworm', description: 'Created 3 books', coins: 30 },
  { id: 'five_books', emoji: '🏆', label: 'Super Author', description: 'Created 5 books', coins: 50 },
  { id: 'ten_books', emoji: '🌟', label: 'Writing Star', description: 'Created 10 books', coins: 100 },
  { id: 'used_voice', emoji: '🎤', label: 'Voice Writer', description: 'Used voice input', coins: 10 },
  { id: 'used_buddy', emoji: '🤖', label: 'AI Friend', description: 'Asked Story Buddy for help', coins: 10 },
  { id: 'added_illustration', emoji: '🎨', label: 'Illustrator', description: 'Generated an illustration', coins: 15 },
  { id: 'submitted_class', emoji: '🏫', label: 'Class Star', description: 'Submitted a book to class', coins: 20 },
  { id: 'five_pages', emoji: '✍️', label: 'Long Story', description: 'Wrote a 5+ page story', coins: 20 },
  { id: 'streak_3', emoji: '🔥', label: 'On a Roll', description: 'Wrote 3 days in a row', coins: 20 },
  { id: 'streak_7', emoji: '⚡', label: 'Week of Wonders', description: 'Wrote 7 days in a row', coins: 50 },
  { id: 'streak_30', emoji: '🌈', label: 'Story Legend', description: 'Wrote 30 days in a row', coins: 150 },
]

export const useRewardsStore = create(
  persist(
    (set, get) => ({
      earnedBadges: [],
      totalPages: 0,
      newBadge: null,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDay: null,

      /** Current streak from the server. iOS has shown this since 2.1. */
      loadStreak: async () => {
        if (!useAuthStore.getState().user) return
        try {
          const res = await apiFetchAuthed('/api/streak')
          if (!res.ok) return
          const data = await res.json().catch(() => null)
          if (!data) return
          set({
            currentStreak: data.currentStreak ?? 0,
            longestStreak: data.longestStreak ?? 0,
          })
        } catch {
          // Offline — keep whatever we last showed.
        }
      },

      /**
       * Tell the server the child wrote today. Debounced to one call per
       * local day, the same rule the iOS app uses, so this is safe to fire
       * on every keystroke. Claims streak badges as thresholds are passed.
       */
      recordWritingActivity: async () => {
        if (!useAuthStore.getState().user) return
        // Local calendar day; /api/streak accepts UTC ±1 day.
        const day = new Date().toLocaleDateString('en-CA')
        if (get().lastStreakDay === day) return
        set({ lastStreakDay: day })
        try {
          const res = await apiFetchAuthed('/api/streak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day }),
          })
          if (!res.ok) throw new Error('streak failed')
          const data = await res.json().catch(() => null)
          const streak = data?.currentStreak ?? 0
          set({ currentStreak: streak, longestStreak: data?.longestStreak ?? 0 })
          for (const [threshold, badgeId] of [[3, 'streak_3'], [7, 'streak_7'], [30, 'streak_30']]) {
            if (streak >= threshold) await get().earnBadge(badgeId)
          }
        } catch {
          // Let a later edit retry today.
          set({ lastStreakDay: null })
        }
      },

      /**
       * Pull the authoritative badge list from Supabase.
       *
       * `earnedBadges` is persisted to localStorage, which makes it
       * per-browser rather than per-account: a badge earned on the iOS app
       * (which reads user_badges directly) never showed up on the web, and
       * clearing site data appeared to wipe them. The row-level policy
       * already restricts this to the caller's own badges.
       */
      loadBadges: async () => {
        if (!supabase || !useAuthStore.getState().user) return
        const { data, error } = await supabase.from('user_badges').select('badge_id')
        if (error || !Array.isArray(data)) return
        const server = data.map((r) => r.badge_id)
        // Union rather than replace: a badge claimed moments ago locally
        // shouldn't blink out if this read raced the write.
        set((state) => ({ earnedBadges: [...new Set([...state.earnedBadges, ...server])] }))
      },

      earnBadge: async (badgeId) => {
        // Only logged-in users can earn badges.
        if (!useAuthStore.getState().user) return false
        const state = get()
        if (state.earnedBadges.includes(badgeId)) return false
        const badge = BADGE_DEFINITIONS.find((b) => b.id === badgeId)
        if (!badge) return false

        try {
          const res = await apiFetchAuthed('/api/claim-badge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badgeId }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) return false

          set({
            earnedBadges: [...state.earnedBadges, badgeId],
            // Only show the popup when the server actually credited — avoids
            // re-popping a badge that was already claimed on another device.
            newBadge: data.alreadyClaimed ? null : badge,
          })

          if (!data.alreadyClaimed && typeof data.balance === 'number') {
            useAvatarStore.setState({ coins: data.balance })
          }
          return !data.alreadyClaimed
        } catch {
          return false
        }
      },

      dismissBadge: () => set({ newBadge: null }),

      incrementPages: () =>
        set((state) => ({ totalPages: state.totalPages + 1 })),

      getBadges: () => {
        const earned = get().earnedBadges
        return BADGE_DEFINITIONS.map((b) => ({
          ...b,
          earned: earned.includes(b.id),
        }))
      },
    }),
    { name: 'my-favorite-book-rewards' }
  )
)

export { BADGE_DEFINITIONS }
