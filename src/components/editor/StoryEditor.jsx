import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useBookStore } from '../../stores/useBookStore'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive'
import PageEditor from './PageEditor'
import PageThumbnailStrip from './PageThumbnailStrip'
import PageToolbar from './PageToolbar'
import StoryProgressMap from './StoryProgressMap'
import SparkleButton from '../ui/SparkleButton'
import CheckInButton from '../ui/CheckInButton'
import CoverArtGenerator from './CoverArtGenerator'
import { Eye } from 'lucide-react'
import AppLogo from '../ui/AppLogo'
import { formatNumber } from '../../i18n/formats'

export default function StoryEditor({ onPreview }) {
  const { t } = useTranslation()
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
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <AppLogo size={24} className="shrink-0" />
            <div className="min-w-0">
              <h2 className={`font-heading font-bold text-galaxy-text truncate ${adaptive.fontSize.heading}`}>
                {book.title}
              </h2>
              <p className="text-galaxy-text-muted text-xs sm:text-sm font-body">
                {t('editor:header.byline_page', {
                  author: book.authorName,
                  page: formatNumber(currentPageIndex + 1),
                  total: formatNumber(book.pages.length),
                })}
              </p>
            </div>
          </div>
          <SparkleButton onClick={onPreview} variant="secondary" size="small">
            <span className="flex items-center gap-2">
              <Eye size={16} /> {t('editor:actions.preview_book')}
            </span>
          </SparkleButton>
        </div>

        {/* Story progress map — persistent visual progress for ADHD scaffolding */}
        <StoryProgressMap />

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

        {/* Finish button — check-in first so it never competes for the primary position */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <CheckInButton />
          <SparkleButton onClick={onPreview} variant="accent" size="large">
            <span className="flex items-center gap-2">
              {isEditing ? t('editor:actions.save_and_preview') : t('editor:actions.finish_and_preview')}
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
                  {t('editor:focus.page_label', { page: formatNumber(currentPageIndex + 1) })}
                </p>
                <button
                  onClick={() => setFocusMode(false)}
                  className="text-galaxy-text-muted hover:text-galaxy-text text-xs font-body px-3 py-1 rounded-lg border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors"
                >
                  {t('editor:focus.exit')}
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
