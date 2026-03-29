import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Lock } from 'lucide-react'
import { useBookStore } from '../stores/useBookStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useSubscription } from '../hooks/useSubscription'
import WizardContainer from '../components/wizard/WizardContainer'
import StoryEditor from '../components/editor/StoryEditor'
import SparkleButton from '../components/ui/SparkleButton'

const TOTAL_WIZARD_STEPS = 7

export default function CreatePage() {
  const navigate = useNavigate()
  const book = useBookStore((state) => state.book)
  const currentStep = useBookStore((state) => state.currentStep)
  const startNewBook = useBookStore((state) => state.startNewBook)
  const resetBook = useBookStore((state) => state.resetBook)
  const addBookToShelf = useBookshelfStore((state) => state.addBook)
  const updateBookOnShelf = useBookshelfStore((state) => state.updateBook)
  const getBook = useBookshelfStore((state) => state.getBook)
  const bookCount = useBookshelfStore((state) => state.books.length)
  const { plan, loading: subLoading } = useSubscription()

  // If currentStep is beyond wizard steps, go straight to editor
  const [phase, setPhase] = useState(
    currentStep >= TOTAL_WIZARD_STEPS ? 'editor' : 'wizard'
  )

  useEffect(() => {
    if (!book) {
      startNewBook()
    }
  }, [book, startNewBook])

  const handleWizardFinish = () => {
    setPhase('editor')
  }

  const handlePreview = () => {
    if (book) {
      const existingBook = getBook(book.id)
      if (existingBook) {
        // Update existing book on the shelf
        updateBookOnShelf(book.id, book)
      } else {
        // New book — add to shelf
        addBookToShelf(book)
      }
      const bookId = book.id
      resetBook()
      navigate(`/preview/${bookId}`)
    }
  }

  // Book limit gate — only applies to brand-new books (not editing an existing one)
  const isNewBook = book && !getBook(book.id)
  const atLimit = !subLoading && isNewBook && bookCount >= plan.maxBooks

  if (atLimit) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          className="w-20 h-20 rounded-full bg-galaxy-primary/20 flex items-center justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Lock size={36} className="text-galaxy-primary" />
        </motion.div>
        <motion.h2
          className="font-heading text-3xl font-bold text-galaxy-text mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          You've reached your book limit
        </motion.h2>
        <motion.p
          className="text-galaxy-text-muted font-body text-lg mb-8 max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Free accounts can save up to {plan.maxBooks} books. Upgrade to Family for unlimited books, more AI illustrations, and PDF export!
        </motion.p>
        <motion.div
          className="flex gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <SparkleButton onClick={() => navigate('/pricing')} size="large" variant="primary">
            Upgrade Plan ✨
          </SparkleButton>
          <SparkleButton onClick={() => navigate('/bookshelf')} size="large" variant="secondary">
            My Bookshelf
          </SparkleButton>
        </motion.div>
      </div>
    )
  }

  if (!book) return null

  return (
    <div className="pb-12">
      {phase === 'wizard' ? (
        <WizardContainer onFinish={handleWizardFinish} />
      ) : (
        <StoryEditor onPreview={handlePreview} />
      )}
    </div>
  )
}
