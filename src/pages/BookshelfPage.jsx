import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Library, Plus } from 'lucide-react'
import Bookshelf from '../components/bookshelf/Bookshelf'
import SparkleButton from '../components/ui/SparkleButton'

export default function BookshelfPage() {
  const navigate = useNavigate()

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
