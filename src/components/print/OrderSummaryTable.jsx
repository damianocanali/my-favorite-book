import { formatPriceCents } from '../../lib/printPricing'

export default function OrderSummaryTable({ order }) {
  return (
    <div className="rounded-xl border border-galaxy-text-muted/20 overflow-hidden">
      <Row label="Format"   value={order.format} />
      <Row label="Quantity" value={order.quantity} />
      <Row label="Subtotal" value={formatPriceCents(order.unit_price_cents * order.quantity)} />
      <Row label="Shipping" value={formatPriceCents(order.shipping_cents)} />
      <Row label="Tax"      value={formatPriceCents(order.tax_cents)} />
      <Row label="Total"    value={formatPriceCents(order.total_cents)} bold />
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 text-sm border-b border-galaxy-text-muted/10 last:border-b-0 ${bold ? 'font-bold text-galaxy-text bg-galaxy-bg-light' : 'text-galaxy-text-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums text-galaxy-text">{value}</span>
    </div>
  )
}
