import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'

// What "take a break" does: says the work is safe, then gets out of the way.
// No timer, no breathing exercise, no task. A child who asked to stop should
// not be handed another thing to do.

export default function BreakScreen({ onDone }) {
  const { t } = useTranslation()
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 bg-galaxy-bg px-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Mascot mood="welcome" size={120} />
      <h2 className="font-heading text-2xl font-bold text-galaxy-text">
        {t('checkin:response.break_title')}
      </h2>
      <p className="max-w-sm font-body text-galaxy-text-muted">
        {t('checkin:response.break_body')}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 rounded-full border-2 border-white/30 px-6 py-2.5 font-heading text-sm font-bold text-white/90"
      >
        {t('checkin:response.break_cta')}
      </button>
    </motion.div>,
    document.body
  )
}
