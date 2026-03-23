import { motion } from 'motion/react'
import { useBookStore } from '../../stores/useBookStore'

export default function PageThumbnailStrip() {
  const book = useBookStore((state) => state.book)
  const currentPageIndex = useBookStore((state) => state.currentPageIndex)
  const setCurrentPageIndex = useBookStore((state) => state.setCurrentPageIndex)

  if (!book) return null

  const bookColors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4' }

  return (
    <div className="mt-6">
      <p className="text-galaxy-text-muted text-xs font-body mb-2 text-center">
        Click a page to edit it
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 justify-center flex-wrap">
        {book.pages.map((page, index) => {
          const isActive = index === currentPageIndex
          return (
            <motion.button
              key={page.id}
              onClick={() => setCurrentPageIndex(index)}
              className={`relative flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
                isActive
                  ? 'border-galaxy-primary shadow-glow-purple'
                  : 'border-galaxy-text-muted/20 hover:border-galaxy-primary/50'
              }`}
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${bookColors.cover}30, ${bookColors.accent}20)`
                  : undefined,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-galaxy-bg-light/80 flex flex-col items-center justify-center gap-1 p-1">
                <span className="text-xs font-heading font-bold text-galaxy-text">
                  {page.pageNumber}
                </span>
                {page.text && (
                  <p className="text-[8px] text-galaxy-text-muted line-clamp-3 text-center font-body px-1">
                    {page.text}
                  </p>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
