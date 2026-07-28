import { Minus, Plus } from 'lucide-react'

export default function QuantityStepper({ value, onChange, min = 1, max = 10 }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="inline-flex items-center gap-3 glass border border-galaxy-text-muted/20 rounded-xl p-1">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-galaxy-text disabled:opacity-30 hover:bg-galaxy-bg transition-colors"
      >
        <Minus size={16} />
      </button>
      <span className="w-6 text-center font-body font-bold text-galaxy-text tabular-nums">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-galaxy-text disabled:opacity-30 hover:bg-galaxy-bg transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
