import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, BookOpen } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import BookPreview from '../book/BookPreview'

// A teacher opening one of their students' books from the roster
// (RosterTable's clickable name / "Books" button). Read-only end to end —
// api/school/student-books.js is GET-only and server-enforces class
// ownership plus scoping every query to the student's own auth_user_id, so
// this component never needs to (and never should) trust anything about
// "whose books these are" beyond the `student` prop it was opened with.
// Nothing here touches localStorage: the list and any opened book are
// re-fetched every time this panel opens and held only in memory.
//
// Same modal treatment as TeacherHelpScreen/HelpScreen/BreakScreen: portal,
// role="dialog" + aria-modal, focus moved onto the panel and given back on
// close, Escape alongside the Close button.
export default function StudentBooks({ classId, student, onClose }) {
  const { t, i18n } = useTranslation()
  const panelRef = useRef(null)

  const [books, setBooks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The open book, if any: { book_id, title } from the list, kept separate
  // from its fetched book_data so the heading/back button can render before
  // the (slower) full-book fetch resolves.
  const [openBook, setOpenBook] = useState(null)
  const [bookData, setBookData] = useState(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await schoolFetch(
      `/api/school/student-books?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.id)}`
    )
    setLoading(false)
    if (res.ok) setBooks(res.data?.books ?? [])
    else setError(res.code || 'generic')
  }, [classId, student.id])

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

  async function loadBook(book) {
    setOpenBook(book)
    setBookData(null)
    setBookError(null)
    setBookLoading(true)
    const res = await schoolFetch(
      `/api/school/student-books?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.id)}` +
        `&bookId=${encodeURIComponent(book.book_id)}`
    )
    setBookLoading(false)
    if (res.ok) setBookData(res.data?.book ?? null)
    else setBookError(res.code || 'generic')
  }

  function backToList() {
    setOpenBook(null)
    setBookData(null)
    setBookError(null)
  }

  const heading = t('school:teacher.student_books.heading', { name: student.display_name })

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
        aria-label={openBook ? openBook.title : heading}
        className={`w-full ${openBook ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {openBook && (
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
              {openBook ? openBook.title : heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {openBook ? (
          bookLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-red-400 text-sm font-body">{teacherErrorText(t, bookError)}</p>
              <button
                type="button"
                onClick={() => loadBook(openBook)}
                className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
              >
                {t('common:actions.retry')}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <BookPreview book={bookData} />
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-red-400 text-sm font-body">{teacherErrorText(t, error)}</p>
            <button
              type="button"
              onClick={loadList}
              className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
            >
              {t('common:actions.retry')}
            </button>
          </div>
        ) : books.length === 0 ? (
          <p className="text-galaxy-text-muted font-body text-sm text-center py-8">
            {t('school:teacher.student_books.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {books.map((b) => (
              <li key={b.book_id}>
                <button
                  type="button"
                  onClick={() => loadBook(b)}
                  aria-label={t('school:teacher.student_books.open_book_aria', { title: b.title })}
                  className="w-full flex items-center gap-3 glass rounded-xl p-3 border border-galaxy-text-muted/10 hover:border-galaxy-secondary/40 transition-colors text-left"
                >
                  {b.cover ? (
                    <img
                      src={b.cover}
                      alt=""
                      aria-hidden="true"
                      className="w-10 h-14 object-cover rounded-md shrink-0"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="w-10 h-14 rounded-md shrink-0 flex items-center justify-center bg-galaxy-secondary/15 text-galaxy-secondary"
                    >
                      <BookOpen size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-body font-semibold text-galaxy-text truncate">{b.title}</p>
                    <p className="text-galaxy-text-muted text-xs font-body">
                      {t('school:teacher.student_books.updated', { when: relativeTime(b.updated_at, i18n.language) })}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
