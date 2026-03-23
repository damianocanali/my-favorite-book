import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PageFlipControls({ flipBookRef, currentPage, totalPages }) {
  const handlePrev = () => {
    flipBookRef.current?.pageFlip()?.flipPrev()
  }

  const handleNext = () => {
    flipBookRef.current?.pageFlip()?.flipNext()
  }

  return (
    <div className="flex items-center gap-6">
      <motion.button
        onClick={handlePrev}
        disabled={currentPage === 0}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          currentPage === 0
            ? 'bg-galaxy-bg-light text-galaxy-text-muted/30 cursor-not-allowed'
            : 'bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30 border border-galaxy-primary/30'
        }`}
        whileHover={currentPage > 0 ? { scale: 1.1 } : {}}
        whileTap={currentPage > 0 ? { scale: 0.9 } : {}}
      >
        <ChevronLeft size={24} />
      </motion.button>

      <span className="text-galaxy-text-muted text-sm font-body">
        {currentPage + 1} / {totalPages}
      </span>

      <motion.button
        onClick={handleNext}
        disabled={currentPage >= totalPages - 1}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          currentPage >= totalPages - 1
            ? 'bg-galaxy-bg-light text-galaxy-text-muted/30 cursor-not-allowed'
            : 'bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30 border border-galaxy-primary/30'
        }`}
        whileHover={currentPage < totalPages - 1 ? { scale: 1.1 } : {}}
        whileTap={currentPage < totalPages - 1 ? { scale: 0.9 } : {}}
      >
        <ChevronRight size={24} />
      </motion.button>
    </div>
  )
}
