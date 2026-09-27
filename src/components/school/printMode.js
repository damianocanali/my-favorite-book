// Toggles "print sign-in cards" mode: a class on <html> that every
// `.signin-cards` rule in src/index.css is scoped under (so ordinary
// printing — the book, or anything else — is completely unaffected when
// this class is absent), plus an injected `@page` rule forcing US Letter
// for the duration of the print job. `.printable-book`'s own Lulu `@page`
// rule is a separate, unconditioned rule already baked into index.css; a
// later `@page` in the cascade wins for any property it also sets, which is
// exactly why this one is injected fresh just before printing and removed
// right after, rather than living in the stylesheet permanently.
//
// Takes `document` as a parameter (rather than importing the global) so it
// can be exercised in a plain Node test with a minimal fake document — see
// tests/school-print-mode.test.js.
const PRINT_CLASS = 'print-signin-cards'
const STYLE_ID = 'signin-cards-page'
const PAGE_CSS = '@page { size: letter; margin: 0.4in; }'

export function enterCardsPrintMode(doc) {
  doc.documentElement.classList.add(PRINT_CLASS)
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = PAGE_CSS
  doc.head.appendChild(style)
}

// Idempotent: safe to call even if enter was never called, or was already
// exited (e.g. both the `afterprint` handler and the unmount cleanup fire).
export function exitCardsPrintMode(doc) {
  doc.documentElement.classList.remove(PRINT_CLASS)
  const style = doc.getElementById(STYLE_ID)
  if (style) doc.head.removeChild(style)
}
