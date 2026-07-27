// src/pages/OrderDetailPage.jsx
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { useOrderPolling } from '../hooks/useOrderPolling'
import OrderStatusPill from '../components/print/OrderStatusPill'
import StatusTimeline from '../components/print/StatusTimeline'
import OrderSummaryTable from '../components/print/OrderSummaryTable'

export default function OrderDetailPage() {
  const { id } = useParams()
  const { order, error, loading } = useOrderPolling(id)

  if (loading) {
    return <Centered><Loader2 className="animate-spin text-galaxy-text-muted" /></Centered>
  }
  if (error || !order) {
    return (
      <Centered>
        <AlertTriangle className="text-red-400 mb-2" />
        <p className="text-galaxy-text-muted text-sm">{error || 'Order not found'}</p>
        <Link to="/orders" className="underline text-sm mt-3">All orders</Link>
      </Centered>
    )
  }

  const shortId = order.id.slice(-8).toUpperCase()
  const supportSubject = encodeURIComponent(`Help with print order ${shortId}`)
  const supportBody = encodeURIComponent(`Order ID: ${order.id}\n\nWhat happened: `)

  return (
    <div className="min-h-screen text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <Link to="/orders" aria-label="Back" className="p-2 -ml-2 hover:bg-galaxy-bg-light rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold truncate">Order #{shortId}</h1>
          </div>
          <div className="ml-auto"><OrderStatusPill status={order.status} /></div>
        </header>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Progress</h2>
          <StatusTimeline status={order.status} />
        </section>

        {order.lulu_tracking_url && (
          <section className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="font-body font-semibold text-green-300 mb-1">Your book is on its way!</p>
            <p className="text-xs text-galaxy-text-muted mb-3">
              {order.lulu_carrier ? `${order.lulu_carrier} · ` : ''}{order.lulu_tracking_number ?? ''}
            </p>
            <a
              href={order.lulu_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-green-300 hover:underline"
            >
              Track your package <ExternalLink size={14} />
            </a>
          </section>
        )}

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Summary</h2>
          <OrderSummaryTable order={order} />
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Shipping to</h2>
          <div className="rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10 p-4 text-sm">
            <p className="font-semibold">{order.ship_name}</p>
            <p className="text-galaxy-text-muted">{order.ship_city}, {order.ship_state} {order.ship_postal_code}</p>
          </div>
        </section>

        <a
          href={`mailto:support@mybooklab.app?subject=${supportSubject}&body=${supportBody}`}
          className="block w-full text-center py-3 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/20 text-sm hover:border-galaxy-text-muted/40 transition-colors"
        >
          Report a problem
        </a>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">{children}</div>
}
