// src/components/print/BookFinishedModal.jsx
// Celebratory overlay shown after a book is "finished". Primary action is
// Order a print →, secondary is Maybe later. Stays out of the way unless
// `open` is true.
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function BookFinishedModal({ book, open, onClose }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md rounded-modal p-6 text-center bg-gradient-to-br from-[#38246B] to-[#662E80] shadow-glow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label={t('common:actions.close')} className="absolute top-3 right-3 p-1.5 rounded-lg text-galaxy-text-muted hover:bg-galaxy-bg">
              <X size={18} />
            </button>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-heading text-2xl font-bold text-galaxy-text">{t('print:finished.title')}</h2>
            <p className="text-galaxy-text-muted mt-2 text-sm">{t('print:finished.subtitle')}</p>
            <button
              onClick={() => navigate(`/order/${book?.id}`)}
              disabled={!book?.id}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-fill-primary font-heading font-bold transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} /> {t('print:finished.order_cta')}
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2.5 text-sm text-galaxy-text-muted hover:text-galaxy-text">
              {t('print:finished.later')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
