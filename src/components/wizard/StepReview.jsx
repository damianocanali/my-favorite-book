import { motion } from 'motion/react'
import { Sparkles, ChevronLeft, Edit3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBookStore } from '../../stores/useBookStore'
import { displayName } from '../../i18n/contentCatalog'
import { formatNumber } from '../../i18n/formats'
import SparkleButton from '../ui/SparkleButton'

export default function StepReview({ onPrev, onFinish }) {
  const { t } = useTranslation()
  const book = useBookStore((state) => state.book)
  const setStep = useBookStore((state) => state.setStep)

  if (!book) return null

  // `${emoji} ${name}` is one interpolated key so a translation can reorder it.
  const entry = (emoji, name) => t('wizard:review.entry', { emoji, name })

  const sections = [
    { id: 'title', label: t('wizard:progress.title'), value: book.title, step: 0, emoji: '📖' },
    {
      id: 'author',
      label: t('wizard:progress.author'),
      value: t('wizard:author.byline', {
        name: book.authorName,
        age: formatNumber(book.authorAge),
      }),
      step: 1,
      emoji: '✍️',
    },
    {
      id: 'colors',
      label: t('wizard:progress.colors'),
      value: book.colors?.palette === 'custom'
        ? t('wizard:review.custom_colors')
        : book.colors?.palette,
      step: 2,
      emoji: '🎨',
      render: () => (
        <div className="flex gap-2 mt-1">
          <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: book.colors?.cover }} />
          <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: book.colors?.accent }} />
        </div>
      ),
    },
    {
      id: 'characters',
      label: t('wizard:progress.characters'),
      value: book.characters
        ?.map((c) => entry(c.emoji, displayName(c, t, 'characters')))
        .join(', '),
      step: 3,
      emoji: '👥',
    },
    {
      id: 'setting',
      label: t('wizard:progress.setting'),
      value: book.setting
        ? entry(book.setting.emoji, displayName(book.setting, t, 'scenes'))
        : t('wizard:review.none'),
      step: 4,
      emoji: '🗺️',
    },
    {
      id: 'time',
      label: t('wizard:progress.time'),
      value: book.timePeriod
        ? entry(book.timePeriod.emoji, displayName(book.timePeriod, t, 'time_periods'))
        : t('wizard:review.none'),
      step: 5,
      emoji: '⏰',
    },
  ]

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-accent/20 flex items-center justify-center">
          <Sparkles size={40} className="text-galaxy-accent" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          {t('wizard:review.heading')}
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          {t('wizard:review.subtitle')}
        </p>
      </motion.div>

      {/* Summary cards */}
      <motion.div
        className="w-full max-w-md space-y-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {sections.map((section, i) => (
          <motion.div
            key={section.id}
            className="flex items-center gap-4 glass rounded-xl p-4 border border-galaxy-text-muted/10"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 * i }}
          >
            <span className="text-2xl">{section.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-galaxy-text-muted text-xs font-body uppercase tracking-wider">
                {section.label}
              </p>
              <p className="text-galaxy-text font-body font-semibold truncate">
                {section.value}
              </p>
              {section.render?.()}
            </div>
            <button
              onClick={() => setStep(section.step)}
              className="text-galaxy-text-muted hover:text-galaxy-secondary transition-colors cursor-pointer p-1"
              title={t('wizard:review.edit_aria', { section: section.label })}
            >
              <Edit3 size={16} />
            </button>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> {t('common:actions.back')}
          </span>
        </SparkleButton>
        <SparkleButton onClick={onFinish} variant="accent" size="large">
          <span className="flex items-center gap-2">
            <Sparkles size={20} /> {t('wizard:review.start_writing')}
          </span>
        </SparkleButton>
      </div>
    </div>
  )
}
