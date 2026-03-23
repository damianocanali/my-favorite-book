import { motion } from 'motion/react'
import { User, ChevronLeft } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import SparkleButton from '../ui/SparkleButton'

export default function StepAuthor({ onNext, onPrev }) {
  const book = useBookStore((state) => state.book)
  const setAuthor = useBookStore((state) => state.setAuthor)

  const authorName = book?.authorName ?? ''
  const authorAge = book?.authorAge ?? 8

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
          Who's the Author?
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          That's YOU! Tell us about yourself.
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
            Your Name
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthor(e.target.value, authorAge)}
            placeholder="What's your name?"
            className="w-full px-6 py-4 text-xl font-heading text-center bg-galaxy-bg-light border-2 border-galaxy-secondary/30 rounded-2xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none focus:shadow-glow-cyan transition-all"
            maxLength={30}
          />
        </div>

        {/* Age selector */}
        <div>
          <label className="block text-galaxy-text font-body font-semibold mb-3 text-sm">
            Your Age: <span className="text-galaxy-secondary text-lg">{authorAge}</span>
          </label>
          <div className="flex flex-wrap justify-center gap-2">
            {[5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
              <motion.button
                key={age}
                onClick={() => setAuthor(authorName, age)}
                className={`w-12 h-12 rounded-full font-heading font-bold text-lg transition-all cursor-pointer ${
                  authorAge === age
                    ? 'bg-galaxy-secondary text-white shadow-glow-cyan'
                    : 'bg-galaxy-bg-light text-galaxy-text-muted border border-galaxy-text-muted/20 hover:border-galaxy-secondary/50'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {age}
              </motion.button>
            ))}
          </div>
          <p className="text-center text-galaxy-text-muted text-xs mt-2 font-body">
            {authorAge <= 7
              ? '✨ Little Star Mode — bigger text, simpler choices!'
              : '🌟 Big Star Mode — more writing freedom!'}
          </p>
        </div>
      </motion.div>

      {/* Preview card */}
      {authorName && (
        <motion.div
          className="bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-secondary/20 w-full max-w-sm text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-galaxy-text-muted text-xs font-body uppercase tracking-widest mb-1">
            Written by
          </p>
          <p className="font-heading text-xl font-bold text-galaxy-text">
            {authorName}, age {authorAge}
          </p>
        </motion.div>
      )}

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary" size="default">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> Back
          </span>
        </SparkleButton>
        <SparkleButton
          onClick={onNext}
          disabled={!authorName.trim()}
          size="default"
        >
          Next Step →
        </SparkleButton>
      </div>
    </div>
  )
}
