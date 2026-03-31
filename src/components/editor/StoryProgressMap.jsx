import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'

export default function StoryProgressMap() {
  const book = useBookStore((state) => state.book)
  const currentPageIndex = useBookStore((state) => state.currentPageIndex)
  const setCurrentPageIndex = useBookStore((state) => state.setCurrentPageIndex)

  if (!book) return null

  const pages = book.pages
  const completedCount = pages.filter((p) => p.text.trim().length > 0).length

  return (
    <div className="mb-4">
      {/* Progress text */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-galaxy-text-muted text-xs font-body">
          Your story progress
        </p>
        <p className="text-galaxy-secondary text-xs font-body font-semibold">
          {completedCount} of {pages.length} pages written
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {pages.map((page, index) => {
          const isActive = index === currentPageIndex
          const hasText = page.text.trim().length > 0
          const hasIllustration = !!page.illustrationData

          return (
            <motion.button
              key={page.id}
              onClick={() => setCurrentPageIndex(index)}
              className={`relative flex items-center justify-center rounded-full transition-all cursor-pointer ${
                isActive
                  ? 'w-9 h-9 border-2 border-galaxy-primary bg-galaxy-primary/20'
                  : hasText
                    ? 'w-7 h-7 border-2 border-galaxy-secondary/60 bg-galaxy-secondary/15'
                    : 'w-7 h-7 border-2 border-galaxy-text-muted/20 bg-galaxy-bg-light'
              }`}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              title={`Page ${page.pageNumber}${hasText ? ' (written)' : ' (empty)'}`}
            >
              {hasText ? (
                <Check
                  size={isActive ? 16 : 13}
                  className={isActive ? 'text-galaxy-primary' : 'text-galaxy-secondary'}
                />
              ) : (
                <span className={`font-heading font-bold ${isActive ? 'text-sm text-galaxy-primary' : 'text-xs text-galaxy-text-muted'}`}>
                  {page.pageNumber}
                </span>
              )}

              {/* Tiny illustration indicator dot */}
              {hasIllustration && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-galaxy-accent border border-galaxy-bg" />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Overall progress bar */}
      <div className="mt-2 h-1.5 bg-galaxy-text-muted/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-galaxy-primary to-galaxy-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / pages.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
