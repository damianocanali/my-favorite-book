import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { useIsBillingAdmin } from '../../hooks/useIsBillingAdmin'

// The school plan purchase/admin page is for school billing admins only
// (owner feedback round 5 — lib/school/billingAdmin.js). Everyone else goes
// back to their classes. UX only: api/school/plan.js and checkout.js answer
// 403 billing_admin_required regardless.
export default function BillingAdminRoute({ children }) {
  const loading = useAuthStore((s) => s.loading)
  const allowed = useIsBillingAdmin()
  if (loading) return null
  if (!allowed) return <Navigate to="/teacher/classes" replace />
  return children
}
