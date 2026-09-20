import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'

// What "I need help" does. A child taps the one tile that says they are
// struggling — that answer should never just make the sheet vanish.
//
// StoryBuddy holds its own open/closed state locally with no external
// handle, so actually opening it from here is a real lift, not a quick
// wire-up. For now: point the child at it by name and location, warmly and
// concretely, with no therapeutic framing — this is a "here's where that
// is" message, not a check-in about how the help made them feel.
//
// Same modal treatment as BreakScreen, which this mirrors: role="dialog" +
// aria-modal, focus moved onto the panel and given back on close, and
// Escape alongside the close button. CheckInHost only mounts this
// component while the child is being shown this message, so — same as
// BreakScreen — there's no isOpen prop to key an effect on; a single
// mount-time effect covers the whole open/close lifecycle.

export default function HelpScreen({ onDone }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('checkin:response.help')}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 bg-galaxy-bg px-8 text-center focus:outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Mascot mood="welcome" size={120} />
      <p className="max-w-sm font-body text-lg text-galaxy-text">
        {t('checkin:response.help')}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 rounded-full border-2 border-white/30 px-6 py-2.5 font-heading text-sm font-bold text-white/90"
      >
        {t('common:actions.close')}
      </button>
    </motion.div>,
    document.body
  )
}
