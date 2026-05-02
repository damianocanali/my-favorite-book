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
