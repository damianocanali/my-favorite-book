import { Navigate } from 'react-router-dom'
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
  const isStudent = useIsStudent()
  if (isStudent) return <Navigate to="/bookshelf" replace />
  return children
}
