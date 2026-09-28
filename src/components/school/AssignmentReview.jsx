import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import HandInChip from './HandInChip'
import { STICKER_EMOJI } from './assignmentUi'
import BookPreview from '../book/BookPreview'

const STICKERS = ['star', 'rocket', 'heart', 'wow', 'keep_going', 'rainbow']
const COMMENT_MAX = 500

// A teacher's per-student feedback on ONE hand-in: sticker + comment, sent
// via api/school/feedback.js, plus the thread of feedback already sent on
// it. Split out of AssignmentReview only for readability — it owns no
// portal/focus-trap of its own, it's rendered inline in the drawer's detail
// pane.
function FeedbackPanel({ classId, submissionId, feedback, onSent, locale }) {
  const { t } = useTranslation()
  const [sticker, setSticker] = useState(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function handleSend() {
    if (!comment.trim() && !sticker) return setError(t('school:teacher.assignments.feedback.need_content'))
    setSending(true)
    setError(null)
    const res = await schoolFetch('/api/school/feedback', {
      method: 'POST',
      body: JSON.stringify({ classId, submissionId, comment: comment.trim() || undefined, sticker: sticker ?? undefined }),
    })
    setSending(false)
    if (res.ok) {
      onSent(res.data.feedback)
      setComment('')
      setSticker(null)
    } else {
      setError(teacherErrorText(t, res.code || 'generic'))
    }
  }

  return (
    <div className="space-y-3 border-t border-galaxy-text-muted/10 pt-4">
      <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:teacher.assignments.feedback.heading')}</h3>

      <div role="radiogroup" aria-label={t('school:teacher.assignments.feedback.sticker_label')} className="flex flex-wrap gap-2">
        {STICKERS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={sticker === id}
            aria-label={t(`school:teacher.assignments.feedback.sticker.${id}`)}
            onClick={() => setSticker((prev) => (prev === id ? null : id))}
            className={`text-2xl w-11 h-11 flex items-center justify-center rounded-xl border transition-colors ${
              sticker === id ? 'bg-galaxy-secondary/30 border-galaxy-secondary' : 'border-galaxy-text-muted/20 hover:border-galaxy-secondary/40'
            }`}
          >
            <span aria-hidden="true">{STICKER_EMOJI[id]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label htmlFor="feedback-comment" className="sr-only">{t('school:teacher.assignments.feedback.comment_label')}</label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={COMMENT_MAX}
          rows={2}
          placeholder={t('school:teacher.assignments.feedback.comment_placeholder')}
          className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body resize-none"
        />
        <p className="text-right text-xs font-body text-galaxy-text-muted">{comment.length}/{COMMENT_MAX}</p>
      </div>

      {error && <p className="text-red-400 text-sm font-body">{error}</p>}

      <button
        type="button"
        disabled={sending}
        onClick={handleSend}
        className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-60"
      >
        {sending ? t('school:teacher.assignments.feedback.sending') : t('school:teacher.assignments.feedback.send')}
      </button>

      {feedback.length > 0 && (
        <ul className="space-y-2 pt-2">
          {feedback.map((f) => (
            <li key={f.id} className="flex items-start gap-2 text-sm font-body">
              {f.sticker && <span aria-hidden="true" className="text-lg">{STICKER_EMOJI[f.sticker]}</span>}
              <div className="flex-1 min-w-0">
                {f.comment && <p className="text-galaxy-text">{f.comment}</p>}
                <p className="text-xs text-galaxy-text-muted">
                  {relativeTime(f.created_at, locale)} ·{' '}
                  {f.seen_at ? t('school:teacher.assignments.feedback.seen') : t('school:teacher.assignments.feedback.not_seen')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One student's row in the review list: name/avatar, hand-in chip, when,
// version and feedback count. Not-started rows aren't clickable — there's
// no book to open yet.
function StudentRow({ row, onOpen }) {
  const { t } = useTranslation()
  const clickable = row.status === 'handed_in'
  const content = (
    <>
      <span aria-hidden="true" className="text-xl shrink-0">{row.avatar_emoji ?? '🙂'}</span>
      <div className="min-w-0 flex-1">
        <p className="font-body font-semibold text-galaxy-text truncate">{row.display_name}</p>
        {row.submitted_at && (
          <p className="text-xs font-body text-galaxy-text-muted">
            {t('school:teacher.assignments.review.handed_in_at', { when: relativeTime(row.submitted_at) })}
            {row.version > 1 && <> · {t('school:teacher.assignments.review.version', { count: row.version })}</>}
          </p>
        )}
      </div>
      {row.feedback_count > 0 && (
        <span className="text-xs font-body text-galaxy-text-muted shrink-0">
          {t('school:teacher.assignments.review.feedback_count', { count: row.feedback_count })}
        </span>
      )}
      <HandInChip row={row} className="shrink-0" />
    </>
  )
  return clickable ? (
    <button
      type="button"
      onClick={() => onOpen(row)}
      aria-label={t('school:teacher.assignments.review.open_aria', { name: row.display_name })}
      className="w-full flex items-center gap-3 glass rounded-xl p-3 border border-galaxy-text-muted/10 hover:border-galaxy-secondary/40 transition-colors text-left"
    >
      {content}
    </button>
  ) : (
    <div className="w-full flex items-center gap-3 glass rounded-xl p-3 border border-galaxy-text-muted/10 opacity-70">
      {content}
    </div>
  )
}

// The drawer opened from an assignment row on the class page, or deep-linked
// from the dashboard's assignment column (see TeacherClassPage's `?review=`
// handling). Loads the roster-wide list, then a single submission's full
// snapshot + feedback thread on demand when a handed-in row is opened.
export default function AssignmentReview({ classId, assignmentId, onClose }) {
  const { t, i18n } = useTranslation()
  const panelRef = useRef(null)

  const [assignment, setAssignment] = useState(null)
  const [rows, setRows] = useState(null)
  const [listError, setListError] = useState(null)

  const [openIndex, setOpenIndex] = useState(null) // index into handedIn
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const loadList = useCallback(async () => {
    setListError(null)
    const res = await schoolFetch(
      `/api/school/submissions?classId=${encodeURIComponent(classId)}&assignmentId=${encodeURIComponent(assignmentId)}`
    )
    if (res.ok) {
      setAssignment(res.data.assignment)
      setRows(res.data.submissions ?? [])
    } else {
      setListError(res.code || 'generic')
    }
  }, [classId, assignmentId])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handedIn = (rows ?? []).filter((r) => r.status === 'handed_in')

  const loadDetail = useCallback(async (submissionId) => {
    setDetailLoading(true)
    setDetailError(null)
    const res = await schoolFetch(`/api/school/submissions?classId=${encodeURIComponent(classId)}&id=${encodeURIComponent(submissionId)}`)
    setDetailLoading(false)
    if (res.ok) setDetail(res.data)
    else setDetailError(res.code || 'generic')
  }, [classId])

  function openAt(index) {
    setOpenIndex(index)
    setDetail(null)
    loadDetail(handedIn[index].id)
  }

  function openRow(row) {
    openAt(handedIn.findIndex((r) => r.id === row.id))
  }

  function backToList() {
    setOpenIndex(null)
    setDetail(null)
    setDetailError(null)
  }

  function bumpFeedbackCount(submissionId) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === submissionId ? { ...r, feedback_count: (r.feedback_count ?? 0) + 1 } : r)))
  }

  const heading = t('school:teacher.assignments.review.heading', { title: assignment?.title ?? '' })
  const currentRow = openIndex != null ? handedIn[openIndex] : null

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
        aria-label={currentRow ? currentRow.display_name : heading}
        // bg-galaxy-bg-light, not `.glass`: this panel shows dense text
        // (a whole roster, or a book page) over the class page's own dense
        // text (the assignments list, the roster) sitting right behind it.
        // `.glass` is a deliberately translucent white/8% — fine over empty
        // starfield, but stacked over another screen's text it reads as two
        // layers of text superimposed. bg-galaxy-bg-light is index.css's own
        // "pre-blended OPAQUE equivalent" of glass, kept exactly for cases
        // like this (see tailwind.config.js's comment on that token).
        className={`w-full ${currentRow ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {currentRow && (
              <button
                type="button"
                onClick={backToList}
                aria-label={t('common:actions.back')}
                className="p-1.5 -ml-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">
              {currentRow ? currentRow.display_name : heading}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {currentRow && (
              <>
                <button
                  type="button"
                  disabled={openIndex === 0}
                  onClick={() => openAt(openIndex - 1)}
                  aria-label={t('school:teacher.assignments.review.previous')}
                  className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  disabled={openIndex === handedIn.length - 1}
                  onClick={() => openAt(openIndex + 1)}
                  aria-label={t('school:teacher.assignments.review.next')}
                  className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common:actions.close')}
              className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {currentRow ? (
          detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detailError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-red-400 text-sm font-body">{teacherErrorText(t, detailError)}</p>
              <button
                type="button"
                onClick={() => loadDetail(currentRow.id)}
                className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
              >
                {t('common:actions.retry')}
              </button>
            </div>
          ) : detail ? (
            // Stacked, not side-by-side (a sidebar next to the book, tried
            // first, doesn't work — see forceSinglePage below for why), and
            // forceSinglePage: unforced, BookPreview goes two-page-spread and
            // sizes off window.innerWidth once the viewport is wide enough
            // (its own canSpread/useFittedBookSize), not off this panel's
            // actual width — on a desktop-width window that made the book
            // wider than the modal itself and overflow past its edge.
            // Single-page mode's sizing is container-width-based instead
            // (`el.clientWidth`), so it fits whatever width this panel
            // actually has.
            <div className="space-y-6">
              <div className="flex justify-center">
                <BookPreview book={detail.submission.book_snapshot} forceSinglePage />
              </div>
              <div className="max-w-xl mx-auto">
                <FeedbackPanel
                  classId={classId}
                  submissionId={detail.submission.id}
                  feedback={detail.feedback}
                  locale={i18n.language}
                  onSent={(f) => {
                    setDetail((prev) => ({ ...prev, feedback: [...prev.feedback, f] }))
                    bumpFeedbackCount(detail.submission.id)
                  }}
                />
              </div>
            </div>
          ) : null
        ) : listError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-red-400 text-sm font-body">{teacherErrorText(t, listError)}</p>
            <button
              type="button"
              onClick={loadList}
              className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
            >
              {t('common:actions.retry')}
            </button>
          </div>
        ) : rows === null ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-galaxy-text-muted font-body text-sm text-center py-8">{t('school:teacher.assignments.review.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id ?? row.student_id}>
                <StudentRow row={row} onOpen={openRow} />
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
