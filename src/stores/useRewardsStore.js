import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAvatarStore } from './useAvatarStore'
import { useAuthStore } from './useAuthStore'
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
]

export const useRewardsStore = create(
  persist(
    (set, get) => ({
      earnedBadges: [],
      totalPages: 0,
      newBadge: null,

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
