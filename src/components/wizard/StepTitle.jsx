import { motion } from 'motion/react'
import { BookOpen } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import SparkleButton from '../ui/SparkleButton'

export default function StepTitle({ onNext }) {
  const title = useBookStore((state) => state.book?.title ?? '')
  const setTitle = useBookStore((state) => state.setTitle)

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-primary/20 flex items-center justify-center">
          <BookOpen size={40} className="text-galaxy-primary" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Name Your Book
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          Every great story starts with a great title!
        </p>
      </motion.div>

      {/* Title input with live preview */}
      <motion.div
        className="w-full max-w-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Amazing Adventure..."
          className="w-full px-6 py-4 text-xl font-heading text-center bg-galaxy-bg-light border-2 border-galaxy-primary/30 rounded-2xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-primary focus:outline-none focus:shadow-glow-purple transition-all"
          maxLength={60}
          autoFocus
        />
        <p className="text-center text-galaxy-text-muted text-sm mt-2 font-body">
          {title.length}/60 characters
        </p>
      </motion.div>

      {/* Live preview */}
      {title && (
        <motion.div
          className="relative bg-galaxy-bg-light rounded-2xl p-8 border border-galaxy-primary/20 w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-galaxy-primary/5 to-galaxy-accent/5" />
          <div className="relative text-center">
            <p className="text-galaxy-text-muted text-xs font-body uppercase tracking-widest mb-2">
              Preview
            </p>
            <h3 className="font-heading text-2xl font-bold text-galaxy-text">
              {title}
            </h3>
            <div className="w-16 h-0.5 bg-galaxy-primary/50 mx-auto mt-3" />
          </div>
        </motion.div>
      )}

      <SparkleButton
        onClick={onNext}
        disabled={!title.trim()}
        size="large"
      >
        Next Step →
      </SparkleButton>
    </div>
  )
}
