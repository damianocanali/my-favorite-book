// Renders an HTML string to a PDF Buffer using headless Chromium on Vercel Functions.
// Input: { html, widthInches, heightInches }
// Output: Buffer (Uint8Array on Vercel runtime)
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

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

export async function renderHtmlToPdf({ html, widthInches = 8.75, heightInches = 8.75 }) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 })
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
