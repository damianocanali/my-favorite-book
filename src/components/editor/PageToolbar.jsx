import { motion } from 'motion/react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBookStore } from '../../stores/useBookStore'
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive'
import { formatNumber } from '../../i18n/formats'

export default function PageToolbar() {
  const { t } = useTranslation()
  const book = useBookStore((state) => state.book)
  const addPage = useBookStore((state) => state.addPage)
  const removePage = useBookStore((state) => state.removePage)
  const currentPageIndex = useBookStore((state) => state.currentPageIndex)
  const adaptive = useAgeAdaptive()

  if (!book) return null

  const currentPage = book.pages[currentPageIndex]
  const canAdd = book.pages.length < adaptive.maxPages
  const canRemove = book.pages.length > 1

  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <motion.button
        onClick={addPage}
        disabled={!canAdd}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-body font-semibold text-sm transition-all cursor-pointer ${
          canAdd
            ? 'bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30 border border-galaxy-primary/30'
            : 'glass text-galaxy-text-muted/50 border border-galaxy-text-muted/10 cursor-not-allowed'
        }`}
        whileHover={canAdd ? { scale: 1.05 } : {}}
        whileTap={canAdd ? { scale: 0.95 } : {}}
      >
        <Plus size={16} />
        {t('editor:pages.add')}
      </motion.button>

      <motion.button
        onClick={() => currentPage && removePage(currentPage.id)}
        disabled={!canRemove}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-body font-semibold text-sm transition-all cursor-pointer ${
          canRemove
            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
            : 'glass text-galaxy-text-muted/50 border border-galaxy-text-muted/10 cursor-not-allowed'
        }`}
        whileHover={canRemove ? { scale: 1.05 } : {}}
        whileTap={canRemove ? { scale: 0.95 } : {}}
      >
        <Trash2 size={16} />
        {t('editor:pages.remove')}
      </motion.button>

      <span className="text-galaxy-text-muted text-xs font-body">
        {t('editor:pages.count_of_max', {
          count: book.pages.length,
          used: formatNumber(book.pages.length),
          max: formatNumber(adaptive.maxPages),
        })}
      </span>
    </div>
  )
}
