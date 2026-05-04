// HTML builders for the print pipeline.
//
// Lulu's print API expects two distinct PDFs per print job:
//   1. Interior — story pages + closing pages, NO cover. >= 24 pages required
//      by the 8.5x8.5 hardcover/softcover SKUs we ship.
//   2. Cover spread — back cover + spine + front cover as one wide page. The
//      width depends on page count (spine grows with page count).
//
// We produce two separate HTML documents so Puppeteer can render each at its
// own page size. Visual style mirrors src/components/print/PrintableBook.jsx.

import QRCode from 'qrcode'

// Marketing/back-of-book promo. Update here when handles or store ID change.
const APP_INSTAGRAM_HANDLE = '@mybooklab.app'
const APP_STORE_URL = 'https://apps.apple.com/us/app/my-book-lab/id6761641708'
const APP_WEBSITE = 'mybooklab.app'
// Available on (shown subtly on the promo page).
const APP_PLATFORMS = 'iPhone · iPad · Mac'

// Lulu minimum interior page count. Hardcover SKU (CW080CW444MXX) accepts
// >= 24, but the softcover SKU (PB080CW444MXX) requires >= 32. We use the
// stricter floor so the same padded interior works for both formats.
const MIN_INTERIOR_PAGES = 32

const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const baseCss = `
  html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-page {
    page-break-after: always; break-after: page;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  .print-safe { padding: 0.375in; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; }
  .illustration-area { height: 55%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .illustration-area img { width: 100%; height: 100%; object-fit: cover; }
  .text-area { flex: 1; padding: 1.25rem 2rem; display: flex; flex-direction: column; justify-content: space-between; }
  .text-body { font-family: 'Nunito', sans-serif; font-size: 1.4rem; line-height: 1.8; color: #1E293B; white-space: pre-wrap; }
  .page-number { width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.9rem; margin: 0 auto; }
  .title { font-family: 'Fredoka', sans-serif; font-size: 3rem; font-weight: 700; text-align: center; margin: 0 0 0.75rem; }
  .author { font-family: 'Nunito', sans-serif; font-size: 1.25rem; }
  .closing-h { font-family: 'Fredoka', sans-serif; font-weight: 700; }
  .closing-body { font-family: 'Nunito', sans-serif; color: #1E293B; }
  .ruled-line { border-bottom: 1px solid #94A3B8; height: 0.45in; }
`

const interiorPageCss = `
  @page { size: 8.75in 8.75in; margin: 0; }
  ${baseCss}
  .print-page { width: 8.75in; height: 8.75in; }
`

function storyPage(book, page) {
  const accent = book.colors?.accent ?? '#06B6D4'
  const cover = book.colors?.cover ?? '#8B5CF6'
  const illustration = page.illustrationData
    ? `<img src="${escape(page.illustrationData)}" alt="">`
    : `<div style="font-size:5rem;">${escape(book.setting?.emoji ?? '✨')}</div>`
  return `
    <section class="print-page" style="background:white;">
      <div class="print-safe">
        <div class="illustration-area" style="border-bottom: 4px solid ${accent};">${illustration}</div>
        <div class="text-area">
          <p class="text-body">${escape(page.text || ' ')}</p>
          <div class="page-number" style="background:${cover}; color:#fff;">${page.pageNumber}</div>
        </div>
      </div>
    </section>
  `
}

function theEndPage(book) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'
  return `
    <section class="print-page" style="background:linear-gradient(135deg, ${accent}, ${cover}); color:${textColor};">
      <div class="print-safe" style="text-align:center; align-items:center; justify-content:center;">
        <p class="closing-h" style="font-size:4rem; margin-bottom:1.5rem;">The End</p>
        <p style="font-family:'Nunito',sans-serif; font-size:1.5rem; opacity:0.9;">${escape(book.title)}</p>
        <p style="font-family:'Nunito',sans-serif; font-size:1.1rem; opacity:0.75; margin-top:0.5rem;">Written and illustrated by ${escape(book.authorName)}</p>
      </div>
    </section>
  `
}

