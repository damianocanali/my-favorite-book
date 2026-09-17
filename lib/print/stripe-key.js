// Picks which Stripe secret key to use for print-pipeline endpoints.
//
// Production deployments use STRIPE_SECRET_KEY (live).
// Preview/Development deployments use STRIPE_TEST_SECRET_KEY (test mode) so
// smoke tests don't pollute the live Stripe account. Falls back to the live
// key if the test key isn't set, so behavior is unchanged for any deployment
// that hasn't yet adopted the test key.
//
// Vercel sets VERCEL_ENV automatically:
//   'production' on the production deployment
//   'preview'    on every PR / branch deploy
//   'development' on `vercel dev`
export function getStripeSecretKey() {
  const env = process.env.VERCEL_ENV
  if (env === 'production') return process.env.STRIPE_SECRET_KEY
  return process.env.STRIPE_TEST_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY
}

// The publishable key that PAIRS with getStripeSecretKey().
//
// Native clients can't reproduce the live/test switch above — they only
// know their own build config — and a publishable key from the wrong
// mode makes PaymentSheet fail with "No such payment_intent" against a
// PaymentIntent this server just created. So the server hands the
// matching key back with the client secret and the app uses that.
//
// VITE_STRIPE_PUBLISHABLE_KEY is the last fallback because it already
// exists in every environment for the web bundle.
export function getStripePublishableKey() {
  const env = process.env.VERCEL_ENV
  if (env === 'production') {
    return process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.VITE_STRIPE_PUBLISHABLE_KEY
  }
  return (
    process.env.STRIPE_TEST_PUBLISHABLE_KEY ??
    process.env.STRIPE_PUBLISHABLE_KEY ??
    process.env.VITE_STRIPE_PUBLISHABLE_KEY
  )
}
