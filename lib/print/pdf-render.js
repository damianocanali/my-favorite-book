// Renders an HTML string to a PDF Buffer using headless Chromium on Vercel Functions.
// Input: { html, widthInches, heightInches }
// Output: Buffer (Uint8Array on Vercel runtime)
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { measurePages, findOverflowingPages, PageOverflowError } from './overflow.js'

let _browser = null

async function getBrowser() {
  if (_browser?.isConnected?.()) return _browser
  _browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1100, height: 1100 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })
  return _browser
}

// `checkOverflow`: a CSS selector for the document's pages. When given,
// every page is measured after layout and a page whose content doesn't fit
// throws PageOverflowError (with the page numbers) instead of producing a
// clipped PDF. The existing single-book pipeline doesn't pass it.
export async function renderHtmlToPdf({ html, widthInches = 8.75, heightInches = 8.75, checkOverflow = null }) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 })
    if (checkOverflow) {
      await page.emulateMediaType('print')
      const pages = findOverflowingPages(await page.evaluate(measurePages, checkOverflow))
      if (pages.length) throw new PageOverflowError(pages)
    }
    return await page.pdf({
      width: `${widthInches}in`,
      height: `${heightInches}in`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  } finally {
    await page.close()
  }
}
