import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { appendEntry } from '../lib/checkIn'

// A child's check-ins.
//
// ─────────────────────────────────────────────────────────────────────────
// THESE ENTRIES NEVER LEAVE THE DEVICE. Do not add a fetch here, do not sync
// them, do not surface them to a parent or teacher dashboard.
//
// That is not squeamishness. Synced, this becomes a record of how a named
// child feels over time: sensitive data under GDPR, a DPIA trigger, and —
// the part that actually breaks the feature — a reason for the child to stop
// answering honestly. tests/checkin-network.test.js enforces it.
// ─────────────────────────────────────────────────────────────────────────
//
// Unlike useMilestoneStore this IS persisted: a milestone is a moment, but a
// pattern the child can look back on only exists if it is kept.

export const useCheckInStore = create(
  persist(
    (set, get) => ({
      current: null,        // { step: 'feeling' | 'need', feeling?, source }
      entries: [],
      lastPromptedAt: null, // automatic prompts only; the button ignores it

      /// `source` is 'button' (child asked) or 'breakpoint' (app offered).
      open: (source = 'button') =>
        set({
          current: { step: 'feeling', source },
          ...(source === 'breakpoint' ? { lastPromptedAt: Date.now() } : {}),
        }),

      pickFeeling: (feeling) =>
        set((s) => (s.current ? { current: { ...s.current, step: 'need', feeling } } : {})),

      /// Completing the flow records feeling + need and closes.
      pickNeed: (need) =>
        set((s) => {
          const feeling = s.current?.feeling
          if (!feeling) return { current: null }
          return { entries: appendEntry(s.entries, { feeling, need }), current: null }
        }),

      /// Closing early is always allowed. A feeling already chosen is kept —
      /// the child told us something — but nothing is invented.
      dismiss: () =>
        set((s) => {
          const feeling = s.current?.feeling
          return {
            current: null,
            ...(feeling ? { entries: appendEntry(s.entries, { feeling }) } : {}),
          }
        }),

      clear: () => set({ entries: [], current: null, lastPromptedAt: null }),
    }),
    {
      name: 'my-favorite-book-checkin',
      // `current` is transient UI state; persisting it would reopen the sheet
      // on every refresh.
      partialize: (s) => ({ entries: s.entries, lastPromptedAt: s.lastPromptedAt }),
    }
  )
)
