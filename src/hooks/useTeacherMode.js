import { useAuthStore, selectIsTeacher } from '../stores/useAuthStore'
import { useIsStudent } from './useIsStudent'
import { getViewMode, computeTeacherMode } from '../lib/viewMode'

/**
 * Whether the signed-in account should see the teacher home (dashboard,
 * Dashboard/Classes/Account nav) instead of the consumer "Create a book"
 * one. Thin wrapper over computeTeacherMode (see src/lib/viewMode.js) so
 * every caller — AppShell, the "/" redirect, TabBar — reads the same
 * combination of "is this account a teacher", "did they switch to family
 * view" and "is auth still loading" the same way.
 *
 * Callers that need to tell "false because not a teacher" apart from
 * "unknown because auth is still loading" (AppShell's chrome pick,
 * HomeRoute's redirect — neither may flash the wrong one) must also read
 * useAuthStore's own `loading` directly and gate on it themselves; this
 * hook folding `loading` into one boolean is right for every OTHER caller,
 * which only ever wants a plain "show the teacher nav or not".
 *
 * Reads localStorage directly rather than holding this in a store: the
 * Account page's view toggle navigates right after writing its flag, and
 * every caller of this
 * hook (AppShell, the home-route wrapper) already re-renders on route
 * change via useLocation, so there is no missed update to guard against.
 * @returns {boolean}
 */
export function useTeacherMode() {
  const isTeacher = useAuthStore(selectIsTeacher)
  const isStudent = useIsStudent()
  const loading = useAuthStore((s) => s.loading)
  const viewMode = getViewMode()
  return computeTeacherMode({ isTeacher, viewMode, isStudent, loading })
}
