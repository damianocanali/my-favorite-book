import { motion } from 'motion/react'
import { Sparkles, ChevronLeft, Edit3 } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import SparkleButton from '../ui/SparkleButton'

export default function StepReview({ onPrev, onFinish }) {
  const book = useBookStore((state) => state.book)
  const setStep = useBookStore((state) => state.setStep)

  if (!book) return null

  const sections = [
    { label: 'Title', value: book.title, step: 0, emoji: '📖' },
    { label: 'Author', value: `${book.authorName}, age ${book.authorAge}`, step: 1, emoji: '✍️' },
    {
      label: 'Colors',
      value: book.colors?.palette === 'custom' ? 'Custom Colors' : book.colors?.palette,
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
      label: 'Characters',
      value: book.characters?.map((c) => `${c.emoji} ${c.name}`).join(', '),
      step: 3,
      emoji: '👥',
    },
    {
      label: 'Setting',
      value: book.setting ? `${book.setting.emoji} ${book.setting.name}` : 'None',
      step: 4,
      emoji: '🗺️',
    },
    {
      label: 'Time',
      value: book.timePeriod ? `${book.timePeriod.emoji} ${book.timePeriod.label}` : 'None',
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
          Your Story Awaits!
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          Here's everything you've chosen. Ready to start writing?
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
            key={section.label}
            className="flex items-center gap-4 bg-galaxy-bg-light rounded-xl p-4 border border-galaxy-text-muted/10"
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
              title={`Edit ${section.label}`}
            >
              <Edit3 size={16} />
            </button>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> Back
          </span>
        </SparkleButton>
        <SparkleButton onClick={onFinish} variant="accent" size="large">
          <span className="flex items-center gap-2">
            <Sparkles size={20} /> Start Writing!
          </span>
        </SparkleButton>
      </div>
    </div>
  )
}
