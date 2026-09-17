import { useEffect } from 'react'
import { motion } from 'motion/react'
import { User, ChevronLeft } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { useBookStore } from '../../stores/useBookStore'
import { useAuthStore, selectDisplayName } from '../../stores/useAuthStore'
import { formatNumber } from '../../i18n/formats'
import SparkleButton from '../ui/SparkleButton'

const LITTLE_STAR_MAX_AGE = 7

export default function StepAuthor({ onNext, onPrev }) {
  const { t } = useTranslation()
  const book = useBookStore((state) => state.book)
  const setAuthor = useBookStore((state) => state.setAuthor)
  const displayName = useAuthStore(selectDisplayName)

  const authorName = book?.authorName ?? ''
  const authorAge = book?.authorAge ?? 8

  // Pre-fill name from the logged-in user's profile if the field is empty
  useEffect(() => {
    if (displayName && !authorName) {
      setAuthor(displayName, authorAge)
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
          <User size={40} className="text-galaxy-secondary" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          {t('wizard:author.heading')}
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          {t('wizard:author.subtitle')}
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-md space-y-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Name input */}
        <div>
          <label className="block text-galaxy-text font-body font-semibold mb-2 text-sm">
            {t('wizard:author.name_label')}
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthor(e.target.value, authorAge)}
            placeholder={t('wizard:author.name_placeholder')}
            className="w-full px-6 py-4 text-xl font-heading text-center glass border-2 border-galaxy-secondary/30 rounded-2xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none focus:shadow-glow-cyan transition-all"
            maxLength={30}
          />
        </div>

        {/* Age selector */}
        <div>
          <label className="block text-galaxy-text font-body font-semibold mb-3 text-sm">
            <Trans
              i18nKey="wizard:author.age_label"
              values={{ age: formatNumber(authorAge) }}
              components={{ v: <span className="text-galaxy-secondary text-lg" /> }}
            />
          </label>
          <div className="flex flex-wrap justify-center gap-2">
            {[5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
              <motion.button
                key={age}
                onClick={() => setAuthor(authorName, age)}
                className={`w-12 h-12 rounded-full font-heading font-bold text-lg transition-all cursor-pointer ${
                  authorAge === age
                    ? 'bg-galaxy-secondary text-white shadow-glow-cyan'
                    : 'glass text-galaxy-text-muted border border-galaxy-text-muted/20 hover:border-galaxy-secondary/50'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {formatNumber(age)}
              </motion.button>
            ))}
          </div>
          <p className="text-center text-galaxy-text-muted text-xs mt-2 font-body">
            {authorAge <= LITTLE_STAR_MAX_AGE
              ? t('wizard:author.mode_little_star')
              : t('wizard:author.mode_big_star')}
          </p>
        </div>
      </motion.div>

      {/* Preview card */}
      {authorName && (
        <motion.div
          className="glass rounded-2xl p-6 border border-galaxy-secondary/20 w-full max-w-sm text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-galaxy-text-muted text-xs font-body uppercase tracking-widest mb-1">
            {t('wizard:author.written_by_label')}
          </p>
          <p className="font-heading text-xl font-bold text-galaxy-text">
            {t('wizard:author.byline', { name: authorName, age: formatNumber(authorAge) })}
          </p>
        </motion.div>
      )}

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary" size="default">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> {t('common:actions.back')}
          </span>
        </SparkleButton>
        <SparkleButton
          onClick={onNext}
          disabled={!authorName.trim()}
          size="default"
        >
          {t('wizard:actions.next_step')}
        </SparkleButton>
      </div>
    </div>
  )
}
