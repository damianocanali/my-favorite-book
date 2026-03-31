import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, X } from 'lucide-react'
import SparkleButton from './SparkleButton'

// Generates a multiplication problem that young children can't easily solve
function generateProblem() {
  const a = Math.floor(Math.random() * 9) + 6  // 6–14
  const b = Math.floor(Math.random() * 9) + 6  // 6–14
  return { question: `${a} × ${b}`, answer: a * b }
}

export default function ParentalGate({ onPass, onClose }) {
  const problem = useMemo(generateProblem, [])
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleCheck = () => {
    if (parseInt(input, 10) === problem.answer) {
      onPass()
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative bg-galaxy-bg-light rounded-2xl p-6 max-w-sm w-full border border-galaxy-primary/30 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-galaxy-text-muted hover:text-galaxy-text transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-galaxy-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-galaxy-primary" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-galaxy-text">Grown-ups only!</h2>
            <p className="text-galaxy-text-muted text-xs font-body">Ask a parent or guardian for help</p>
          </div>
        </div>

        <p className="text-galaxy-text font-body text-sm mb-4">
          To continue to the payment page, please solve this math problem:
        </p>

        <div className="text-center mb-4">
          <span className="font-heading text-3xl font-bold text-galaxy-primary">
            {problem.question} = ?
          </span>
        </div>

        <input
          type="number"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="Your answer"
          autoFocus
          className={`w-full px-4 py-3 bg-galaxy-bg border rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:outline-none font-body text-center text-xl transition-colors ${
            error
              ? 'border-red-400 focus:border-red-400'
              : 'border-galaxy-primary/30 focus:border-galaxy-primary'
          }`}
        />

        {error && (
          <motion.p
            className="text-red-400 text-sm font-body text-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            That's not right — try again!
          </motion.p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 transition-colors text-sm"
          >
            Cancel
          </button>
          <SparkleButton
            onClick={handleCheck}
            disabled={!input}
            size="small"
            className="flex-1"
          >
            Continue
          </SparkleButton>
        </div>
      </motion.div>
    </div>
  )
}
