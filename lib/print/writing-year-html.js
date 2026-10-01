// HTML for a child's "My Writing Year" book (spec 2026-10-01 §3), printed
// through the same pipeline as a single book: lib/print/pdf-render.js turns
// each document into a PDF, Lulu gets an interior PDF and a cover spread.
//
// Input: the frozen book from buildChildBook (lib/school/writingYear.js).
// The back matter is in the class language (book.lang); the children's own
// words are printed exactly as written.
import { schoolYearLabel } from '../school/writingYear.js'
import { splitPageText } from '../school/worksheets.js'

// Lulu's softcover 8.5×8.5 floor (same as lib/print/pdf-html.js); the page
// count must also be even.
export const MIN_PAGES = 32
const WORKSHEET_PAGE_CHARS = 900

export const WY_COPY = {
  en: {
    title: 'My Writing Year',
    by: (name) => `by ${name}`,
    about: 'About me',
    about_favorite: 'My favorite thing to write about',
    about_best_sentence: 'My best sentence',
    about_learned: 'What I learned this year',
    teacherNote: 'A note from my teacher',
    contents: 'What’s inside',
    notes: 'My writing notes',
    madeWith: 'Made at school with My Book Lab',
    back: (cls) => `A year of writing in ${cls}.`,
  },
  it: {
    title: 'Il mio anno di scrittura',
    by: (name) => `di ${name}`,
    about: 'Su di me',
    about_favorite: 'Ciò di cui mi piace di più scrivere',
    about_best_sentence: 'La mia frase migliore',
    about_learned: 'Cosa ho imparato quest’anno',
    teacherNote: 'Un messaggio dall’insegnante',
    contents: 'Cosa c’è dentro',
    notes: 'I miei appunti di scrittura',
    madeWith: 'Creato a scuola con My Book Lab',
    back: (cls) => `Un anno di scrittura in ${cls}.`,
  },
}
export const copyFor = (book) => WY_COPY[book?.lang] ?? WY_COPY.en

const escape = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;700&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />'
const INK = '#1E293B'
const ACCENT = '#0E7490'

const css = `
  @page { size: 8.75in 8.75in; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 8.75in; height: 8.75in; box-sizing: border-box; padding: 0.6in; overflow: hidden;
          display: flex; flex-direction: column; page-break-after: always; break-after: page;
          font-family: 'Nunito', sans-serif; color: ${INK}; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .center { align-items: center; justify-content: center; text-align: center; }
  h1, h2, h3 { font-family: 'Fredoka', sans-serif; margin: 0; }
  h1 { font-size: 2.6rem; }
  h2 { font-size: 1.8rem; color: ${ACCENT}; margin-bottom: 0.3in; }
  h3 { font-size: 1.05rem; color: ${ACCENT}; margin: 0.18in 0 0.06in; }
  .body { font-size: 1.25rem; line-height: 1.7; white-space: pre-wrap; }
  .small { font-size: 0.95rem; opacity: 0.75; }
  .art { height: 55%; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 0.15in; margin-bottom: 0.25in; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .avatar { width: 2.4in; height: 2.4in; border-radius: 50%; object-fit: cover; }
  .emoji { font-size: 6rem; line-height: 1; }
  .rule { border-bottom: 1px solid #94A3B8; height: 0.42in; }
  .num { margin-top: auto; text-align: center; font-family: 'Fredoka', sans-serif; font-size: 0.85rem; opacity: 0.6; }
`

const page = (inner, cls = '') => `<section class="page ${cls}">${inner}</section>`

function avatarHtml(book, sizeIn = 2.4) {
  if (book.avatar_url) {
    return `<img class="avatar" style="width:${sizeIn}in; height:${sizeIn}in;" src="${escape(book.avatar_url)}" alt="" />`
  }
  return `<div class="emoji" style="font-size:${(sizeIn * 2.5).toFixed(1)}rem;">${escape(book.avatar_emoji || '✏️')}</div>`
}

function titlePage(book) {
  const c = copyFor(book)
  return page(`
    ${avatarHtml(book)}
    <h1 style="margin-top:0.35in;">${escape(book.cover_title || c.title)}</h1>
    <p class="body" style="margin:0.1in 0 0;">${escape(schoolYearLabel(book.year))}</p>
    <p class="body" style="font-weight:700; margin:0.3in 0 0;">${escape(book.name)}</p>
    <p class="small">${escape(book.class_name)}</p>`, 'center')
}

function contentsPage(book) {
  const c = copyFor(book)
  const rows = book.pieces.map((p, i) => `<p class="body" style="margin:0;">${i + 1}. ${escape(p.title || '—')}</p>`).join('')
  return page(`<h2>${escape(c.contents)}</h2>${rows}`)
}

function bookPieces(piece) {
  return piece.pages.map((p, i) => page(`
    ${i === 0 ? `<h3>${escape(piece.title)}</h3>` : ''}
    ${p.image ? `<div class="art"><img src="${escape(p.image)}" alt="" /></div>` : ''}
    <p class="body" style="margin:0;">${escape(p.text)}</p>`))
}

