import { useAuthStore } from '../stores/useAuthStore'
import { isBillingAdmin, billingWho } from '../../lib/school/billingAdmin.js'

/**
 * Whether the signed-in account may see plans, prices and purchases in the
 * teacher area: the owner (VITE_OWNER_USER_ID) or a school billing admin
 * (app_metadata.billing_admin, set from /admin). UX only — the API's
 * requireBillingAdmin is the real fence. app_metadata reaches the browser
 * with the session, so a fresh flag shows after the next token refresh or
 * sign-in; the class page's Plan & billing goes by the server's own
 * `billing_admin` answer instead.
 * @returns {boolean}
 */
export function useIsBillingAdmin() {
  const user = useAuthStore((s) => s.user)
  return isBillingAdmin(billingWho(user), import.meta.env.VITE_OWNER_USER_ID)
}
