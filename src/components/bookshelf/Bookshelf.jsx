import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useBookStore } from '../../stores/useBookStore'
import BookSpine from './BookSpine'
import EmptyShelf from './EmptyShelf'

function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <motion.div
        className="relative bg-galaxy-bg-light rounded-2xl p-6 max-w-sm w-full border border-galaxy-text-muted/20 shadow-2xl text-center space-y-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <p className="font-heading text-lg font-bold text-galaxy-text">Delete this book?</p>
        <p className="font-body text-galaxy-text-muted text-sm">
          "{title}" will be permanently removed from your shelf.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-xl font-body font-semibold text-galaxy-text bg-galaxy-bg border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl font-body font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function Bookshelf() {
  const books = useBookshelfStore((state) => state.books)
  const removeBook = useBookshelfStore((state) => state.removeBook)
  const loadBook = useBookStore((state) => state.loadBook)
  const setStep = useBookStore((state) => state.setStep)
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState(null)

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
              onDelete={() => setPendingDelete(book)}
            />
          </motion.div>
        ))}
      </div>

      {/* Shelf decoration - wooden shelf line */}
      <div className="mt-8 h-3 bg-gradient-to-r from-amber-900/40 via-amber-800/60 to-amber-900/40 rounded-full" />

      <AnimatePresence>
        {pendingDelete && (
          <DeleteConfirmModal
            title={pendingDelete.title}
            onConfirm={() => { removeBook(pendingDelete.id); setPendingDelete(null) }}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
