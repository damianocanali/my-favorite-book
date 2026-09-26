export const TRIAL_DAYS = 30
export const TRIAL_IMAGES = 300
export const PAID_IMAGES = 7500
export const STUDENT_DAILY_IMAGES = 15
export const MAX_SEATS = 35
export const MAX_TRIALS_PER_TEACHER = 3

// Must agree with school_bump_image() in 018_schools_core.sql.
const LIVE = ['trial', 'active', 'comped']

export function isLicenseUsable(license, now = new Date()) {
  if (!license) return false
  if (license.status === 'grace') return true
  return LIVE.includes(license.status) && new Date(license.expires_at) > now
}
