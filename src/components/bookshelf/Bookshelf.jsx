import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useBookStore } from '../../stores/useBookStore'
import BookSpine from './BookSpine'
import ShelfBoard from './ShelfBoard'
import EmptyShelf from './EmptyShelf'


// How many columns the grid is showing, mirroring the Tailwind breakpoints on
// the grid below. Needed for one reason only: the last row is usually not full,
// and without filler the shelf board stops under the last book instead of
// running the width of the shelf. iOS draws the plank outside the row's HStack
// so it always spans — this is how the same thing is done with a CSS grid whose
// column count only exists in CSS.
const COLUMN_QUERIES = [
  ['(min-width: 1024px)', 5],
  ['(min-width: 768px)', 4],
  ['(min-width: 640px)', 3],
]

function useGridColumns() {
  const read = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 5
    return COLUMN_QUERIES.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 2
  }
  const [columns, setColumns] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const lists = COLUMN_QUERIES.map(([q]) => window.matchMedia(q))
    const update = () => setColumns(read())
    lists.forEach((l) => l.addEventListener('change', update))
    update()
    return () => lists.forEach((l) => l.removeEventListener('change', update))
  }, [])

  return columns
}

function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <motion.div
        className="relative rounded-modal p-6 max-w-sm w-full bg-gradient-to-br from-[#38246B] to-[#662E80] shadow-glow-modal text-center space-y-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <p className="font-heading text-lg font-bold text-galaxy-text">{t('gallery:delete_modal.title')}</p>
        <p className="font-body text-galaxy-text-muted text-sm">
          {t('gallery:delete_modal.body', { title })}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-xl font-body font-semibold text-galaxy-text glass border border-white/15 hover:border-galaxy-text-muted/60 transition-colors"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl font-body font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            {t('common:actions.delete')}
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
  const columns = useGridColumns()

  const handleEdit = (book) => {
    loadBook(book)
    setStep(7) // Skip wizard, go straight to editor
    navigate('/create')
  }

  if (books.length === 0) return <EmptyShelf />

  return (
    <div>
      {/* The shelf.
          No horizontal gap: each cell carries its own board, and boards only
          read as one continuous plank if the cells touch. Books are spaced by
          padding inside the cell instead. Doing it this way means the shelves
          land correctly at every breakpoint without JavaScript measuring the
          viewport to work out where a row ends. */}
      <div className="grid grid-cols-2 gap-x-0 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {books.map((book, index) => (
          <motion.div
            key={book.id}
            // perspective belongs on this cell, the parent of the book that
            // rotates. Setting it on the rotating element instead makes the
            // turn render flat — the books looked like plain cards.
            className="flex flex-col justify-end [perspective:620px]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            // Books land left to right. Capped so a full shelf does not make
            // the last book wait seconds to appear.
            transition={{ delay: Math.min(index, 12) * 0.06 }}
          >
            {/* Book spacing lives here, not on the cell, so the board below
                still spans the full cell and meets its neighbours. */}
            <div className="px-2 sm:px-3">
              <BookSpine
                book={book}
                onClick={() => navigate(`/preview/${book.id}`)}
                onEdit={() => handleEdit(book)}
                onDelete={() => setPendingDelete(book)}
                onOrderPrint={() => navigate(`/order/${book.id}`)}
              />
            </div>
            <ShelfBoard />
          </motion.div>
        ))}

        {/* Board-only cells finishing the last row, so the plank runs the full
            width of the shelf rather than stopping under the last book. */}
        {Array.from({ length: (columns - (books.length % columns)) % columns }).map((_, i) => (
          <div key={`filler-${i}`} className="flex flex-col justify-end" aria-hidden="true">
            <ShelfBoard />
          </div>
        ))}
      </div>

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
