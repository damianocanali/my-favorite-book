import { describe, it, expect } from 'vitest'
import { PRINT_PRICES, FLAT_SHIPPING_CENTS, totalCents, formatPriceCents } from '../../src/lib/printPricing.js'

describe('PRINT_PRICES', () => {
  it('hardcover is $39.99', () => {
    expect(PRINT_PRICES.hardcover.cents).toBe(3999)
    expect(PRINT_PRICES.hardcover.label).toBe('$39.99')
  })
  it('softcover is $19.99', () => {
    expect(PRINT_PRICES.softcover.cents).toBe(1999)
    expect(PRINT_PRICES.softcover.label).toBe('$19.99')
  })
})

describe('FLAT_SHIPPING_CENTS', () => {
  it('matches the backend flat shipping placeholder of $4.99', () => {
    expect(FLAT_SHIPPING_CENTS).toBe(499)
  })
})

describe('totalCents', () => {
  it('hardcover x 1 + shipping = 4498', () => {
    expect(totalCents({ format: 'hardcover', quantity: 1 })).toBe(4498)
  })
  it('softcover x 2 + shipping = 4497', () => {
    expect(totalCents({ format: 'softcover', quantity: 2 })).toBe(4497)
  })
  it('throws on unknown format', () => {
    expect(() => totalCents({ format: 'parchment', quantity: 1 })).toThrow(/format/i)
  })
  it('throws on quantity below 1', () => {
    expect(() => totalCents({ format: 'hardcover', quantity: 0 })).toThrow(/quantity/i)
  })
  it('throws on quantity above 10', () => {
    expect(() => totalCents({ format: 'hardcover', quantity: 11 })).toThrow(/quantity/i)
  })
})

describe('formatPriceCents', () => {
  it('formats whole-dollar amounts without trailing zeros after decimal point', () => {
    expect(formatPriceCents(0)).toBe('$0.00')
    expect(formatPriceCents(499)).toBe('$4.99')
    expect(formatPriceCents(4498)).toBe('$44.98')
  })
})
