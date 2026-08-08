import { createPortal } from 'react-dom'

// A full-screen layer, rendered into <body>.
//
// Two hard-won rules are encoded here, both from a bug that shipped twice
// and locked the whole app behind a dark film.
//
// 1. PORTAL OUT. AppShell renders page content inside
//    `<main className="relative z-10">`, which is a stacking context. An
//    overlay rendered inside it is trapped: no z-index, however large,
//    can lift it above the header (z-20) or the tab bar (z-40). The
//    result is a film that darkens the page while the bars stay bright
//    on top of it — exactly the "everything went dark but the app is
//    still there" the user reported. Rendering into <body> escapes it.
//
// 2. NEVER GATE REMOVAL ON AN ANIMATION. A layer that covers the screen
//    and eats pointer events must unmount synchronously with the state
//    that owns it. Wrapping one in <AnimatePresence> with an `exit` prop
//    hands removal to the animation: if that animation is ever
//    interrupted — a suspended tab, a cancelled compositor animation, a
//    bfcache restore — the element stays mounted forever, and no amount
//    of `setOpen(false)` brings it back, because `open` is already false.
//    Fading in is fine; the element is already mounted by then. Fading
//    out is what strands.
//
// Callers keep their entry animation and lose only the fade-out.

export default function ScreenOverlay({ open, children, className = '', ...rest }) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className={className} {...rest}>{children}</div>,
    document.body
  )
}
