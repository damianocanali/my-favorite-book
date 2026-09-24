import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import BookSpine from './BookSpine'
import BookOpenTransition from './BookOpenTransition'
import ShelfBoard from './ShelfBoard'
import EmptyShelf from './EmptyShelf'


// How many spines fit across, mirroring the auto-fill track below. Needed only
// so the last row's shelf board can be padded out to full width — without it
// the plank stops under the last book instead of running the length of the
// shelf, which iOS avoids by drawing the board outside the row's HStack.
const TRACK_PX = 72

function useGridColumns(ref) {
  const [columns, setColumns] = useState(8)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // Measured rather than derived from breakpoints: the track is auto-fill, so
    // the count depends on the container's width, not the viewport's.
    const ro = new ResizeObserver(() => {
      setColumns(Math.max(1, Math.floor(el.clientWidth / TRACK_PX)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

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
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [opening, setOpening] = useState(null)
  const shelfRef = useRef(null)
  const columns = useGridColumns(shelfRef)

  // The transition hands off here rather than navigating itself, so an
  // interrupted animation can never strand a child on a decorative overlay.
  const finishOpening = useCallback(() => {
    const book = opening
    setOpening(null)
    if (book) navigate(`/preview/${book.id}`)
  }, [opening, navigate])

  if (books.length === 0) return <EmptyShelf />

  const fillers = (columns - (books.length % columns)) % columns

  return (
    <div>
      {/* The shelf. Spines stand in an auto-fill track, so as many fit across
          as the container allows rather than a fixed count per breakpoint.

          No horizontal gap: each cell carries its own board segment, and the
          segments only read as one continuous plank if the cells touch. Spines
          are spaced by padding inside their own cell instead. */}
      <div
        ref={shelfRef}
        className="grid gap-x-0 gap-y-8"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TRACK_PX}px, 1fr))` }}
      >
        {books.map((book, index) => (
          <motion.div
            key={book.id}
            className="flex flex-col justify-end"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            // Books land left to right. Capped so a full shelf does not make
            // the last one wait seconds to appear.
            transition={{ delay: Math.min(index, 12) * 0.05 }}
          >
            {/* items-end so spines of differing heights share a baseline —
                they stand ON the shelf rather than hanging from a grid row. */}
            <div className="flex items-end justify-center px-1.5">
              <BookSpine
                book={book}
                // Position within its row, so the height variation repeats
                // across the shelf the way it does on iOS.
                indexInRow={index % Math.max(1, columns)}
                onClick={() => setOpening(book)}
                onDelete={() => setPendingDelete(book)}
              />
            </div>
            <ShelfBoard />
          </motion.div>
        ))}

        {/* Board-only cells finishing the last row, so the plank runs the full
            width of the shelf rather than stopping under the last book. */}
        {Array.from({ length: fillers }).map((_, i) => (
          <div key={`filler-${i}`} className="flex flex-col justify-end" aria-hidden="true">
            <ShelfBoard />
          </div>
        ))}
      </div>

      {opening && <BookOpenTransition book={opening} onDone={finishOpening} />}

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
