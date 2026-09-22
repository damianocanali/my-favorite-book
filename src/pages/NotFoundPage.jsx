import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'

// Any unmatched URL used to render nothing but the tab bar, so a mistyped
// or stale link looked like the app had broken. A lost-in-space beat keeps
// it in-world and, more importantly, points the way home.
export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <motion.div
        className="text-7xl"
        animate={{ y: [0, -10, 0], rotate: [-6, 6, -6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        🚀
      </motion.div>
      <h1 className="font-heading text-3xl font-bold text-galaxy-text">{t('common:not_found.title')}</h1>
      <p className="font-body text-galaxy-text-muted max-w-sm">
        {t('common:not_found.body')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-galaxy-primary/20 border border-galaxy-primary/40 font-body text-sm text-galaxy-text hover:bg-galaxy-primary/30 transition-colors"
        >
          {t('common:not_found.go_home')}
        </Link>
        <Link
          to="/bookshelf"
          className="px-5 py-2.5 rounded-xl glass border border-galaxy-text-muted/20 font-body text-sm text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/40 transition-colors"
        >
          {t('common:not_found.bookshelf')}
        </Link>
      </div>
    </div>
  )
}
