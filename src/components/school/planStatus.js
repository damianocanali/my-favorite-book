// The one neutral line an ordinary teacher sees about their class's plan
// (owner feedback round 5): pricing is negotiated with principals, so no
// price, no buy button, no "Plan & billing" — just where the class stands.
// Billing admins (lib/school/billingAdmin.js) still get the full
// PlanBillingSection. Pure so it's unit-testable without a DOM.
import { trialDaysLeft } from './rosterText'
import { isLicenseUsable } from '../../../lib/school/license.js'

/**
 * @param {{status: string, expires_at: string} | null | undefined} license
 * @param {Date} [now]
 * @returns {{ key: 'trial' | 'active_until' | 'ask_school', count?: number, date?: string }}
 *   key is under school:teacher.plan_status.*; `date` is the raw ISO
 *   expires_at for the caller to format.
 */
export function neutralPlanStatus(license, now = new Date()) {
  if (!license) return { key: 'ask_school' }
  if (license.status === 'trial') {
    const days = trialDaysLeft(license, now)
    return days > 0 ? { key: 'trial', count: days } : { key: 'ask_school' }
  }
  // Renewal problems (grace), lapsed or cancelled plans are the school's
  // conversation, not the teacher's — same line as an expired one.
  if (license.status === 'grace') return { key: 'ask_school' }
  if (isLicenseUsable(license, now)) return { key: 'active_until', date: license.expires_at }
  return { key: 'ask_school' }
}
