import { create } from 'zustand'
import { schoolFetch } from '../lib/schoolApi'
import { hasWorksheetDraft } from '../components/school/worksheetUi'
import { classBadgeCount, readSeenAssignments } from '../components/school/assignmentStudentUi'
import { useBookshelfStore } from './useBookshelfStore'
import { useBookStore } from './useBookStore'
import { useAuthStore } from './useAuthStore'

// The red count on a class account's "Class" tab (TabBar). Two writers:
//
// - MyAssignments (the Class tab's own "From your teacher" section) pushes
//   the count every time its list, seen set or nudge changes — so opening
//   an assignment clears it at once, and its ~60 s poll refreshes it.
// - TabBar calls refresh() on the same 60 s rhythm while the child is on
//   another tab (MyAssignments is not mounted there), reading the same two
//   endpoints and the same per-child seen set.
//
// Nudges dismissed with "Got it" on this device are remembered here so a
// poll racing the PATCH can't bring the +1 straight back.
export const useClassBadgeStore = create((set, get) => ({
  count: 0,
  dismissedNudges: new Set(),
  // The class's check-ins switch (review §7.28), from the same
  // /api/school/assignments read. Unknown → true: the server refuses a
  // check-in for a class that turned them off either way.
  checkinsEnabled: true,

  setClassSettings: (cls) => {
    const on = cls?.checkins_enabled !== false
    if (get().checkinsEnabled !== on) set({ checkinsEnabled: on })
  },

  setCount: (count) => {
    if (get().count !== count) set({ count })
  },

  dismissNudge: (id) => {
    if (!id) return
    const next = new Set(get().dismissedNudges)
    next.add(id)
    set({ dismissedNudges: next })
  },

  // Best-effort: a failed read keeps whatever the badge shows.
  refresh: async () => {
    const userId = useAuthStore.getState().user?.id ?? null
    if (!userId) return
    const res = await schoolFetch('/api/school/assignments')
    if (!res.ok) return
    get().setClassSettings(res.data?.class)
    const n = await schoolFetch('/api/school/nudges')
    const nudge = n.ok ? (n.data?.nudge ?? null) : null
    const books = useBookshelfStore.getState().books ?? []
    const draft = useBookStore.getState().book
    // Same as MyAssignments: a worksheet with answers on this device counts.
    const isStarted = (id) => draft?.assignmentId === id || books.some((b) => b.assignmentId === id) || hasWorksheetDraft(userId, id)
    get().setCount(classBadgeCount(res.data?.assignments ?? [], {
      seen: readSeenAssignments(userId),
      isStarted,
      hasNudge: !!nudge && !get().dismissedNudges.has(nudge.id),
    }))
  },

  reset: () => set({ count: 0, dismissedNudges: new Set(), checkinsEnabled: true }),
}))
