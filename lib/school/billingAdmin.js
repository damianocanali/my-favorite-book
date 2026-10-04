// Who may see plans, prices and purchases in the teacher area (owner
// feedback round 5). Pricing is negotiated with principals, so an ordinary
// teacher sees a neutral status line only; the purchase pages, the class
// "Plan & billing" section and the billing/plan/checkout endpoints are for
//   (a) the owner (OWNER_USER_ID), and
//   (b) users the owner flagged as school billing admins:
//       app_metadata.billing_admin === true, set from /admin
//       (api/admin/billing-admins.js, audit-logged).
// app_metadata is writable only with the service role, so a user can't
// grant this to themselves. Shared by the API (auth from verifyJwt) and the
// web (a supabase user), hence the plain-object argument.

/**
 * @param {{userId?: string|null, appMetadata?: object|null}} who
 * @param {string|undefined|null} ownerId
 * @returns {boolean}
 */
export function isBillingAdmin(who, ownerId) {
  const userId = who?.userId
  if (!userId) return false
  if (ownerId && userId === ownerId) return true
  return who?.appMetadata?.billing_admin === true
}

/** The web's supabase `user` → isBillingAdmin's argument. */
export const billingWho = (user) => ({ userId: user?.id ?? null, appMetadata: user?.app_metadata ?? null })

export const BILLING_ADMIN_REQUIRED = 'billing_admin_required'
