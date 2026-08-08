// src/components/print/BookFinishedModal.jsx
// Celebratory overlay shown after a book is "finished". Primary action is
// Order a print →, secondary is Maybe later. Stays out of the way unless
// `open` is true.
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BookFinishedModal({ book, open, onClose }) {
  const navigate = useNavigate()
  // Portalled and unmounted synchronously, for the same reason as
  // WelcomeBackMoment: gating removal of a screen-covering,
  // pointer-eating layer on an exit animation strands it permanently if
  // that animation is ever interrupted. PaymentSheetModal already got
  // this right with an early `if (!open) return null`.
  if (!open) return null

  return createPortal(
    <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md rounded-modal p-6 text-center bg-gradient-to-br from-[#38246B] to-[#662E80] shadow-glow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-galaxy-text-muted hover:bg-galaxy-bg">
              <X size={18} />
            </button>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-heading text-2xl font-bold text-galaxy-text">Your book is done!</h2>
            <p className="text-galaxy-text-muted mt-2 text-sm">You can order a real printed copy and hold it in your hands.</p>
            <button
              onClick={() => navigate(`/order/${book?.id}`)}
              disabled={!book?.id}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-fill-primary font-heading font-bold transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} /> Order a print →
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2.5 text-sm text-galaxy-text-muted hover:text-galaxy-text">
              Maybe later
            </button>
          </motion.div>
        </motion.div>
    </>,
    document.body
  )
}
