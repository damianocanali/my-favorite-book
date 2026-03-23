import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useBookStore } from '../stores/useBookStore'
import BookPreview from '../components/book/BookPreview'
import SparkleButton from '../components/ui/SparkleButton'

export default function PreviewPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const getBook = useBookshelfStore((state) => state.getBook)
  const loadBook = useBookStore((state) => state.loadBook)

  const setStep = useBookStore((state) => state.setStep)

  const book = getBook(bookId)

  const handleEdit = () => {
    loadBook(book)
    setStep(7)
    navigate('/create')
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
    <div className="py-8 px-4">
      {/* Header */}
      <motion.div
        className="max-w-2xl mx-auto mb-8 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate('/bookshelf')}
          className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors cursor-pointer font-body"
        >
          <ArrowLeft size={18} />
          Back to Bookshelf
        </button>
        <SparkleButton onClick={handleEdit} variant="secondary" size="small">
          <span className="flex items-center gap-2">
            <Edit3 size={16} /> Edit Book
          </span>
        </SparkleButton>
      </motion.div>

      {/* Book title */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-1">
          {book.title}
        </h1>
        <p className="text-galaxy-text-muted font-body">
          by {book.authorName}
        </p>
      </motion.div>

      {/* Book preview */}
      <BookPreview book={book} />

      {/* Tip */}
      <motion.p
        className="text-center text-galaxy-text-muted text-sm font-body mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Click or swipe the pages to flip through your book!
      </motion.p>
    </div>
  )
}
