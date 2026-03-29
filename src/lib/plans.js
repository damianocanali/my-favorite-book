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
  },
  family: {
    name: 'Family',
    maxBooks: Infinity,
    storyBuddyPerDay: Infinity,
    imagesPerBook: Infinity,
    pdfExport: true,
    classroom: false,
  },
  teacher: {
    name: 'Teacher',
    maxBooks: Infinity,
    storyBuddyPerDay: Infinity,
    imagesPerBook: Infinity,
    pdfExport: true,
    classroom: true,
  },
}

export const PRICES = {
  family: {
    monthly: {
      id: import.meta.env.VITE_STRIPE_PRICE_FAMILY_MONTHLY,
      amount: '$4.99',
      interval: 'month',
    },
    annual: {
      id: import.meta.env.VITE_STRIPE_PRICE_FAMILY_ANNUAL,
      amount: '$39.99',
      interval: 'year',
      monthlyEquivalent: '$3.33/mo',
    },
  },
  teacher: {
    monthly: {
      id: import.meta.env.VITE_STRIPE_PRICE_TEACHER_MONTHLY,
      amount: '$9.99',
      interval: 'month',
    },
    annual: {
      id: import.meta.env.VITE_STRIPE_PRICE_TEACHER_ANNUAL,
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
