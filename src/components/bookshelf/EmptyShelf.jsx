import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import SparkleButton from '../ui/SparkleButton'

export default function EmptyShelf() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="text-center py-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="w-24 h-24 mx-auto mb-6 rounded-full bg-galaxy-primary/10 flex items-center justify-center"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <BookOpen size={48} className="text-galaxy-primary/50" />
      </motion.div>
      <h3 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
        Your Bookshelf is Empty
      </h3>
      <p className="text-galaxy-text-muted font-body mb-8 max-w-sm mx-auto">
        You haven't created any books yet. Start your first adventure!
      </p>
      <SparkleButton onClick={() => navigate('/create')} size="large">
        Create Your First Book ✨
      </SparkleButton>
    </motion.div>
  )
}
