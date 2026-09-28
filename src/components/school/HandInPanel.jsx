import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2 } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { syncBookToCloud, useBookshelfStore } from '../../stores/useBookshelfStore'
import { celebrateBig } from '../../lib/celebrate'
import Mascot from '../ui/Mascot'
import StudentFeedbackModal from './StudentFeedbackModal'
import { canSubmitTo } from './assignmentStudentUi'

// "Hand in to…" picker for a book that isn't tagged with an assignment yet
// (brief S3 #3's second bullet). Lists every assignment still open to hand
// in to — same canSubmitTo gate as the bookshelf card ("Start writing"
// wouldn't be offered on a closed one either).
function AssignmentPickerModal({ assignments, onPick, onClose }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)

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
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('school:student.hand_in.picker_title')}
        // bg-galaxy-bg-light, not `.glass`: opens over the book preview
        // (dense art/text), which bled through `.glass`'s 8%-white tint —
        // same fix as AssignmentReview's panel (d9afe25) and
        // StudentFeedbackModal's own panel, above.
        className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-3"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:student.hand_in.picker_title')}</h2>
        <p className="text-galaxy-text-muted font-body text-sm -mt-2">{t('school:student.hand_in.picker_hint')}</p>

        {assignments.length === 0 ? (
          <p className="text-galaxy-text-muted font-body text-sm text-center py-6">{t('school:student.hand_in.picker_empty')}</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onPick(a.id)}
                  className="w-full text-left px-4 py-3 glass rounded-xl border border-galaxy-text-muted/10 hover:border-galaxy-secondary/40 transition-colors font-body font-semibold text-galaxy-text"
                >
                  {a.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
        >
          {t('common:actions.cancel')}
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// The Hand-in button + flow on the book preview page (brief S3 #3/#4),
// student accounts only (PreviewPage gates rendering this on useIsStudent).
// Owns the assignments list itself (rather than taking it as a prop) so it
// always reflects the current server state — e.g. right after a hand-in,
// before/after a resubmit — the same reason MyAssignments fetches its own.
export default function HandInPanel({ book }) {
  const { t } = useTranslation()
  const updateBookOnShelf = useBookshelfStore((s) => s.updateBook)

  const [assignments, setAssignments] = useState(null) // null while loading
  const [phase, setPhase] = useState('idle') // idle | syncing | sending
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  async function refresh() {
    const res = await schoolFetch('/api/school/assignments')
    if (res.ok) setAssignments(res.data.assignments ?? [])
  }

  useEffect(() => { refresh() }, [])

  if (assignments === null) return null // quiet while loading, same as MyAssignments

  const tagged = book.assignmentId ? assignments.find((a) => a.id === book.assignmentId) ?? null : null

  async function submitTo(assignmentId) {
    setError(null)
    setSuccess(false)
    setPhase('syncing')
    // "Make sure the latest version is synced" (brief) — reuses the SAME
    // upload addBook/updateBook already fire off, just awaited here so
    // user_books definitely has this version before school/submit reads it.
    await syncBookToCloud(book)
    setPhase('sending')
    const res = await schoolFetch('/api/school/submit', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, bookId: book.id }),
    })
    setPhase('idle')
    if (res.ok) {
      setSuccess(true)
      celebrateBig()
      // An untagged book that was just handed in through the picker is
      // tagged now too, so it reads consistently (state, "Hand in again")
      // next time — same field useBookStore's tagAssignment sets when a
      // book starts life already tagged.
      if (book.assignmentId !== assignmentId) updateBookOnShelf(book.id, { assignmentId })
      await refresh()
    } else {
      setError(res.code || 'generic')
    }
  }

  function handleClick() {
    if (tagged) submitTo(tagged.id)
    else setShowPicker(true)
  }

  const busy = phase !== 'idle'
  const closed = !!tagged && !canSubmitTo(tagged)
  const label = busy
    ? phase === 'syncing' ? t('school:student.hand_in.saving') : t('school:student.hand_in.sending')
    : tagged
      ? tagged.my_submission
        ? t('school:student.assignments.hand_in_again')
        : t('school:student.hand_in.button')
      : t('school:student.hand_in.button_pick')

  return (
    <div className="max-w-md mx-auto mt-6 space-y-3">
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            // bg-galaxy-bg-light, not a translucent green tint: this sits
            // right under the book preview's own cover art (and under the
            // confetti burst), which bled through — same opaque-panel fix
            // as the two modals above, kept a green border for the
            // success cue.
            className="rounded-2xl p-5 text-center bg-galaxy-bg-light border border-green-400/40"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Mascot mood="cheer" size={64} className="mx-auto mb-2" />
            <p className="font-heading text-lg font-bold text-green-400">{t('school:student.hand_in.success_title')}</p>
            <p className="text-galaxy-text-muted font-body text-sm">{t('school:student.hand_in.success_body')}</p>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            type="button"
            onClick={handleClick}
            disabled={busy || closed}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-fill-primary font-heading font-bold text-white transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            {label}
          </motion.button>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-red-400 text-sm font-body text-center">
          {t(`school:student.hand_in.errors.${error}`, { defaultValue: t('school:student.hand_in.errors.generic') })}
        </p>
      )}

      {!success && tagged?.my_submission && (
        <button
          type="button"
          onClick={() => setShowFeedback(true)}
          className="w-full text-center text-sm font-body text-galaxy-text-muted hover:text-galaxy-text transition-colors"
        >
          {t('school:student.assignments.see_feedback')}
        </button>
      )}

      {showPicker && (
        <AssignmentPickerModal
          assignments={assignments.filter(canSubmitTo)}
          onPick={(id) => { setShowPicker(false); submitTo(id) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showFeedback && tagged?.my_submission && (
        <StudentFeedbackModal
          submissionId={tagged.my_submission.id}
          onClose={() => setShowFeedback(false)}
          onSeen={refresh}
        />
      )}
    </div>
  )
}
