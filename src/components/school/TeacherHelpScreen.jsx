import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { pollHelpSeen } from '../../lib/schoolShare'
import Mascot from '../ui/Mascot'

const POLL_MS = 20 * 1000

// What tapping "I need a grown-up" shows, once CheckInHost's askForHelp
// call has resolved. Same modal treatment as HelpScreen/BreakScreen: portal,
// role="dialog" + aria-modal, focus moved onto the panel and given back on
// close, Escape alongside the Close button.
//
// `ok`/`id`/`inHours` are exactly askForHelp's resolved shape
// (src/lib/schoolShare.js) — CheckInHost passes it straight through rather
// than this component calling askForHelp itself, so there is exactly one
// place (schoolShare.js) that ever posts a help ask.
//
//   ok: false            → the ask itself failed to send. This is the one
//                           failure a child DOES see (unlike the silent
//                           console.warn everywhere else check-in sharing
//                           can fail) — "I need a grown-up" is urgent enough
//                           that staying quiet about a failed send would
//                           leave a child believing help is coming when it
//                           isn't.
//   ok: true, !inHours    → sent, but outside school hours: no one is
//                           there to see it right now, so no polling either
//                           — polling would just run forever with nothing
//                           to report.
//   ok: true, inHours     → sent and someone may be at school right now.
//                           Polls pollHelpSeen(id) every 20s until the
//                           teacher has seen it, then stops for good.
export default function TeacherHelpScreen({ ok, id, inHours, onDone }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [seen, setSeen] = useState(false)
  const [teacherName, setTeacherName] = useState(null)

  const canPoll = ok && inHours && !!id

  // Polling lifecycle: only while in-hours and not yet seen, stopped on
  // unmount same as any other interval, and stopped for good the moment a
  // poll comes back seen (no point continuing to ask after that).
  useEffect(() => {
    if (!canPoll || seen) return
    const tick = async () => {
      const result = await pollHelpSeen(id)
      if (result.seen) {
        setSeen(true)
        setTeacherName(result.teacherName)
      }
    }
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [canPoll, seen, id])

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

  // The message changes under an already-focused panel exactly once — from
  // "got your message" to "saw your message" — the moment a poll comes back
  // seen. Same reasoning as CheckInSheet's own step-change effect: text
  // changing under an already-focused element is silent to a screen reader
  // unless something tells it to look again, so this re-focuses the panel
  // (re-announcing its updated accessible name) right when that happens.
  useEffect(() => {
    if (!seen) return
    panelRef.current?.focus()
  }, [seen])

  const message = !ok
    ? t('school:teacher_help.failed')
    : !inHours
      ? t('school:teacher_help.out_of_hours')
      : seen
        ? (teacherName
          ? t('school:teacher_help.seen_named', { teacherName })
          : t('school:teacher_help.seen_generic'))
        : t('school:teacher_help.in_hours')

  return createPortal(
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={message}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 bg-galaxy-bg px-8 text-center focus:outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Mascot mood="welcome" size={120} />
      <p className="max-w-sm font-body text-lg text-galaxy-text">
        {message}
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
