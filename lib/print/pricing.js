const PRICES = {
  hardcover: 3999,
  softcover: 1999,
}

export function unitPriceCents(format) {
  if (!Object.prototype.hasOwnProperty.call(PRICES, format)) {
    throw new Error(`Unknown print format: ${format}`)
  }
  return PRICES[format]
}

export function totalCents({ format, quantity, shippingCents, taxCents = 0 }) {
  return unitPriceCents(format) * quantity + shippingCents + taxCents
}

export function priceIdForFormat(format) {
  if (format === 'hardcover') return process.env.STRIPE_PRICE_HARDCOVER
  if (format === 'softcover') return process.env.STRIPE_PRICE_SOFTCOVER
  throw new Error(`Unknown print format: ${format}`)
}
