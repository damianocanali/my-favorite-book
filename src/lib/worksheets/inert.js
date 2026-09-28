// Review round 1 fix: while the Customize panel is open, the rest of the
// page — everything under #root, a sibling of the panel's own
// document.body portal — must be unreachable by Tab and invisible to
// assistive tech, same requirement as any modal dialog. Rather than
// hand-rolling a Tab/Shift+Tab cycle (enumerate focusable elements, guess
// at which selectors count, keep that list in sync with every field the
// panel ever grows), this marks #root `inert`: the browser itself then
// refuses to focus, click, or announce anything inside it for as long as
// the attribute is present, and CustomizePanel's own fields are the only
// focusable subtree left, which a native Tab order naturally stays inside.
//
// Takes `document` as a parameter (rather than importing the global), same
// reasoning as src/components/school/printMode.js, so it can be exercised
// in a plain Node test with a minimal fake document — see
// tests/worksheets-inert.test.js.
export function enterInertBackground(doc) {
  doc.getElementById('root')?.setAttribute('inert', '')
}

// Idempotent: safe to call even if enter was never called, or was already
// exited (e.g. both an explicit close and the unmount cleanup fire).
export function exitInertBackground(doc) {
  doc.getElementById('root')?.removeAttribute('inert')
}
