import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'

// What "take a break" does: says the work is safe, then gets out of the way.
// No timer, no breathing exercise, no task. A child who asked to stop should
// not be handed another thing to do.
//
// A full-screen overlay needs the same modal treatment CheckInSheet has:
// role="dialog" + aria-modal so assistive tech knows this is the whole
// story right now, focus moved onto the panel (and given back on close)
// because aria-modal is a hint, not an enforcement mechanism — it doesn't
// stop Tab from walking into whatever is still mounted underneath — and
// Escape as a keyboard-reachable way out, alongside the "Okay" button.
//
// CheckInHost only mounts this component while `breaking` is true, so
// there's no isOpen prop to key an effect on the way CheckInSheet needs one
// (see its long comment on that) — a single mount-time effect covers the
// whole open/close lifecycle here.

export default function BreakScreen({ onDone }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // Mount-once deliberately: this component's whole lifetime IS "open",
    // so there's nothing to re-run on. onDone wraps a stable zustand/useState
    // setter, so calling whichever closure was captured at mount is always
    // equivalent to calling the current one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('checkin:response.break_title')}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 bg-galaxy-bg px-8 text-center focus:outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Mascot mood="welcome" size={120} />
      <h2 className="font-heading text-2xl font-bold text-galaxy-text">
        {t('checkin:response.break_title')}
      </h2>
      <p className="max-w-sm font-body text-galaxy-text-muted">
        {t('checkin:response.break_body')}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 rounded-full border-2 border-white/30 px-6 py-2.5 font-heading text-sm font-bold text-white/90"
      >
        {t('checkin:response.break_cta')}
      </button>
    </motion.div>,
    document.body
  )
}
