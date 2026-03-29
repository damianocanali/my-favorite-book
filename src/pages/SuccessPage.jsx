import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { CheckCircle, BookOpen, Sparkles } from 'lucide-react'
import SparkleButton from '../components/ui/SparkleButton'

export default function SuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [countdown, setCountdown] = useState(5)

  // Auto-redirect after 5 seconds
  useEffect(() => {
    if (countdown <= 0) {
      navigate('/create')
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, navigate])

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full bg-galaxy-primary/20 flex items-center justify-center mb-6"
      >
        <CheckCircle size={48} className="text-galaxy-primary" />
      </motion.div>

      <motion.h1
        className="font-heading text-4xl sm:text-5xl font-bold text-galaxy-text mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        You're all set! 🎉
      </motion.h1>

      <motion.p
        className="text-galaxy-text-muted font-body text-xl mb-2 max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Your subscription is active. Time to create something amazing!
      </motion.p>

      {sessionId && (
        <motion.p
          className="text-galaxy-text-muted/50 font-body text-xs mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Order confirmed · {sessionId.slice(-8).toUpperCase()}
        </motion.p>
      )}

      <motion.div
        className="flex flex-col sm:flex-row items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <SparkleButton onClick={() => navigate('/create')} size="large" variant="primary">
          <span className="flex items-center gap-2">
            <BookOpen size={20} /> Create a Book
          </span>
        </SparkleButton>

        <SparkleButton onClick={() => navigate('/bookshelf')} size="large" variant="secondary">
          <span className="flex items-center gap-2">
            <Sparkles size={20} /> My Bookshelf
          </span>
        </SparkleButton>
      </motion.div>

      <motion.p
        className="text-galaxy-text-muted/60 font-body text-sm mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Redirecting in {countdown}s…
      </motion.p>
    </div>
  )
}
