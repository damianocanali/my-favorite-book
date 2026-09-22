import { useTranslation } from 'react-i18next'
import { formatPriceCents, formatLabelKey } from '../../lib/printPricing'
import { formatNumber } from '../../i18n/formats'

export default function OrderSummaryTable({ order }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-galaxy-text-muted/20 overflow-hidden">
      <Row label={t('print:summary.format')}   value={t(formatLabelKey(order.format))} />
      <Row label={t('print:summary.quantity')} value={formatNumber(order.quantity)} />
      <Row label={t('print:summary.subtotal')} value={formatPriceCents(order.unit_price_cents * order.quantity)} />
      <Row label={t('print:summary.shipping')} value={formatPriceCents(order.shipping_cents)} />
      <Row label={t('print:summary.tax')}      value={formatPriceCents(order.tax_cents)} />
      <Row label={t('print:summary.total')}    value={formatPriceCents(order.total_cents)} bold />
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 text-sm border-b border-galaxy-text-muted/10 last:border-b-0 ${bold ? 'font-bold text-galaxy-text glass' : 'text-galaxy-text-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums text-galaxy-text">{value}</span>
    </div>
  )
}
