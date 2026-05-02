// src/lib/printPricing.js
// Mirrors the server prices in lib/print/pricing.js. Used for client-side
// total display. Backend is the source of truth at order-create time —
// the totalCents we show is purely informational until /api/print-orders/create
// returns an authoritative number in clientSecret's PaymentIntent.

export const PRINT_PRICES = {
  hardcover: { cents: 3999, label: '$39.99', deliveryDays: '7–14' },
  softcover: { cents: 1999, label: '$19.99', deliveryDays: '5–10' },
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

export function formatPriceCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}
