import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SparkleButton from '../ui/SparkleButton'

export default function EmptyShelf() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <motion.div
      className="text-center py-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="w-24 h-24 mx-auto mb-6"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <img src="/logo.png" alt="My Book Lab" className="w-full h-full rounded-2xl opacity-60" />
      </motion.div>
      <h3 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
        {t('gallery:empty_shelf.title')}
      </h3>
      <p className="text-galaxy-text-muted font-body mb-8 max-w-sm mx-auto">
        {t('gallery:empty_shelf.body')}
      </p>
      <SparkleButton onClick={() => navigate('/create')} size="large">
        {t('gallery:empty_shelf.cta')}
      </SparkleButton>
      <p className="mt-5">
        <button
          onClick={() => navigate('/example')}
          className="text-sm text-galaxy-text-muted hover:text-galaxy-text underline underline-offset-4 transition-colors"
        >
          {t('gallery:empty_shelf.example_link')}
        </button>
      </p>
    </motion.div>
  )
}
