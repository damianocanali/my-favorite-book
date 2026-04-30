// Single source of truth for plan features and pricing.
// Price IDs come from environment variables set in the Vercel dashboard.


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

export const PRICES = {
  family: {
    monthly: { amount: '$6.99',  interval: 'month' },
    annual:  { amount: '$54.99', interval: 'year', monthlyEquivalent: '$4.58/mo' },
  },
  teacher: {
    monthly: { amount: '$13.99', interval: 'month' },
    annual:  { amount: '$109.99', interval: 'year', monthlyEquivalent: '$9.17/mo' },
  },
}

/** Returns the plan object for a given plan key (defaults to 'free'). */
export function getPlan(planKey) {
  return PLANS[planKey] ?? PLANS.free
}
