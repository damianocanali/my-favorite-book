// Single source of truth for plan features and pricing.
// Price IDs come from environment variables set in the Vercel dashboard.

export const PLANS = {
  free: {
    name: 'Free',
    maxBooks: 2,
    storyBuddyPerDay: 3,
    imagesPerBook: 2,
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
    imagesPerBook: Infinity,
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
    imagesPerBook: Infinity,
    pdfExport: true,
    classroom: true,
    avatarGenerations: Infinity,
    freeAvatarRegen: true,
    freeStyleChange: true,
  },
}

export const PRICES = {
  family: {
    monthly: {
      amount: '$4.99',
      interval: 'month',
    },
    annual: {
      amount: '$39.99',
      interval: 'year',
      monthlyEquivalent: '$3.33/mo',
    },
  },
  teacher: {
    monthly: {
      amount: '$9.99',
      interval: 'month',
    },
    annual: {
      amount: '$79.99',
      interval: 'year',
      monthlyEquivalent: '$6.67/mo',
    },
  },
}

/** Returns the plan object for a given plan key (defaults to 'free'). */
export function getPlan(planKey) {
  return PLANS[planKey] ?? PLANS.free
}
