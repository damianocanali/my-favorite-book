// The clipped-page guard (lib/print/overflow.js). Chromium isn't available
// in CI, so the detector is tested on measurement fixtures, and the render
// wiring with a mocked browser that returns them.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findOverflowingPages, PageOverflowError, measurePages } from '../lib/print/overflow.js'

const fits = { scrollHeight: 840, clientHeight: 840, scrollWidth: 840, clientWidth: 840, contentBottom: 700, innerBottom: 782, contentRight: 700, innerRight: 782 }

describe('findOverflowingPages', () => {
  it('flags only the pages whose content doesn\'t fit, 1-based', () => {
    const pages = [
      fits,
      { ...fits, scrollHeight: 900 }, // hidden overflow below the page
      { ...fits, contentBottom: 790 }, // into the bottom padding
      { ...fits, scrollWidth: 900 }, // an unbreakable line
      { ...fits, contentRight: 800 },
      { ...fits, contentBottom: 782.6 }, // sub-pixel: tolerated
    ]
    expect(findOverflowingPages(pages)).toEqual([2, 3, 4, 5])
    expect(findOverflowingPages([fits, fits])).toEqual([])
  })

  it('the error names the pages', () => {
    const e = new PageOverflowError([3, 9])
    expect(e.message).toBe('Text does not fit on page 3, 9')
    expect(e.pages).toEqual([3, 9])
  })
})

const browser = vi.hoisted(() => ({ measures: [], pdf: vi.fn(async () => Buffer.from('%PDF')), evaluate: vi.fn() }))
vi.mock('@sparticuz/chromium', () => ({ default: { args: [], headless: true, executablePath: async () => '/x' } }))
vi.mock('puppeteer-core', () => ({
  default: {
    launch: async () => ({
      isConnected: () => true,
      newPage: async () => ({
        setContent: async () => {},
        emulateMediaType: async () => {},
        evaluate: async (fn, sel) => { browser.evaluate(fn, sel); return browser.measures },
        pdf: browser.pdf,
        close: async () => {},
      }),
    }),
  },
}))

describe('renderHtmlToPdf({checkOverflow})', () => {
  beforeEach(() => { browser.pdf.mockClear(); browser.evaluate.mockClear() })

  it('measures every page with the given selector and refuses before printing', async () => {
    const { renderHtmlToPdf } = await import('../lib/print/pdf-render.js')
    browser.measures = [fits, { ...fits, scrollHeight: 1200 }, fits, { ...fits, contentBottom: 900 }]
    await expect(renderHtmlToPdf({ html: '<x>', checkOverflow: '.page' })).rejects.toMatchObject({ name: 'PageOverflowError', pages: [2, 4] })
    expect(browser.evaluate).toHaveBeenCalledWith(measurePages, '.page')
    expect(browser.pdf).not.toHaveBeenCalled()
  })

  it('prints when every page fits; no check when not asked (the single-book pipeline)', async () => {
    const { renderHtmlToPdf } = await import('../lib/print/pdf-render.js')
    browser.measures = [fits, fits]
    await renderHtmlToPdf({ html: '<x>', checkOverflow: '.page' })
    expect(browser.pdf).toHaveBeenCalledTimes(1)
    browser.evaluate.mockClear()
    await renderHtmlToPdf({ html: '<x>' })
    expect(browser.evaluate).not.toHaveBeenCalled()
  })
})
