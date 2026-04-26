import { describe, it, expect } from 'vitest'
import { spineWidthInches } from '../../lib/print/spine-width.js'

describe('spineWidthInches', () => {
  it('hardcover with 20 pages on 60# paper = 20*0.0025 + 0.06', () => {
    expect(spineWidthInches({ format: 'hardcover', pageCount: 20 })).toBeCloseTo(0.11, 3)
  })
  it('softcover with 20 pages on 60# paper = 20*0.0025', () => {
    expect(spineWidthInches({ format: 'softcover', pageCount: 20 })).toBeCloseTo(0.05, 3)
  })
  it('hardcover with 6 pages on 60# paper', () => {
    expect(spineWidthInches({ format: 'hardcover', pageCount: 6 })).toBeCloseTo(0.075, 3)
  })
  it('rounds to 3 decimals', () => {
    const w = spineWidthInches({ format: 'softcover', pageCount: 13 })
    const decimals = (w.toString().split('.')[1] ?? '').length
    expect(decimals).toBeLessThanOrEqual(3)
  })
})
