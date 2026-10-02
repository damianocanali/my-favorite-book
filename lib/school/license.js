export const TRIAL_DAYS = 30
export const TRIAL_IMAGES = 300
// Paid licenses get 300 pictures per seat per year (Stage 4, lib/school/pricing.js
// imageAllowanceFor); trials keep 300 in total.
export { IMAGES_PER_SEAT } from './pricing.js'
export const STUDENT_DAILY_IMAGES = 15
export const MAX_SEATS = 35
export const MAX_TRIALS_PER_TEACHER = 3

// Must agree with school_bump_image() (018, redefined in 034).
// pending_payment = an invoice-billed school plan whose invoice is open: it
// is usable until its due date (expires_at), but never printable.
const LIVE = ['trial', 'pending_payment', 'active', 'comped']

export function isLicenseUsable(license, now = new Date()) {
  if (!license) return false
  if (license.status === 'grace') return true
  return LIVE.includes(license.status) && new Date(license.expires_at) > now
}
