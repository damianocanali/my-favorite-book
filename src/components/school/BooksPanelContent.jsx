import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import BookPreview from '../book/BookPreview'

// The content (no dialog chrome) behind a student's book list/book-detail
// view. Extracted out of StudentBooks.jsx so the dashboard's
// StudentDetailDrawer (Task D2) can mount this directly inside its OWN
// single dialog shell, rather than mounting all of StudentBooks (its own
// portal/backdrop/dialog) as one of two tabs — the two dialogs would have
// remounted the whole modal, and re-announced it to a screen reader, on
// every tab switch. StudentBooks.jsx keeps using this same content for its
// own standalone use (TeacherClassPage's roster "Books" button) — nothing
// about that dialog's own chrome changes.
//
// Read-only end to end, same reasoning as StudentBooks.jsx: api/school/
// student-books.js is GET-only and server-enforces class ownership plus
// scoping every query to the student's own auth_user_id.
export default function BooksPanelContent({ classId, student }) {
  const { t, i18n } = useTranslation()

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

  if (openBook) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={backToList}
            aria-label={t('common:actions.back')}
            className="p-1.5 -ml-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <h3 className="font-heading text-base font-bold text-galaxy-text truncate">{openBook.title}</h3>
        </div>
        {bookLoading ? (
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
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
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
    )
  }

  if (books.length === 0) {
    return (
      <p className="text-galaxy-text-muted font-body text-sm text-center py-8">
        {t('school:teacher.student_books.empty')}
      </p>
    )
  }

  return (
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
  )
}