function aboutAuthorPage(book) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const dateStr = new Date(book.createdAt ?? Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const ageLine = book.authorAge ? `, age ${escape(book.authorAge)}` : ''
  const avatar = book.authorAvatar
    ? `<img src="${escape(book.authorAvatar)}" alt="" style="width:2.5in; height:2.5in; border-radius:50%; object-fit:cover; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />`
    : `<div style="width:2.5in; height:2.5in; border-radius:50%; background:${cover}; color:white; display:flex; align-items:center; justify-content:center; font-size:6rem; margin:0 auto;">${escape(book.characters?.[0]?.emoji ?? '✨')}</div>`
  return `
    <section class="print-page" style="background:white;">
      <div class="print-safe" style="text-align:center; align-items:center; justify-content:center; gap: 1rem;">
        <p class="closing-h" style="font-size:1.75rem; color:${cover};">About the Author</p>
        ${avatar}
        <p class="closing-body" style="font-size:1.5rem; font-weight:700;">${escape(book.authorName)}${ageLine}</p>
        <p class="closing-body" style="font-size:1rem; opacity:0.7;">Created on ${escape(dateStr)}</p>
        <p class="closing-body" style="font-size:0.95rem; opacity:0.6; margin-top:1.5rem; max-width:5in;">
          Every great storyteller starts somewhere. Thank you for sharing your imagination.
        </p>
      </div>
    </section>
  `
}

function promoPage(qrDataUrl) {
  return `
    <section class="print-page" style="background:linear-gradient(135deg, #FFF4E5, #FFE9F5);">
      <div class="print-safe" style="text-align:center; align-items:center; justify-content:center;">
        <p class="closing-h" style="font-size:2rem; color:#8B5CF6; margin-bottom:0.5rem;">Make your own magical book</p>
        <p class="closing-body" style="font-size:1.05rem; opacity:0.8; max-width:5in; margin-bottom:1.75rem;">
          MyBookLab lets kids dream up stories, illustrate them with AI, and order them as real, printed books.
        </p>
        <img src="${qrDataUrl}" alt="QR code" style="width:2in; height:2in; image-rendering: pixelated; background: white; padding: 0.1in; border-radius: 0.15in; box-shadow: 0 4px 16px rgba(0,0,0,0.08);" />
        <p class="closing-body" style="font-size:0.9rem; opacity:0.65; margin-top:1rem;">Scan to download</p>
        <p class="closing-body" style="font-size:0.85rem; opacity:0.6; margin-top:0.25rem; letter-spacing:0.05em;">${APP_PLATFORMS}</p>
        <div style="margin-top:2rem; display:flex; gap:1.5rem; align-items:center; justify-content:center;">
          <p class="closing-body" style="font-size:1rem; font-weight:700; color:#8B5CF6;">${APP_WEBSITE}</p>
          <span style="opacity:0.3;">·</span>
          <p class="closing-body" style="font-size:1rem; font-weight:700; color:#8B5CF6;">${APP_INSTAGRAM_HANDLE}</p>
        </div>
      </div>
    </section>
  `
}

function notesFromReaderPage() {
  // A blank lined page so the gift recipient (grandma, friend, teacher) can
  // write a message to the kid. Repeats as needed to hit Lulu's minimum.
  const lines = Array.from({ length: 8 }, () => '<div class="ruled-line"></div>').join('')
  return `
    <section class="print-page" style="background:white;">
      <div class="print-safe">
        <p class="closing-h" style="font-size:1.5rem; color:#8B5CF6; margin-bottom:1rem; text-align:center;">Notes from your reader</p>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:0.45in; max-width:5in; margin:0 auto;">
          ${lines}
        </div>
      </div>
    </section>
  `
}

// Build the closing-page sequence. Always emits "The End", "About the
// Author", "MyBookLab promo", then enough "Notes from your reader" pages
// to bring the total interior page count to MIN_INTERIOR_PAGES. Pages
// stay even-numbered so the back cover lands on a left page when bound.
function buildClosingPages(book, qrDataUrl, storyPageCount) {
  const fixed = [theEndPage(book), aboutAuthorPage(book), promoPage(qrDataUrl)]
  const requiredTotal = Math.max(MIN_INTERIOR_PAGES, storyPageCount + fixed.length)
  // Round up to even so binding folds cleanly.
  const evenTotal = requiredTotal % 2 === 0 ? requiredTotal : requiredTotal + 1
  const notesPagesNeeded = Math.max(0, evenTotal - storyPageCount - fixed.length)
  const notes = Array.from({ length: notesPagesNeeded }, () => notesFromReaderPage())
  return [...fixed, ...notes]
}

