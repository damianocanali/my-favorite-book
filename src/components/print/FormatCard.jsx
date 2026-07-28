import { motion } from 'motion/react'
import { Check } from 'lucide-react'

export default function FormatCard({ format, label, price, deliveryDays, selected, onSelect }) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(format)}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full p-4 rounded-xl border text-left transition-colors ${
        selected
          ? 'bg-galaxy-primary/15 border-galaxy-primary text-galaxy-text'
          : 'glass border-galaxy-text-muted/20 text-galaxy-text-muted hover:border-galaxy-text-muted/40'
      }`}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full bg-galaxy-primary text-white">
          <Check size={14} />
        </span>
      )}
      <p className="font-heading text-lg font-bold">{label}</p>
      <p className="font-body text-2xl font-bold mt-1">{price}</p>
      <p className="font-body text-xs opacity-70 mt-1">{deliveryDays} business days</p>
    </motion.button>
  )
}
