import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useBookStore } from '../stores/useBookStore'
import BookPreview from '../components/book/BookPreview'
import SparkleButton from '../components/ui/SparkleButton'
import { isNative } from '../capacitor'

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
    <div className={isNative ? 'py-2 px-2 flex flex-col h-[calc(100dvh-60px)]' : 'py-6 px-4'}>
      {/* Header */}
      <motion.div
        className={`mx-auto flex items-center justify-between ${isNative ? 'w-full mb-2 px-2' : 'max-w-3xl mb-6'}`}
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
        <SparkleButton onClick={handleEdit} variant="secondary" size="small">
          <span className="flex items-center gap-2">
            <Edit3 size={16} /> Edit
          </span>
        </SparkleButton>
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
    </div>
  )
}
