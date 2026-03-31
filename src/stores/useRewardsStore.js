import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Effort-based badges — earned by completing steps, not quality
const BADGE_DEFINITIONS = [
  { id: 'first_page', emoji: '📝', label: 'First Page', description: 'Wrote your first page' },
  { id: 'first_book', emoji: '📖', label: 'Storyteller', description: 'Finished your first book' },
  { id: 'three_books', emoji: '📚', label: 'Bookworm', description: 'Created 3 books' },
  { id: 'five_books', emoji: '🏆', label: 'Super Author', description: 'Created 5 books' },
  { id: 'ten_books', emoji: '🌟', label: 'Writing Star', description: 'Created 10 books' },
  { id: 'used_voice', emoji: '🎤', label: 'Voice Writer', description: 'Used voice input' },
  { id: 'used_buddy', emoji: '🤖', label: 'AI Friend', description: 'Asked Story Buddy for help' },
  { id: 'added_illustration', emoji: '🎨', label: 'Illustrator', description: 'Generated an illustration' },
  { id: 'submitted_class', emoji: '🏫', label: 'Class Star', description: 'Submitted a book to class' },
  { id: 'five_pages', emoji: '✍️', label: 'Long Story', description: 'Wrote a 5+ page story' },
]

export const useRewardsStore = create(
  persist(
    (set, get) => ({
      earnedBadges: [],   // array of badge IDs
      totalPages: 0,      // lifetime pages written
      newBadge: null,      // currently showing badge popup

      earnBadge: (badgeId) => {
        const state = get()
        if (state.earnedBadges.includes(badgeId)) return false
        const badge = BADGE_DEFINITIONS.find((b) => b.id === badgeId)
        if (!badge) return false
        set({
          earnedBadges: [...state.earnedBadges, badgeId],
          newBadge: badge,
        })
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