async function makeQrDataUrl() {
  return await QRCode.toDataURL(APP_STORE_URL, {
    margin: 1,
    width: 600,
    color: { dark: '#1E293B', light: '#FFFFFF' },
  })
}

// === Public API ============================================================

// Builds the interior PDF HTML: story pages + closing pages. No cover.
// Returns a Promise because QR generation is async.
export async function buildInteriorHtml(book) {
  const qr = await makeQrDataUrl()
  const story = book.pages.map((p) => storyPage(book, p)).join('\n')
  const closing = buildClosingPages(book, qr, book.pages.length).join('\n')
  return `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
  <style>${interiorPageCss}</style>
</head><body>
  ${story}
  ${closing}
</body></html>`
}

// Builds the cover spread HTML: back cover | spine | front cover as ONE
// wide page. Caller passes EXACT dimensions from Lulu's cover-dimensions API
// (LuluClient.getCoverDimensions) — these are SKU-specific and cannot be
// computed locally because hardcover wraps around boards differently from
// softcover and Lulu validates strictly. Spine width is still passed in
// for the middle column sizing.
export async function buildCoverHtml(book, { widthInches, heightInches, spineWidthInches }) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'

  const heightIn = heightInches
  const widthIn = widthInches
  // Each side panel is whatever's left after the spine, split in half.
  const sidePanelIn = (widthIn - spineWidthInches) / 2

  const frontImg = book.coverImage
    ? `<img src="${escape(book.coverImage)}" alt="" style="width:100%; height:100%; object-fit:cover;" />`
    : `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:9rem;">${escape(book.characters?.[0]?.emoji ?? '📖')}</div>`

  const css = `
    @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .spread {
      width: ${widthIn}in; height: ${heightIn}in;
      display: grid;
      grid-template-columns: ${sidePanelIn}in ${spineWidthInches}in ${sidePanelIn}in;
      box-sizing: border-box;
      background: linear-gradient(135deg, ${cover}, ${accent});
      color: ${textColor};
      font-family: 'Fredoka', 'Nunito', sans-serif;
    }
    .panel { padding: 0.5in; box-sizing: border-box; display: flex; flex-direction: column; }
    .back  { padding-left: 0.625in; }   /* 0.5in safe + 0.125 bleed */
    .front { padding-right: 0.625in; align-items: center; justify-content: space-between; }
    .spine {
      display: flex; align-items: center; justify-content: center;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: 'Fredoka', sans-serif;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.05em;
      padding: 0.25in 0;
    }
    .front-img-frame {
      width: 5.5in; height: 5.5in; border-radius: 0.25in; overflow: hidden;
      box-shadow: 0 0.15in 0.4in rgba(0,0,0,0.25);
      background: white;
    }
    .blurb { font-family: 'Nunito', sans-serif; font-size: 1rem; line-height: 1.6; opacity: 0.92; }
  `

  return `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head><body>
  <div class="spread">
    <div class="panel back" style="justify-content:space-between;">
      <p style="font-family:'Fredoka',sans-serif; font-size:1.5rem; font-weight:700;">${escape(book.title)}</p>
      <p class="blurb">A book by ${escape(book.authorName)}, made with MyBookLab.</p>
      <p style="font-size:0.85rem; opacity:0.7;">${APP_WEBSITE} · ${APP_INSTAGRAM_HANDLE}</p>
    </div>
    <div class="spine">${escape(book.title)} · ${escape(book.authorName)}</div>
    <div class="panel front">
      <div></div>
      <div class="front-img-frame">${frontImg}</div>
      <div style="text-align:center; padding-bottom: 0.3in;">
        <h1 style="font-family:'Fredoka',sans-serif; font-size:2.4rem; font-weight:700; margin: 0 0 0.4rem;">${escape(book.title)}</h1>
        <p style="font-family:'Nunito',sans-serif; font-size:1.1rem; opacity:0.95;">by ${escape(book.authorName)}</p>
      </div>
    </div>
  </div>
</body></html>`
}

// Legacy alias kept for the existing pdf-worker import; routes to the
// interior builder. Will be removed once pdf-worker is updated to call the
// split builders directly.
export const buildPrintHtml = buildInteriorHtml
