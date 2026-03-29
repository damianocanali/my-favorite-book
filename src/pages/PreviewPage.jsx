import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Edit3, Printer, Send } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useBookStore } from '../stores/useBookStore'
import { useSubscription } from '../hooks/useSubscription'
import BookPreview from '../components/book/BookPreview'
import PrintableBook from '../components/print/PrintableBook'
import SubmitToClassModal from '../components/classroom/SubmitToClassModal'
import SparkleButton from '../components/ui/SparkleButton'
import { isNative } from '../capacitor'

export default function PreviewPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const getBook = useBookshelfStore((state) => state.getBook)
  const loadBook = useBookStore((state) => state.loadBook)
  const setStep = useBookStore((state) => state.setStep)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const { plan } = useSubscription()

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

        <div className="flex items-center gap-2">
          {/* Submit to class */}
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10 transition-colors"
          >
            <Send size={14} />
            {!isNative && 'Submit to Class'}
          </button>

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

      {/* Submit to class modal */}
      {showSubmitModal && (
        <SubmitToClassModal book={book} onClose={() => setShowSubmitModal(false)} />
      )}
    </div>
  )
}
