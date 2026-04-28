// Builds a self-contained HTML document for Puppeteer to render at 8.75"×8.75".
// Visual structure mirrors src/components/print/PrintableBook.jsx exactly.

const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const css = `
  @page { size: 8.75in 8.75in; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-page {
    width: 8.75in; height: 8.75in;
    page-break-after: always; break-after: page;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  .print-safe { padding: 0.375in; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; }
  .cover-img { width: 100%; height: 60%; object-fit: cover; }
  .illustration-area { height: 55%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .illustration-area img { width: 100%; height: 100%; object-fit: cover; }
  .text-area { flex: 1; padding: 1.25rem 2rem; display: flex; flex-direction: column; justify-content: space-between; }
  .text-body { font-family: 'Nunito', sans-serif; font-size: 1.4rem; line-height: 1.8; color: #1E293B; white-space: pre-wrap; }
  .page-number { width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.9rem; margin: 0 auto; }
  .title { font-family: 'Fredoka', sans-serif; font-size: 3rem; font-weight: 700; text-align: center; margin: 0 0 0.75rem; }
  .author { font-family: 'Nunito', sans-serif; font-size: 1.25rem; }
`

function coverPage(book) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'
  const img = book.coverImage
    ? `<img class="cover-img" src="${escape(book.coverImage)}" alt="">`
    : `<div style="font-size:8rem; text-align:center; padding-top:4rem;">${escape(book.characters?.[0]?.emoji ?? '📖')}</div>`
  return `
    <section class="print-page" style="background:linear-gradient(135deg, ${cover}, ${accent});">
      <div class="print-safe" style="color:${textColor};">
        ${img}
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem;">
          <h1 class="title">${escape(book.title)}</h1>
          <p class="author">by ${escape(book.authorName)}</p>
        </div>
      </div>
    </section>
  `
}

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

function backCover(book) {
  const cover = book.colors?.cover ?? '#8B5CF6'
  const accent = book.colors?.accent ?? '#06B6D4'
  const textColor = book.colors?.text ?? '#F1F5F9'
  return `
    <section class="print-page" style="background:linear-gradient(135deg, ${accent}, ${cover}); color:${textColor};">
      <div class="print-safe" style="text-align:center; align-items:center; justify-content:center;">
        <p style="font-family:'Fredoka',sans-serif; font-size:4rem; font-weight:700; margin-bottom:1.5rem;">The End</p>
        <p style="font-family:'Nunito',sans-serif; font-size:1.5rem; opacity:0.85;">${escape(book.title)}</p>
        <p style="font-family:'Nunito',sans-serif; font-size:1.1rem; opacity:0.7; margin-top:0.5rem;">Written and illustrated by ${escape(book.authorName)}</p>
        <p style="font-family:'Nunito',sans-serif; font-size:0.9rem; opacity:0.5; margin-top:3rem;">Created with My Book Lab ✨</p>
      </div>
    </section>
  `
}

export function buildPrintHtml(book) {
  return `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head><body>
  ${coverPage(book)}
  ${book.pages.map((p) => storyPage(book, p)).join('\n')}
  ${backCover(book)}
</body></html>`
}
