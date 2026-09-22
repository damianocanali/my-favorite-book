// Single source of truth for plan features and pricing.
// Price IDs come from environment variables set in the Vercel dashboard.
import { formatMoneyCents } from '../i18n/formats.js'


export const PLANS = {
  free: {
    name: 'Free',
    maxBooks: 1,
    storyBuddyPerDay: 3,
    imagesPerDay: 2,
    pdfExport: false,
    classroom: false,
    avatarGenerations: 1,     // first one free, then costs coins
    freeAvatarRegen: false,
    freeStyleChange: false,
  },
  family: {
    name: 'Family',
    maxBooks: Infinity,
    storyBuddyPerDay: Infinity,
    // Cost-protection cap. ~8x normal usage; abuse ceiling ~1500/mo at $0.005/image.
    imagesPerDay: 50,
    pdfExport: true,
    classroom: false,
    avatarGenerations: 5,     // 5 per day free
    freeAvatarRegen: true,
    freeStyleChange: false,   // 5 coins per style change
  },
  teacher: {
    name: 'Teacher',
    maxBooks: Infinity,
    storyBuddyPerDay: Infinity,
    // Cost-protection cap. ~5x normal classroom usage; abuse ceiling ~6000/mo.
    imagesPerDay: 200,
    pdfExport: true,
    classroom: true,
    avatarGenerations: Infinity,
    freeAvatarRegen: true,
    freeStyleChange: true,
  },
}

// Subscriptions are billed in USD by Stripe and by App Store Connect
// regardless of the UI locale — only the *formatting* follows the locale,
// never the currency. Prices used to live here as pre-formatted display
// strings ('$6.99', '$4.58/mo'), which pinned every price in the app to US
// punctuation and symbol placement and glued the "/mo" suffix onto an
// untranslatable string.
export const PLAN_CURRENCY = 'USD'

export const PRICES = {
  family: {
    monthly: { cents: 699,   currency: PLAN_CURRENCY, interval: 'month' },
    annual:  { cents: 5499,  currency: PLAN_CURRENCY, interval: 'year', monthlyEquivalentCents: 458 },
  },
  teacher: {
    monthly: { cents: 1399,  currency: PLAN_CURRENCY, interval: 'month' },
    annual:  { cents: 10999, currency: PLAN_CURRENCY, interval: 'year', monthlyEquivalentCents: 917 },
  },
}

/// Formats a PRICES entry's headline amount for display.
export function formatPlanPrice(price) {
  return formatMoneyCents(price.cents, price.currency)
}

/// Formats an annual entry's per-month equivalent (the bare amount — the
/// "/mo" suffix lives in the translated string that wraps it).
export function formatMonthlyEquivalent(price) {
  return formatMoneyCents(price.monthlyEquivalentCents, price.currency)
}

/** Returns the plan object for a given plan key (defaults to 'free'). */
export function getPlan(planKey) {
  return PLANS[planKey] ?? PLANS.free
}
