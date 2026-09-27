import { useAuthStore, selectIsTeacher } from '../stores/useAuthStore'
import { useIsStudent } from './useIsStudent'
import { getViewMode, computeTeacherMode } from '../lib/viewMode'

/**
 * Whether the signed-in account should see the teacher home (dashboard,
 * Dashboard/Classes/Account nav) instead of the consumer "Create a book"
 * one. Thin wrapper over computeTeacherMode (see src/lib/viewMode.js) so
 * every caller — AppShell, the "/" redirect, TabBar — reads the same
 * combination of "is this account a teacher" and "did they switch to
 * family view" the same way.
 *
 * Reads localStorage directly rather than holding viewMode in a store: the
 * Account page's toggle (setViewMode + navigate) always changes the route,
 * and every caller of this hook (AppShell, the home-route wrapper) already
 * re-renders on route change via useLocation, so there is no missed update
 * to guard against.
 * @returns {boolean}
 */
export function useTeacherMode() {
  const isTeacher = useAuthStore(selectIsTeacher)
  const isStudent = useIsStudent()
  const viewMode = getViewMode()
  return computeTeacherMode({ isTeacher, viewMode, isStudent })
}
