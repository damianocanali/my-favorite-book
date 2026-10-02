// Renders an HTML string to a PDF Buffer using headless Chromium on Vercel Functions.
// Input: { html, widthInches, heightInches }
// Output: Buffer (Uint8Array on Vercel runtime)
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { measurePages, findOverflowingPages, PageOverflowError } from './overflow.js'

let _browser = null

// Request allowlist (review §7 item 19). The print HTML carries URLs from
// book data (illustrations, covers), and Chromium would otherwise fetch ANY
// of them — internal hosts included — while it renders child content. Only
// these are allowed; everything else is aborted and logged (host only):
//   - data: (embedded fonts, QR codes, inline pictures) and about:blank
//   - the Supabase project origin (Storage: public and signed URLs)
//   - our own origins: PUBLIC_BASE_URL, ALLOWED_ORIGINS, the Vercel URL,
//     https://mybooklab.app
//   - PRINT_ALLOWED_ORIGINS (comma-separated), e.g. the host of upscaled
//     images if TOGETHER_UPSCALE_MODEL is ever turned on.
export function printOrigins(env = process.env) {
  const list = [
    env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    env.PUBLIC_BASE_URL,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
    'https://mybooklab.app',
    ...String(env.ALLOWED_ORIGINS || '').split(','),
    ...String(env.PRINT_ALLOWED_ORIGINS || '').split(','),
  ]
  const out = new Set()
  for (const raw of list) {
    try { if (raw && raw.trim()) out.add(new URL(raw.trim()).origin) } catch { /* not a URL */ }
  }
  return out
}

export function isAllowedPrintRequest(url, origins = printOrigins()) {
  const u = String(url || '')
  if (u.startsWith('data:') || u === 'about:blank') return true
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'https:') return false
    return origins.has(parsed.origin)
  } catch {
    return false
  }
}

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
    const origins = printOrigins()
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (request.isInterceptResolutionHandled?.()) return
      const url = request.url()
      if (isAllowedPrintRequest(url, origins)) return request.continue()
      let host = 'invalid-url'
      try { host = new URL(url).host } catch { /* keep placeholder */ }
      console.warn('[pdf-render] blocked request to', host)
      return request.abort('blockedbyclient')
    })
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
