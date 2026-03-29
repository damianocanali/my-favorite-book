import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useBookStore } from '../../stores/useBookStore'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive'
import PageEditor from './PageEditor'
import PageThumbnailStrip from './PageThumbnailStrip'
import PageToolbar from './PageToolbar'
import SparkleButton from '../ui/SparkleButton'
import CoverArtGenerator from './CoverArtGenerator'
import { BookOpen, Eye } from 'lucide-react'

export default function StoryEditor({ onPreview }) {
  const book = useBookStore((state) => state.book)
  const currentPageIndex = useBookStore((state) => state.currentPageIndex)
  const getBook = useBookshelfStore((state) => state.getBook)
  const adaptive = useAgeAdaptive()
  const focusMode = useAccessibilityStore((s) => s.focusMode)
  const setFocusMode = useAccessibilityStore((s) => s.setFocusMode)

  // Exit focus mode with Escape key
  useEffect(() => {
    if (!focusMode) return
    const handleKey = (e) => { if (e.key === 'Escape') setFocusMode(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [focusMode, setFocusMode])

  if (!book) return null

  const isEditing = !!getBook(book.id)
  const currentPage = book.pages[currentPageIndex]

  return (
    <>
      <motion.div
        className="max-w-4xl mx-auto px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-galaxy-primary" />
            <div>
              <h2 className={`font-heading font-bold text-galaxy-text ${adaptive.fontSize.heading}`}>
                {book.title}
              </h2>
              <p className="text-galaxy-text-muted text-sm font-body">
                by {book.authorName} — Page {currentPageIndex + 1} of {book.pages.length}
              </p>
            </div>
          </div>
          <SparkleButton onClick={onPreview} variant="secondary" size="small">
            <span className="flex items-center gap-2">
              <Eye size={16} /> Preview Book
            </span>
          </SparkleButton>
        </div>

        {/* Cover art generator */}
        <CoverArtGenerator />

        {/* Page toolbar */}
        <PageToolbar />

        {/* Current page editor */}
        {currentPage && (
          <PageEditor key={currentPage.id} page={currentPage} />
        )}

        {/* Page thumbnails */}
        <PageThumbnailStrip />

        {/* Finish button */}
        <div className="flex justify-center mt-8">
          <SparkleButton onClick={onPreview} variant="accent" size="large">
            <span className="flex items-center gap-2">
              {isEditing ? '✨ Save & Preview My Book!' : '✨ Finish & Preview My Book!'}
            </span>
          </SparkleButton>
        </div>
      </motion.div>

      {/* Focus mode overlay */}
      <AnimatePresence>
        {focusMode && currentPage && (
          <motion.div
            className="fixed inset-0 z-50 bg-galaxy-bg overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="max-w-2xl mx-auto px-4 py-8">
              {/* Focus mode header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-galaxy-text-muted text-sm font-body">
                  Page {currentPageIndex + 1} — Focus Mode
                </p>
                <button
                  onClick={() => setFocusMode(false)}
                  className="text-galaxy-text-muted hover:text-galaxy-text text-xs font-body px-3 py-1 rounded-lg border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors"
                >
                  Exit (Esc)
                </button>
              </div>
              <PageEditor key={`focus-${currentPage.id}`} page={currentPage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
