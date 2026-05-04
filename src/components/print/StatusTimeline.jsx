import { Check, AlertTriangle } from 'lucide-react'

const STEPS = [
  { key: 'paid',          label: 'Payment received' },
  { key: 'pdf_ready',     label: 'Files prepared' },
  { key: 'submitted',     label: 'Sent to printer' },
  { key: 'in_production', label: 'Being printed' },
  { key: 'shipped',       label: 'Shipped' },
  { key: 'delivered',     label: 'Delivered' },
]

const ORDER_INDEX = STEPS.reduce((m, s, i) => ((m[s.key] = i), m), {})

export default function StatusTimeline({ status }) {
  if (status === 'failed' || status === 'refunded') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-body font-semibold text-sm">
            {status === 'failed' ? 'There was a problem with your order' : 'Order refunded'}
          </p>
          <p className="text-red-300/80 text-xs mt-1">If you have questions, tap "Report a problem" below.</p>
        </div>
      </div>
    )
  }
  const currentIdx = ORDER_INDEX[status] ?? -1
  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-galaxy-primary text-white' : 'bg-galaxy-bg-light text-galaxy-text-muted'}`}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-sm ${done ? 'text-galaxy-text font-semibold' : 'text-galaxy-text-muted'}`}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
