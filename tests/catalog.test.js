// The store prices a child SEES must be the prices the server CHARGES.
//
// The web and iOS stores each list prices for display; lib/catalog.js is what
// /api/spend-coins actually enforces, and it refuses any purchase whose amount
// doesn't match. So a price that drifts between them isn't a cosmetic bug —
// the child taps Buy and gets "Price mismatch". These tests read the prices
// out of the three sources and require them to agree, in both directions.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CATALOG, priceOf } from '../lib/catalog.js'

const webStyles = () => {
  const src = readFileSync('src/pages/AvatarPage.jsx', 'utf8')
  return Object.fromEntries(
    [...src.matchAll(/\{ id: '([a-z]+)', labelKey: 'content:avatar\.art_style\.[a-z]+\.label', emoji: '[^']+', price: (\d+) \}/g)]
      .filter(([, , p]) => Number(p) > 0)
      .map(([, id, p]) => [id, Number(p)])
  )
}
const iosStyles = () => {
  const src = readFileSync('ios-native/MyBookLab/Views/CoinStoreView.swift', 'utf8')
  return Object.fromEntries(
    [...src.matchAll(/\.init\(id: "([a-z]+)",[\s\S]*?price: (\d+)\)/g)].map(([, id, p]) => [id, Number(p)])
  )
}
const iosIcons = () => {
  const src = readFileSync('ios-native/MyBookLab/Views/AppIconPickerView.swift', 'utf8')
  return Object.fromEntries(
    [...src.matchAll(/AppIconOption\(id: "(icon_[a-z]+)",[\s\S]*?price: (\d+),/g)]
      .filter(([, , p]) => Number(p) > 0)
      .map(([, id, p]) => [id, Number(p)])
  )
}

describe('store prices match what the server charges', () => {
  it('reads a non-trivial number of items from each store', () => {
    // A regex that stops matching would make every assertion below vacuous.
    expect(Object.keys(webStyles()).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(iosStyles()).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(iosIcons()).length).toBeGreaterThanOrEqual(5)
  })

  it('web art styles', () => {
    expect(webStyles()).toEqual(CATALOG.style)
  })

  it('iOS art styles', () => {
    expect(iosStyles()).toEqual(CATALOG.style)
  })

  it('iOS app icons', () => {
    expect(iosIcons()).toEqual(CATALOG.item)
  })

  it('priceOf refuses anything not for sale', () => {
    expect(priceOf('style', 'pixar')).toBe(15)
    expect(priceOf('style', 'cartoon')).toBeNull()      // free, never sold
    expect(priceOf('style', 'toString')).toBeNull()     // not a prototype key
    expect(priceOf('weapon', 'x')).toBeNull()
  })
})
