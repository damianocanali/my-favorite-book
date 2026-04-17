// Single source of truth for plan features and pricing.
// Price IDs come from environment variables set in the Vercel dashboard.

import { Capacitor } from '@capacitor/core'
const IS_NATIVE = Capacitor.isNativePlatform()


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
    imagesPerDay: Infinity,
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
    imagesPerDay: Infinity,
    pdfExport: true,
    classroom: true,
    avatarGenerations: Infinity,
    freeAvatarRegen: true,
    freeStyleChange: true,
  },
}

const WEB_PRICES = {
  family: {
    monthly: { amount: '$4.99', interval: 'month' },
    annual:  { amount: '$39.99', interval: 'year', monthlyEquivalent: '$3.33/mo' },
  },
  teacher: {
    monthly: { amount: '$9.99',  interval: 'month' },
    annual:  { amount: '$79.99', interval: 'year', monthlyEquivalent: '$6.67/mo' },
  },
}

const IOS_PRICES = {
  family: {
    monthly: { amount: '$6.99',  interval: 'month' },
    annual:  { amount: '$54.99', interval: 'year', monthlyEquivalent: '$4.58/mo' },
  },
  teacher: {
    monthly: { amount: '$13.99', interval: 'month' },
    annual:  { amount: '$109.99', interval: 'year', monthlyEquivalent: '$9.17/mo' },
  },
}

export const PRICES = IS_NATIVE ? IOS_PRICES : WEB_PRICES

/** Returns the plan object for a given plan key (defaults to 'free'). */
export function getPlan(planKey) {
  return PLANS[planKey] ?? PLANS.free
}
