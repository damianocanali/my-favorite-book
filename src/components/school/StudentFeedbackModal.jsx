import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, Volume2, VolumeX } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { STICKER_EMOJI } from './assignmentUi'
import { relativeTime } from './relativeTime'

// One feedback comment/sticker, spoken aloud on request (brief S3 #4: "with
// Read it to me"). The sticker itself plays its pop-in animation once, the
// same "big, animated once" the brief asks for — not looped, so it doesn't
// keep tugging at a child's attention after the first look.
function FeedbackItem({ item }) {
  const { t, i18n } = useTranslation()
  const { speak, stop, isSpeaking, isSupported: ttsSupported } = useSpeechSynthesis()
  const [speakingThis, setSpeakingThis] = useState(false)

  function handleListen() {
    if (speakingThis && isSpeaking) {
      stop()
      setSpeakingThis(false)
    } else if (item.comment) {
      setSpeakingThis(true)
      speak(item.comment)
    }
  }

  useEffect(() => {
    if (!isSpeaking) setSpeakingThis(false)
  }, [isSpeaking])

  return (
    <li className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 flex items-start gap-3">
      {item.sticker && (
        <motion.span
          aria-hidden="true"
          // ≥48px per the brief — the sticker is the reward, not a bullet
          // point next to the comment.
          className="text-6xl leading-none shrink-0"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12 }}
        >
          {STICKER_EMOJI[item.sticker]}
        </motion.span>
      )}
      <div className="flex-1 min-w-0">
        {item.comment && <p className="text-galaxy-text font-body">{item.comment}</p>}
        <p className="text-xs text-galaxy-text-muted font-body mt-1">{relativeTime(item.created_at, i18n.language)}</p>
      </div>
      {ttsSupported && item.comment && (
        <button
          type="button"
          onClick={handleListen}
          aria-label={speakingThis && isSpeaking ? t('school:actions.stop_listening') : t('school:actions.listen')}
          className="shrink-0 p-2.5 rounded-xl text-galaxy-secondary hover:bg-white/[0.08] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {speakingThis && isSpeaking ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      )}
    </li>
  )
}

// A student's view of one hand-in's feedback thread (brief S3 #4), opened
// from the assignment card or from the handed-in book on PreviewPage.
// Opening it marks every unseen piece of feedback seen (api/school/
// feedback.js's studentSeen) — the brief's "Opening it marks it seen" — and
// tells the caller via onSeen so it can clear the card's badge without
// waiting on a full assignments re-fetch.
export default function StudentFeedbackModal({ submissionId, onSeen, onClose }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const res = await schoolFetch(`/api/school/submissions?id=${encodeURIComponent(submissionId)}`)
      if (cancelled) return
      if (!res.ok) {
        setError(res.code || 'generic')
        return
      }
      const list = res.data.feedback ?? []
      setFeedback(list)
      // Mark every not-yet-seen item seen. api/school/feedback.js's
      // seen_at=is.null guard keeps the FIRST time it was seen even if this
      // fires more than once (e.g. a re-render), so firing it here rather
      // than tracking "have we already marked these" locally is safe.
      const unseen = list.filter((f) => !f.seen_at)
      if (unseen.length) {
        await Promise.all(unseen.map((f) => schoolFetch('/api/school/feedback', { method: 'POST', body: JSON.stringify({ id: f.id }) })))
        if (!cancelled) onSeen?.()
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('school:student.feedback.heading')}
        // bg-galaxy-bg-light, not `.glass`: this panel opens over the
        // bookshelf's own assignment cards (or the book preview), which
        // bled through `.glass`'s 8%-white tint and read as two screens
        // superimposed — same fix as AssignmentReview's panel (d9afe25).
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:student.feedback.heading')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('school:student.feedback.close_aria')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="text-red-400 text-sm font-body text-center py-6">{t('school:student.hand_in.errors.generic')}</p>
        ) : feedback === null ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedback.length === 0 ? (
          <p className="text-galaxy-text-muted font-body text-sm text-center py-8">{t('school:student.feedback.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {feedback.map((item) => (
              <FeedbackItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
