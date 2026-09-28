// Toggles a "print <thing>" mode: a class on <html> that every scoped rule
// in src/index.css is nested under (so ordinary printing — the book, or
// anything else — is completely unaffected when the class is absent), plus
// an injected `@page` rule forcing US Letter for the duration of the print
// job. Baking `@page` into the stylesheet permanently would be wrong: it
// isn't scoped by which element is visible, so whichever `@page` rule comes
// later in the cascade would win for every print job, including ones this
// mode has nothing to do with — that's exactly why it's injected fresh just
// before printing and removed right after.
//
// Two modes share this one factory: sign-in cards (Task 12) and, as of Task
// WS, printable worksheets (§11) — same html-class-plus-injected-style
// mechanism, different class name / style id / @page CSS, so the two can
// never collide or interfere with each other even if a page somehow entered
// both at once.
//
// Each `enter*`/`exit*` pair takes `document` as a parameter (rather than
// importing the global) so it can be exercised in a plain Node test with a
// minimal fake document — see tests/school-print-mode.test.js (cards) and
// tests/worksheets-print-mode.test.js (worksheets).
function makePrintMode({ printClass, styleId, pageCss }) {
  function enter(doc) {
    doc.documentElement.classList.add(printClass)
    if (doc.getElementById(styleId)) return
    const style = doc.createElement('style')
    style.id = styleId
    style.textContent = pageCss
    doc.head.appendChild(style)
  }

  // Idempotent: safe to call even if enter was never called, or was already
  // exited (e.g. both the `afterprint` handler and the unmount cleanup fire).
  function exit(doc) {
    doc.documentElement.classList.remove(printClass)
    const style = doc.getElementById(styleId)
    if (style) doc.head.removeChild(style)
  }

  return { enter, exit }
}

const cardsMode = makePrintMode({
  printClass: 'print-signin-cards',
  styleId: 'signin-cards-page',
  pageCss: '@page { size: letter; margin: 0.4in; }',
})
export const enterCardsPrintMode = cardsMode.enter
export const exitCardsPrintMode = cardsMode.exit

const worksheetsMode = makePrintMode({
  printClass: 'print-worksheets',
  styleId: 'worksheets-page',
  // Margin 0 — each worksheet sheet is its own fixed 8.5in x 11in box with
  // its own 0.5in inner padding (brief: "US Letter portrait, 0.5in
  // margins"), same "sheet owns its own safe area" approach as the Lulu
  // book's .print-safe rather than relying on the browser's @page margin.
  pageCss: '@page { size: letter; margin: 0; }',
})
export const enterWorksheetsPrintMode = worksheetsMode.enter
export const exitWorksheetsPrintMode = worksheetsMode.exit
