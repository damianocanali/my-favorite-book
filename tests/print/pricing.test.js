import { describe, it, expect } from 'vitest'
import { unitPriceCents, totalCents } from '../../lib/print/pricing.js'

describe('unitPriceCents', () => {
  it('hardcover is $39.99', () => {
    expect(unitPriceCents('hardcover')).toBe(3999)
  })
  it('softcover is $19.99', () => {
    expect(unitPriceCents('softcover')).toBe(1999)
  })
  it('rejects unknown formats', () => {
    expect(() => unitPriceCents('papyrus')).toThrow(/format/i)
  })
})

describe('totalCents', () => {
  it('quantity multiplies unit price and adds shipping + tax', () => {
    expect(totalCents({ format: 'hardcover', quantity: 2, shippingCents: 499, taxCents: 700 })).toBe(3999 * 2 + 499 + 700)
  })
})
