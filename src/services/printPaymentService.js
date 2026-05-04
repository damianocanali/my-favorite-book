// src/services/printPaymentService.js
// Single entry point pay({ clientSecret, returnUrl }) that routes to the
// correct Stripe SDK by platform. Returns:
//   { ok: true, paymentIntentId } on success
//   { ok: false, error: string }  on failure
//   { ok: false, canceled: true }  if the user dismissed the sheet
import { Capacitor } from '@capacitor/core'
import { getStripe } from '../lib/stripe.js'

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export async function pay({ clientSecret, returnUrl }) {
  if (!clientSecret) return { ok: false, error: 'Missing clientSecret' }

  if (isNativeIos) return payNativeIos(clientSecret)
  return payWeb(clientSecret, returnUrl)
}

async function payNativeIos(clientSecret) {
  try {
    const { Stripe } = await import('@capacitor-community/stripe')
    await Stripe.createPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'My Book Lab',
      // Card-only for v1 — Apple Pay needs a merchant ID, deferred.
      style: 'alwaysLight',
    })
    const result = await Stripe.presentPaymentSheet()
    if (result?.paymentResult === 'paymentSheetCompleted') {
      return { ok: true, paymentIntentId: extractPiId(clientSecret) }
    }
    if (result?.paymentResult === 'paymentSheetCanceled') {
      return { ok: false, canceled: true }
    }
    return { ok: false, error: 'Payment failed' }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

async function payWeb(clientSecret, returnUrl) {
  try {
    const stripe = await getStripe()
    if (!stripe) return { ok: false, error: 'Stripe not configured' }
    // confirmPayment will redirect the browser to returnUrl on success;
    // execution doesn't continue past it. If it returns, an error occurred.
    const { error } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: { return_url: returnUrl },
    })
    if (error) return { ok: false, error: error.message ?? 'Payment failed' }
    return { ok: true, paymentIntentId: extractPiId(clientSecret) }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

function extractPiId(clientSecret) {
  // pi_3TS..._secret_xyz → pi_3TS...
  return String(clientSecret).split('_secret_')[0]
}
