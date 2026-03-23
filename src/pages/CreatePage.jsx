import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookStore } from '../stores/useBookStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import WizardContainer from '../components/wizard/WizardContainer'
import StoryEditor from '../components/editor/StoryEditor'

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
