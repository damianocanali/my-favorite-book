// Owner-only gate for the print order feature. Returns true when the
// current user is the app owner (matches VITE_OWNER_USER_ID).
//
// This is an interim guard while production environment configuration
// (live Lulu credentials, live Stripe products, VITE_STRIPE_PUBLISHABLE_KEY
// = pk_live) is being completed. Until those are in place, exposing the
// print order UI to real users would mean: real Stripe charge → sandbox
// Lulu submission → no book ships → frustrated parent. Owner-gating ships
// the code without that risk.
//
// Once production env is ready, replace this hook with a real feature
// flag (e.g. user_metadata.print_orders_enabled) or remove the gate entirely.
import { useAuthStore } from '../stores/useAuthStore'

const OWNER_ID = import.meta.env.VITE_OWNER_USER_ID

export function usePrintEnabled() {
  const user = useAuthStore((s) => s.user)
  return Boolean(user && OWNER_ID && user.id === OWNER_ID)
}
