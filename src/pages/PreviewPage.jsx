import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, Edit3, Printer, Send, X, Shield, Globe, Check, Loader2 } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useBookStore } from '../stores/useBookStore'
import { useSubscription } from '../hooks/useSubscription'
import { useAuthStore } from '../stores/useAuthStore'
import BookPreview from '../components/book/BookPreview'
import PrintableBook from '../components/print/PrintableBook'
import SubmitToClassModal from '../components/classroom/SubmitToClassModal'
import SparkleButton from '../components/ui/SparkleButton'
import { isNative } from '../capacitor'
import { apiFetch } from '../lib/api'

export default function PreviewPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const getBook = useBookshelfStore((state) => state.getBook)
  const loadBook = useBookStore((state) => state.loadBook)
  const setStep = useBookStore((state) => state.setStep)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState(null)
  const { plan } = useSubscription()
  const user = useAuthStore((s) => s.user)

  const book = getBook(bookId)

  const handleEdit = () => {
    loadBook(book)
    setStep(7)
    navigate('/create')
  }

  const handlePrint = () => {
    if (!plan.pdfExport) {
      navigate('/pricing')
      return
    }
    window.print()
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await apiFetch('/api/publish-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book, userId: user?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const fullUrl = `${window.location.origin}/view/${data.slug}`
      setPublishedUrl(fullUrl)
      if (navigator.clipboard) navigator.clipboard.writeText(fullUrl)
    } catch {
      alert('Failed to publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  if (!book) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-galaxy-text-muted font-body text-xl mb-4">
          Book not found
        </p>
        <SparkleButton onClick={() => navigate('/bookshelf')} variant="secondary">
          Back to Bookshelf
        </SparkleButton>
      </div>
    )
  }

  return (
    <div className={isNative ? 'py-2 px-2 flex flex-col h-[calc(100dvh-60px)]' : 'py-6 px-4'}>
      {/* Header */}
      <motion.div
        className={`mx-auto flex items-center justify-between gap-2 ${isNative ? 'w-full mb-2 px-2' : 'max-w-3xl mb-6'}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate('/bookshelf')}
          className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors cursor-pointer font-body"
        >
          <ArrowLeft size={18} />
          {!isNative && 'Back to Bookshelf'}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Submit to class */}
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10 transition-colors"
          >
            <Send size={14} />
            {!isNative && 'Submit to Class'}
          </button>

          {/* Publish / Share */}
          {user && !publishedUrl && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-primary border border-galaxy-primary/40 hover:bg-galaxy-primary/10 transition-colors"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {!isNative && (publishing ? 'Publishing...' : 'Publish')}
            </button>
          )}
          {publishedUrl && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(publishedUrl)
                if (navigator.share) navigator.share({ title: book.title, url: publishedUrl })
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-green-400 border border-green-400/40 bg-green-400/5"
            >
              <Check size={14} />
              {!isNative && 'Share Link'}
            </button>
          )}

          {/* Print / Save as PDF */}
          {!isNative && (
            <button
              onClick={handlePrint}
              title={plan.pdfExport ? 'Print or save as PDF' : 'Upgrade to export PDF'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/30 hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors"
            >
              <Printer size={14} />
              {plan.pdfExport ? 'Print / PDF' : '🔒 Print / PDF'}
            </button>
          )}

          <SparkleButton onClick={handleEdit} variant="secondary" size="small">
            <span className="flex items-center gap-2">
              <Edit3 size={16} /> Edit
            </span>
          </SparkleButton>
        </div>
      </motion.div>

      {/* Book title */}
      <motion.div
        className={`text-center ${isNative ? 'mb-2' : 'mb-6'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className={`font-heading font-bold text-galaxy-text mb-0.5 ${isNative ? 'text-xl' : 'text-3xl'}`}>
          {book.title}
        </h1>
        <p className={`text-galaxy-text-muted font-body ${isNative ? 'text-sm' : ''}`}>
          by {book.authorName}
        </p>
      </motion.div>

      {/* Book preview */}
      <div className={isNative ? 'flex-1 flex items-center justify-center' : ''}>
        <BookPreview book={book} />
      </div>

      {/* Tip */}
      {!isNative && (
        <motion.p
          className="text-center text-galaxy-text-muted text-sm font-body mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Click or swipe the pages to flip through your book!
        </motion.p>
      )}

      {/* Hidden print layout — only visible during window.print() */}
      <PrintableBook book={book} />

      {/* Guest sign-up nudge */}
      <AnimatePresence>
        {!user && !nudgeDismissed && !isNative && (
          <motion.div
            className="fixed bottom-[calc(1.5rem+var(--sab,0px))] left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="bg-galaxy-bg-light border border-galaxy-primary/40 rounded-2xl px-5 py-4 shadow-glow flex items-start gap-3">
              <Shield size={20} className="text-galaxy-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-galaxy-text font-body text-sm font-semibold mb-0.5">
                  Keep your book safe!
                </p>
                <p className="text-galaxy-text-muted font-body text-xs">
                  This book is saved on this device only. Create a free account to access it anywhere.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Link
                    to="/signup"
                    className="px-4 py-1.5 rounded-full bg-galaxy-primary text-white text-xs font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
                  >
                    Create free account
                  </Link>
                  <Link
                    to="/login"
                    className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-text transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
              <button
                onClick={() => setNudgeDismissed(true)}
                className="text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit to class modal */}
      {showSubmitModal && (
        <SubmitToClassModal book={book} onClose={() => setShowSubmitModal(false)} />
      )}
    </div>
  )
}
