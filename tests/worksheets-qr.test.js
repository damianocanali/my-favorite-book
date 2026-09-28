// Pure QR-matrix computation backing the worksheet footer's QR code
// (brief §1). qrcode-generator is a dependency-free MIT library — this
// wraps it in one place, returning plain module coordinates so the React
// component just draws <rect>s (no dangerouslySetInnerHTML anywhere in this
// codebase, and this doesn't start now).
import { describe, it, expect } from 'vitest'
import { computeQrModules } from '../src/lib/worksheets/qr.js'

describe('computeQrModules', () => {
  it('encodes a URL into a square module grid with some dark cells', async () => {
    const { size, cells } = await computeQrModules('https://mybooklab.app/?ref=worksheet-story-map')
    expect(size).toBeGreaterThan(0)
    expect(cells.length).toBeGreaterThan(0)
    for (const [row, col] of cells) {
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(size)
      expect(col).toBeGreaterThanOrEqual(0)
      expect(col).toBeLessThan(size)
    }
  })

  it('is deterministic for the same text', async () => {
    const a = await computeQrModules('https://mybooklab.app/?ref=worksheet-book-report')
    const b = await computeQrModules('https://mybooklab.app/?ref=worksheet-book-report')
    expect(a).toEqual(b)
  })

  it('produces a different pattern for different text', async () => {
    const a = await computeQrModules('https://mybooklab.app/?ref=worksheet-story-map')
    const b = await computeQrModules('https://mybooklab.app/?ref=worksheet-about-author')
    expect(a.cells).not.toEqual(b.cells)
  })
})
