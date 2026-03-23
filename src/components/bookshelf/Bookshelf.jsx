import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useBookStore } from '../../stores/useBookStore'
import BookSpine from './BookSpine'
import EmptyShelf from './EmptyShelf'

export default function Bookshelf() {
  const books = useBookshelfStore((state) => state.books)
  const removeBook = useBookshelfStore((state) => state.removeBook)
  const loadBook = useBookStore((state) => state.loadBook)
  const setStep = useBookStore((state) => state.setStep)
  const navigate = useNavigate()

  const handleEdit = (book) => {
    loadBook(book)
    setStep(7) // Skip wizard, go straight to editor
    navigate('/create')
  }

  if (books.length === 0) return <EmptyShelf />

  return (
    <div>
      {/* Shelf */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {books.map((book, index) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <BookSpine
              book={book}
              onClick={() => navigate(`/preview/${book.id}`)}
              onEdit={() => handleEdit(book)}
              onDelete={() => {
                if (window.confirm(`Delete "${book.title}"?`)) {
                  removeBook(book.id)
                }
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Shelf decoration - wooden shelf line */}
      <div className="mt-8 h-3 bg-gradient-to-r from-amber-900/40 via-amber-800/60 to-amber-900/40 rounded-full" />
    </div>
  )
}
