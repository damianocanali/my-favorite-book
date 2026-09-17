import { useTranslation } from 'react-i18next'

// Keys are the `status` enum stored in print_orders — the wire contract with
// api/print-orders. They index both the colour and the print:status.* label,
// so they stay untranslated on purpose.
const STATUS_CLASS = {
  pending:       'bg-galaxy-text-muted/20 text-galaxy-text-muted',
  paid:          'bg-cyan-500/15 text-cyan-300',
  pdf_ready:     'bg-cyan-500/15 text-cyan-300',
  submitted:     'bg-galaxy-primary/20 text-galaxy-primary',
  in_production: 'bg-galaxy-primary/20 text-galaxy-primary',
  shipped:       'bg-green-500/15 text-green-400',
  delivered:     'bg-green-500/15 text-green-400',
  failed:        'bg-red-500/15 text-red-400',
  refunded:      'bg-yellow-500/15 text-yellow-300',
}

const FALLBACK_CLASS = 'bg-galaxy-text-muted/20 text-galaxy-text-muted'

export default function OrderStatusPill({ status }) {
  const { t } = useTranslation()
  const known = Object.prototype.hasOwnProperty.call(STATUS_CLASS, status)
  // An enum value we don't know yet used to render raw ("in_production") in
  // the pill. It now falls back to a human sentence instead.
  const label = known ? t(`print:status.${status}`) : t('print:status.unknown')
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${known ? STATUS_CLASS[status] : FALLBACK_CLASS}`}>
      {label}
    </span>
  )
}
