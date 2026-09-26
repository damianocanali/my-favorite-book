import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { appendEntry, pruneEntries } from '../lib/checkIn'

// A child's check-ins.
//
// ─────────────────────────────────────────────────────────────────────────
// A CONSUMER (FAMILY) CHECK-IN NEVER LEAVES THE DEVICE FROM HERE. Do not add
// a fetch to this file, do not sync entries, do not surface them to a parent
// dashboard.
//
// For a CLASS (student) account, owner decision D7 does send a copy — but
// from src/lib/schoolShare.js, never from this store, and only after
// telling the child on the check-in sheet that their teacher can see it.
// That split is deliberate: this store stays the one place that is
// unconditionally network-free regardless of account type, so
// tests/checkin-network.test.js can keep discovering and fencing it (and
// everything that imports it) without needing to know which accounts are
// students. schoolShare.js is out of that discovery on purpose — it imports
// neither this store nor lib/checkIn — and is instead pinned by its own
// explicit ALLOWED_SENDERS entry in that test.
//
// That is not squeamishness. Synced without a child's knowledge, this
// becomes a record of how a named child feels over time: sensitive data
// under GDPR, a DPIA trigger, and — the part that actually breaks the
// feature — a reason for the child to stop answering honestly.
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
      // Explicit, not the default (`window.localStorage`): our test
      // environment is node, which has no `window`, only `globalThis`.
      // Bare `localStorage` resolves to `globalThis.localStorage` there and
      // to `window.localStorage` in a real browser, so both work. Don't
      // "simplify" this back to the default — it silently drops persist
      // into its no-op storage-unavailable branch, and partialize below is
      // never even called.
      storage: createJSONStorage(() => localStorage),
      // `current` is transient UI state; persisting it would reopen the sheet
      // on every refresh.
      partialize: (s) => ({ entries: s.entries, lastPromptedAt: s.lastPromptedAt }),
      // appendEntry prunes on every write, but that only enforces retention
      // for entries added THIS session. An entry written weeks ago and never
      // touched since sits in localStorage untouched by that path — it would
      // cross MAX_AGE_DAYS silently and still show up as a star forever,
      // because nothing ever re-checks entries that are only ever read, not
      // written. Pruning again on hydrate closes that gap: every app launch
      // re-applies both retention rules to whatever was actually on disk.
      onRehydrateStorage: () => (s) => {
        if (s) s.entries = pruneEntries(s.entries)
      },
    }
  )
)
