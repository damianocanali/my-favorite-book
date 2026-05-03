const STATUS_META = {
  pending:       { label: 'Order received',    cls: 'bg-galaxy-text-muted/20 text-galaxy-text-muted' },
  paid:          { label: 'Payment confirmed', cls: 'bg-cyan-500/15 text-cyan-300' },
  pdf_ready:     { label: 'Preparing files',   cls: 'bg-cyan-500/15 text-cyan-300' },
  submitted:     { label: 'Sent to printer',   cls: 'bg-galaxy-primary/20 text-galaxy-primary' },
  in_production: { label: 'Being printed',     cls: 'bg-galaxy-primary/20 text-galaxy-primary' },
  shipped:       { label: 'Shipped!',          cls: 'bg-green-500/15 text-green-400' },
  delivered:     { label: 'Delivered',         cls: 'bg-green-500/15 text-green-400' },
  failed:        { label: 'Problem',           cls: 'bg-red-500/15 text-red-400' },
  refunded:      { label: 'Refunded',          cls: 'bg-yellow-500/15 text-yellow-300' },
}

export default function OrderStatusPill({ status }) {
  const meta = STATUS_META[status] ?? { label: status, cls: 'bg-galaxy-text-muted/20 text-galaxy-text-muted' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}
