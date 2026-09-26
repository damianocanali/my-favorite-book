import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { useIsStudent } from '../../hooks/useIsStudent'

// Wraps a route a class (student) account must never reach: pricing, the
// print/purchase flow, and the teacher console. `useIsStudent()` defers to
// `app_metadata.role` — the one trusted marker, never `user_metadata` — so
// this can't be talked out of redirecting by anything a signed-in student
// could edit about their own account.
//
// This is UX, not the real fence: every one of these features is (or must
// be) blocked server-side regardless of what this component does. A signed-
// out visitor or a consumer account passes straight through unaffected.
export default function ConsumerOnlyRoute({ children }) {
  const loading = useAuthStore((s) => s.loading)
  const isStudent = useIsStudent()

  // Same loading guard, and the same spinner, as ProtectedRoute: `user` (and
  // therefore `app_metadata.role`) isn't known yet while auth is still
  // hydrating, so useIsStudent() would read a false negative here and let a
  // student's browser render this consumer-only page for a frame before the
  // redirect catches up on the next render. Waiting for auth to settle means
  // a student never sees even a flash of it.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isStudent) return <Navigate to="/bookshelf" replace />
  return children
}
