import { Check, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// `key` is the print_orders status enum — wire contract, never translated.
// The step wording is deliberately its own print:timeline.* set: the pill says
// "Payment confirmed", the timeline step says "Payment received".
const STEPS = ['paid', 'pdf_ready', 'submitted', 'in_production', 'shipped', 'delivered']

const ORDER_INDEX = STEPS.reduce((m, s, i) => ((m[s] = i), m), {})

export default function StatusTimeline({ status }) {
  const { t } = useTranslation()

  if (status === 'failed' || status === 'refunded') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-body font-semibold text-sm">
            {status === 'failed' ? t('print:timeline.failed_title') : t('print:timeline.refunded_title')}
          </p>
          <p className="text-red-300/80 text-xs mt-1">{t('print:timeline.problem_help')}</p>
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
          <li key={step} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-galaxy-primary text-white' : 'glass text-galaxy-text-muted'}`}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-sm ${done ? 'text-galaxy-text font-semibold' : 'text-galaxy-text-muted'}`}>
              {t(`print:timeline.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
