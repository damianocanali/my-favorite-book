import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { Library, Plus, LogIn } from 'lucide-react'
import Bookshelf from '../components/bookshelf/Bookshelf'
import SparkleButton from '../components/ui/SparkleButton'
import { useAuthStore } from '../stores/useAuthStore'

export default function BookshelfPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Library size={48} className="text-galaxy-primary mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
            Sign in to see your bookshelf
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6 max-w-sm">
            Create a free account to save your books and access them from any device.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-6 py-3 rounded-xl font-body font-bold text-white bg-galaxy-primary hover:bg-galaxy-primary/90 transition-colors"
            >
              Create free account
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/30 hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors"
            >
              <LogIn size={16} /> Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Library size={28} className="text-galaxy-primary" />
          <h1 className="font-heading text-3xl font-bold text-galaxy-text">
            My Bookshelf
          </h1>
        </div>
        <SparkleButton
          onClick={() => navigate('/create')}
          size="small"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} /> New Book
          </span>
        </SparkleButton>
      </motion.div>

      {/* Bookshelf */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Bookshelf />
      </motion.div>
    </div>
  )
}
