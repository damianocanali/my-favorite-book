import { motion } from 'motion/react'
import { Clock, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBookStore } from '../../stores/useBookStore'
import { timePeriods } from '../../data/timePeriods'
import { displayName, displayDescription } from '../../i18n/contentCatalog'
import GlowCard from '../ui/GlowCard'
import SparkleButton from '../ui/SparkleButton'

export default function StepTimePeriod({ onNext, onPrev }) {
  const { t } = useTranslation()
  const timePeriod = useBookStore((state) => state.book?.timePeriod)
  const setTimePeriod = useBookStore((state) => state.setTimePeriod)

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Clock size={40} className="text-amber-400" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          {t('wizard:time_period.heading')}
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          {t('wizard:time_period.subtitle')}
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-lg"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {timePeriods.map((period) => (
            <GlowCard
              key={period.id}
              selected={timePeriod?.id === period.id}
              onClick={() => setTimePeriod(period)}
              color={period.color}
              className="flex flex-col items-center gap-3 py-6"
            >
              <span className="text-5xl">{period.emoji}</span>
              <span className="font-heading font-bold text-lg text-galaxy-text text-center">
                {displayName(period, t, 'time_periods')}
              </span>
              <span className="text-galaxy-text-muted text-xs text-center font-body">
                {displayDescription(period, t, 'time_periods')}
              </span>
            </GlowCard>
          ))}
        </div>
      </motion.div>

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> {t('common:actions.back')}
          </span>
        </SparkleButton>
        <SparkleButton onClick={onNext} disabled={!timePeriod}>
          {t('wizard:actions.next_step')}
        </SparkleButton>
      </div>
    </div>
  )
}
