// A child filling in a worksheet assignment (spec 2026-10-01 §2), full
// screen: big boxes, the teacher's prompt above each with read-aloud,
// dictation per box, word help (the editor's WritingScaffold), autosave on
// this device, and "Hand in" through the same endpoint as a book. After a
// hand-in: "Turn into book pages" (MyAssignments does the book part).
//
// Answers live only on the device until handed in (no server drafts in
// v1); on another device a hand-in's own answers are the starting point.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, Send, BookPlus, Check } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { celebrateBig } from '../../lib/celebrate'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { WorksheetFillTitle, WorksheetFillBoxes } from './WorksheetFillBody'
import { ANSWER_MAX, ACROSTIC_WORD_MAX, BOOK_PAGES_MAX } from '../../../lib/school/worksheets.js'
import {
  fillLayout, readWorksheetDraft, writeWorksheetDraft, removeWorksheetDraft, answersForSubmit, hasAnswers,
  pagesFor, startingPoint, canHandInWorksheet,
} from './worksheetUi'

/**
 * Props: `assignment` (from GET /api/school/assignments, with worksheet),
 * `userId` (the signed-in child, for the device draft), `books` (their
 * shelf, for "add to one of my books"), `onClose`, `onHandedIn()` (reload
 * the list), `onMakePages({ texts, bookId|null })`.
 */
export default function WorksheetFill(props) {
  // Round 7: a worksheet assignment whose definition didn't come through
  // still opens here — with a note and the way back — never the book editor.
  if (!props.assignment?.worksheet?.templateId) return <WorksheetUnavailable title={props.assignment?.title ?? ''} onClose={props.onClose} />
  return <WorksheetFillView {...props} />
}

function WorksheetUnavailable({ title, onClose }) {
  const { t } = useTranslation()
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] overflow-y-auto bg-galaxy-bg" data-testid="worksheet-unavailable">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold text-galaxy-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('school:worksheet.student.close')}
            className="p-3 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={22} />
          </button>
        </div>
        <p className="font-body text-galaxy-text">{t('school:worksheet.student.unavailable')}</p>
      </div>
    </div>
  )
}

