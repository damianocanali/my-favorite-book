// Lazy Stripe.js singleton for the web payment path. The bundle is heavy
// (~150 KB), so we defer loading until the order screen calls getStripe().
import { loadStripe } from '@stripe/stripe-js'

let _stripePromise = null

export function getStripe() {
  if (!_stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('[stripe] VITE_STRIPE_PUBLISHABLE_KEY not set')
      return Promise.resolve(null)
    }
    _stripePromise = loadStripe(key)
  }
  return _stripePromise
}
