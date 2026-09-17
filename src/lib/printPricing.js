// src/lib/printPricing.js
// Mirrors the server prices in lib/print/pricing.js. Used for client-side
// total display. Backend is the source of truth at order-create time —
// the totalCents we show is purely informational until /api/print-orders/create
// returns an authoritative number in clientSecret's PaymentIntent.
import { formatMoneyCents } from '../i18n/formats.js'

// Print orders are billed in USD by the print partner regardless of the UI
// locale — only the *formatting* follows the locale, never the currency.
export const PRINT_CURRENCY = 'USD'

export const PRINT_PRICES = {
  hardcover: { cents: 3999, deliveryDays: '7–14' },
  softcover: { cents: 1999, deliveryDays: '5–10' },
}

// Flat US shipping placeholder. Matches FLAT_SHIPPING_CENTS in
// api/print-orders/create.js.
export const FLAT_SHIPPING_CENTS = 499

export function totalCents({ format, quantity }) {
  const price = PRINT_PRICES[format]
  if (!price) throw new Error(`Unknown print format: ${format}`)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error(`Invalid quantity: ${quantity} (must be 1–10)`)
  }
  return price.cents * quantity + FLAT_SHIPPING_CENTS
}

/// Was a hand-built `$${(cents / 100).toFixed(2)}`, which pinned every price
/// in the print flow to US formatting. Intl picks the separator and symbol
/// placement per locale — Italian renders "39,99 USD" rather than "$39.99" —
/// while the amount and the currency stay exactly as the printer bills them.
export function formatPriceCents(cents) {
  return formatMoneyCents(cents, PRINT_CURRENCY)
}

/// 'hardcover' / 'softcover' are enum values that used to leak straight into
/// visible text ("2 × hardcover"). The enum stays the wire value; this maps it
/// to the key that carries its human label.
export function formatLabelKey(format) {
  return PRINT_PRICES[format] ? `print:format.${format}` : 'print:format.unknown'
}
