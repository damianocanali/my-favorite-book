import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAvatarStore } from './useAvatarStore'
import { useAuthStore } from './useAuthStore'

// Effort-based badges — earned by completing steps, not quality.
// Each badge also awards coins for the avatar shop.
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
      earnedBadges: [],   // array of badge IDs
      totalPages: 0,      // lifetime pages written
      newBadge: null,      // currently showing badge popup

      earnBadge: (badgeId) => {
        // Only logged-in users can earn badges
        if (!useAuthStore.getState().user) return false
        const state = get()
        if (state.earnedBadges.includes(badgeId)) return false
        const badge = BADGE_DEFINITIONS.find((b) => b.id === badgeId)
        if (!badge) return false
        set({
          earnedBadges: [...state.earnedBadges, badgeId],
          newBadge: badge,
        })
        // Award coins for earning the badge
        if (badge.coins) {
          useAvatarStore.getState().addCoins(badge.coins)
        }
        return true
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
