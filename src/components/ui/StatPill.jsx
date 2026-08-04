import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

// The HUD counter from the reference: rounded pill, gold border, icon +
// number, always visible. Coins and streak currently only appear on the
// Account page, so a child never sees them move — the pop on change is
// the whole point.

export default function StatPill({ icon, value, label, tone = 'gold', className = '' }) {
  const [pop, setPop] = useState(0)
  const previous = useRef(value)

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value
      setPop((n) => n + 1)
    }
  }, [value])

  const tones = {
    gold: { border: '#FFD60A', from: '#4A1E7A', to: '#7A2E96', text: '#FFE68A' },
    flame: { border: '#FF9F0A', from: '#5A2410', to: '#93431A', text: '#FFC48A' },
  }
  const t = tones[tone] ?? tones.gold

  return (
    <motion.div
      key={pop}
      initial={pop === 0 ? false : { scale: 1 }}
      animate={pop === 0 ? {} : { scale: [1, 1.25, 1] }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 ${className}`}
      style={{
        borderColor: t.border,
        backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})`,
      }}
      title={label}
    >
      <span aria-hidden className="text-base leading-none">{icon}</span>
      <span
        className="font-heading text-sm font-extrabold leading-none"
        style={{ color: t.text }}
      >
        {value}
      </span>
      <span className="sr-only">{label}</span>
    </motion.div>
  )
}