function WorksheetFillView({ assignment, userId, books = [], onClose, onHandedIn, onMakePages }) {
  const { t, i18n } = useTranslation()
  const panelRef = useRef(null)
  const worksheet = assignment.worksheet
  const submission = assignment.my_submission

  // This device's draft, unless the hand-in is newer (then the hand-in is
  // what they last gave the teacher, and what becomes book pages).
  const [answers, setAnswers] = useState(() => {
    const draft = readWorksheetDraft(userId, assignment.id)
    return startingPoint(draft, submission) === 'draft' ? draft.answers : null
  })
  const [loadError, setLoadError] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [handedIn, setHandedIn] = useState(false)
  // Hand in again only once something changed since the last hand-in here.
  const [changedSinceHandIn, setChangedSinceHandIn] = useState(true)
  const [pagesOpen, setPagesOpen] = useState(false)

  // No draft on this device but already handed in: start from the hand-in.
  useEffect(() => {
    if (answers !== null) return
    if (!submission?.id) {
      setAnswers({})
      return
    }
    let live = true
    schoolFetch(`/api/school/submissions?id=${encodeURIComponent(submission.id)}`).then((res) => {
      if (!live) return
      if (res.ok) setAnswers(res.data?.answers ?? {})
      else setLoadError(true)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave every change on this device.
  const update = useCallback((id, text) => {
    setAnswers((prev) => {
      const next = { ...(prev ?? {}), [id]: text.slice(0, id === 'word' ? ACROSTIC_WORD_MAX : ANSWER_MAX) }
      writeWorksheetDraft(userId, assignment.id, next)
      return next
    })
    setError(null)
    setChangedSinceHandIn(true)
  }, [userId, assignment.id])

  // Read-aloud: one voice for the sheet, in the app's language.
  const synth = useSpeechSynthesis()
  const [currentSpoken, setCurrentSpoken] = useState(null)
  const speech = {
    isSupported: synth.isSupported,
    isSpeaking: synth.isSpeaking,
    current: currentSpoken,
    // The teacher's prompts are written in the class's language.
    say: (text) => { setCurrentSpoken(text); synth.speak(text, assignment.class_locale) },
    stop: () => synth.stop(),
  }

  // Dictation: one recognizer, pointed at whichever box's mic was tapped.
  const [dictBox, setDictBox] = useState(null)
  const dictBoxRef = useRef(null)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const recognition = useSpeechRecognition({
    lang: i18n.language,
    onResult: (text) => {
      const id = dictBoxRef.current
      if (!id) return
      const cur = answersRef.current?.[id] ?? ''
      update(id, cur + (cur && !cur.endsWith(' ') ? ' ' : '') + text.trim())
    },
  })
  const dictation = {
    isSupported: recognition.isSupported,
    isListening: recognition.isListening,
    box: dictBox,
    start: (id) => { recognition.stop(); dictBoxRef.current = id; setDictBox(id); recognition.start() },
    stop: () => { recognition.stop(); setDictBox(null) },
  }

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      synth.stop()
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const layout = useMemo(() => fillLayout(worksheet, answers?.word ?? ''), [worksheet, answers?.word])
  const canSubmit = canHandInWorksheet(assignment)
  const ready = answers !== null && hasAnswers(answers) && changedSinceHandIn

  async function handIn() {
    if (!ready || sending) return
    dictation.stop()
    setSending(true)
    setError(null)
    const res = await schoolFetch('/api/school/submit', {
      method: 'POST',
      body: JSON.stringify({ assignmentId: assignment.id, answers: answersForSubmit(worksheet, answers) }),
    })
    setSending(false)
    if (!res.ok) return setError(res.code || 'generic')
    setHandedIn(true)
    setChangedSinceHandIn(false)
    // Handed in: the draft has done its job (the hand-in is the copy now).
    removeWorksheetDraft(userId, assignment.id)
    celebrateBig()
    onHandedIn?.()
  }

  const pageTexts = answers ? pagesFor(worksheet, answersForSubmit(worksheet, answers)) : []
  const canMakePages = (handedIn || !!submission) && pageTexts.length > 0

  return createPortal(
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={assignment.title}
      className="fixed inset-0 z-[70] overflow-y-auto bg-galaxy-bg focus:outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <WorksheetFillTitle templateId={worksheet.templateId} title={assignment.title} prompt={assignment.prompt} speech={speech} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('school:worksheet.student.close')}
            className="p-3 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={22} />
          </button>
        </div>

        {loadError && <p className="text-red-400 font-body text-sm">{t('school:student.hand_in.errors.generic')}</p>}

        {answers === null && !loadError ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : answers !== null && (
          <WorksheetFillBoxes layout={layout} worksheet={worksheet} answers={answers} onChange={update} speech={speech} dictation={dictation} />
        )}

        <p className="text-xs font-body text-galaxy-text-muted flex items-center gap-1"><Check size={12} aria-hidden="true" /> {t('school:worksheet.student.saved_here')}</p>

        {error && (
          <p role="alert" className="text-red-400 font-body text-sm">
            {t(`school:student.hand_in.errors.${error}`, { defaultValue: t('school:student.hand_in.errors.generic') })}
          </p>
        )}

        {handedIn && (
          <div className="rounded-2xl p-4 border border-green-500/30 bg-green-500/10 text-center">
            <p className="font-heading text-lg font-bold text-green-400">{t('school:student.hand_in.success_title')}</p>
            <p className="text-galaxy-text-muted font-body text-sm">{t('school:student.hand_in.success_body')}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pb-8">
          {canSubmit && (
            <button
              type="button"
              onClick={handIn}
              disabled={!ready || sending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-body font-bold text-base text-white btn-fill-primary transition-colors disabled:opacity-50"
            >
              <Send size={18} aria-hidden="true" />
              {sending ? t('school:worksheet.student.handing_in') : t('school:worksheet.student.hand_in')}
            </button>
          )}
          {canMakePages && (
            <button
              type="button"
              onClick={() => setPagesOpen((v) => !v)}
              aria-expanded={pagesOpen}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-body font-semibold text-sm text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50 transition-colors"
            >
              <BookPlus size={18} aria-hidden="true" /> {t('school:worksheet.student.make_pages')}
            </button>
          )}
        </div>

        {pagesOpen && canMakePages && (
          <div className="glass rounded-2xl p-4 border border-galaxy-secondary/30 space-y-3 -mt-4 mb-8">
            <p className="font-heading font-bold text-galaxy-text">{t('school:worksheet.student.make_pages_heading')}</p>
            <p className="font-body text-sm text-galaxy-text-muted">{t('school:worksheet.student.make_pages_hint')}</p>
            <button
              type="button"
              onClick={() => onMakePages({ texts: pageTexts, bookId: null })}
              className="w-full px-4 py-3 rounded-xl font-body font-bold text-white btn-fill-primary"
            >
              {t('school:worksheet.student.make_pages_new')}
            </button>
            {books.length > 0 && (
              <div className="space-y-2">
                <p className="font-body text-sm font-semibold text-galaxy-text-muted">{t('school:worksheet.student.make_pages_append')}</p>
                <ul className="space-y-1">
                  {books.map((b) => {
                    const full = (b.pages?.length ?? 0) >= BOOK_PAGES_MAX
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          disabled={full}
                          onClick={() => onMakePages({ texts: pageTexts, bookId: b.id })}
                          className="w-full text-left px-4 py-2.5 rounded-xl border border-galaxy-text-muted/20 hover:border-galaxy-secondary/50 font-body text-galaxy-text disabled:opacity-50 transition-colors"
                        >
                          {b.title || '—'}
                          {full && <span className="ml-2 text-xs text-galaxy-text-muted">{t('school:worksheet.student.make_pages_full')}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  )
}