// Worksheets: each box as its prompt (small, in the accent colour) and the
// child's answer; boxes flow onto as many pages as they need.
function worksheetPieces(piece) {
  const chunks = []
  for (const box of piece.boxes) {
    const parts = splitPageText(box.answer, WORKSHEET_PAGE_CHARS)
    parts.forEach((answer, i) => chunks.push({ prompt: i === 0 ? box.prompt : '', answer }))
  }
  const pages = []
  let cur = []
  let used = 0
  for (const ch of chunks) {
    const cost = ch.answer.length + ch.prompt.length / 2 + 80
    if (cur.length && used + cost > WORKSHEET_PAGE_CHARS) { pages.push(cur); cur = []; used = 0 }
    cur.push(ch)
    used += cost
  }
  if (cur.length) pages.push(cur)
  return pages.map((boxes, i) => page(`
    ${i === 0 ? `<h2>${escape(piece.title)}</h2>` : ''}
    ${boxes.map((b) => `${b.prompt ? `<h3>${escape(b.prompt)}</h3>` : ''}<p class="body" style="margin:0;">${escape(b.answer)}</p>`).join('')}`))
}

function aboutPage(book) {
  const c = copyFor(book)
  const rows = ['about_favorite', 'about_best_sentence', 'about_learned']
    .filter((f) => book.about?.[f])
    .map((f) => `<h3>${escape(c[f])}</h3><p class="body" style="margin:0;">${escape(book.about[f])}</p>`)
  if (!rows.length) return null
  return page(`<div style="display:flex; align-items:center; gap:0.3in;">${avatarHtml(book, 1.2)}<h2 style="margin:0;">${escape(c.about)}</h2></div>${rows.join('')}`)
}

function teacherNotePage(book) {
  if (!book.teacher_note) return null
  const c = copyFor(book)
  return page(`<h2>${escape(c.teacherNote)}</h2><p class="body">${escape(book.teacher_note)}</p>`)
}

function notesPage(book) {
  const c = copyFor(book)
  return page(`<h2>${escape(c.notes)}</h2>${'<div class="rule"></div>'.repeat(12)}`)
}

function madeWithPage(book) {
  const c = copyFor(book)
  return page(`<p class="body">${escape(c.madeWith)}</p><p class="small">mybooklab.app</p>`, 'center')
}

/// The interior: title, contents, every piece in order, About me, the
/// teacher's note, padding to Lulu's floor (even, ≥ 32), and a last page.
/// Returns {html, pageCount}.
export function buildWritingYearInteriorHtml(book) {
  const pages = [titlePage(book), contentsPage(book)]
  for (const piece of book.pieces ?? []) {
    pages.push(...(piece.kind === 'worksheet' ? worksheetPieces(piece) : bookPieces(piece)))
  }
  for (const p of [aboutPage(book), teacherNotePage(book)]) if (p) pages.push(p)
  const last = madeWithPage(book)
  let total = pages.length + 1
  const target = Math.max(MIN_PAGES, total + (total % 2))
  while (total < target) { pages.push(notesPage(book)); total++ }
  pages.push(last)
  const html = `<!doctype html><html lang="${book.lang === 'it' ? 'it' : 'en'}"><head><meta charset="utf-8" />${FONTS}<style>${css}</style></head><body>${pages.join('\n')}</body></html>`
  return { html, pageCount: pages.length }
}

/// The cover spread: back | spine | front as one page, at the exact size
/// Lulu's cover-dimensions API returned (never computed locally).
export function buildWritingYearCoverHtml(book, { widthInches, heightInches, spineWidthInches }) {
  const c = copyFor(book)
  const side = (widthInches - spineWidthInches) / 2
  const title = book.cover_title || c.title
  const coverCss = `
    @page { size: ${widthInches}in ${heightInches}in; margin: 0; }
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .spread { width: ${widthInches}in; height: ${heightInches}in; display: grid;
      grid-template-columns: ${side}in ${spineWidthInches}in ${side}in;
      background: linear-gradient(135deg, #0E7490, #4338CA); color: #F8FAFC; font-family: 'Nunito', sans-serif; }
    .panel { padding: 0.6in; box-sizing: border-box; display: flex; flex-direction: column; }
    .front { align-items: center; justify-content: center; text-align: center; padding-right: 0.725in; }
    .back { justify-content: space-between; padding-left: 0.725in; }
    .spine { display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; transform: rotate(180deg);
      font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.8rem; }
    h1 { font-family: 'Fredoka', sans-serif; font-size: 2.6rem; margin: 0.35in 0 0.1in; }
    .avatar { width: 2.8in; height: 2.8in; border-radius: 50%; object-fit: cover; border: 0.08in solid rgba(255,255,255,0.85); }
    .emoji { font-size: 7rem; line-height: 1; }
  `
  return `<!doctype html><html><head><meta charset="utf-8" />${FONTS}<style>${coverCss}</style></head><body>
  <div class="spread">
    <div class="panel back">
      <p style="font-family:'Fredoka',sans-serif; font-size:1.4rem; font-weight:700;">${escape(c.back(book.class_name))}</p>
      <p style="font-size:0.9rem; opacity:0.8;">${escape(c.madeWith)} · mybooklab.app</p>
    </div>
    <div class="spine">${escape(title)} · ${escape(book.name)}</div>
    <div class="panel front">
      ${avatarHtml(book, 2.8)}
      <h1>${escape(title)}</h1>
      <p style="font-size:1.3rem; margin:0;">${escape(schoolYearLabel(book.year))}</p>
      <p style="font-size:1.5rem; font-weight:700; margin:0.25in 0 0;">${escape(book.name)}</p>
      <p style="font-size:1rem; opacity:0.85; margin:0.05in 0 0;">${escape(book.class_name)}</p>
    </div>
  </div></body></html>`
}
