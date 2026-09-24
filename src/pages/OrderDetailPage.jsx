// src/pages/OrderDetailPage.jsx
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOrderPolling } from '../hooks/useOrderPolling'
import OrderStatusPill from '../components/print/OrderStatusPill'
import StatusTimeline from '../components/print/StatusTimeline'
import OrderSummaryTable from '../components/print/OrderSummaryTable'

export default function OrderDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { order, error, loading } = useOrderPolling(id)

  if (loading) {
    return <Centered><Loader2 className="animate-spin text-galaxy-text-muted" /></Centered>
  }
  // Guard on the id, not just on `order`. An endpoint that answers with a
  // truthy but empty object — a stale order id, or a response shape we
  // didn't expect — used to sail past a plain `!order` check and then
  // throw on order.id.slice(), white-screening the page.
  if (error || !order?.id) {
    return (
      <Centered>
        <AlertTriangle className="text-red-400 mb-2" />
        <p className="text-galaxy-text-muted text-sm">{error || t('print:detail.not_found')}</p>
        <Link to="/orders" className="underline text-sm mt-3">{t('print:detail.all_orders')}</Link>
      </Centered>
    )
  }

  const shortId = order.id.slice(-8).toUpperCase()
  const supportSubject = encodeURIComponent(t('print:detail.support_subject', { id: shortId }))
  const supportBody = encodeURIComponent(t('print:detail.support_body', { id: order.id }))

  return (
    <div className="min-h-screen text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <Link to="/orders" aria-label={t('common:actions.back')} className="p-2 -ml-2 hover:glass rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            {/* Not truncate: this heading IS the order number, so clipping it
                hides the one thing the page is identified by. Italian's
                "Ordine n. {id}" is longer than "Order #{id}", and the row also
                carries a back link and a status pill, so the English version
                fits on a 390px screen where the Italian one did not. Wrapping
                costs a line; truncating costs the order number. */}
            <h1 className="font-heading text-2xl font-bold break-words">{t('print:detail.title', { id: shortId })}</h1>
          </div>
          <div className="ml-auto"><OrderStatusPill status={order.status} /></div>
        </header>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:detail.section_progress')}</h2>
          <StatusTimeline status={order.status} />
        </section>

        {order.lulu_tracking_url && (
          <section className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="font-body font-semibold text-green-300 mb-1">{t('print:detail.shipping_title')}</p>
            <p className="text-xs text-galaxy-text-muted mb-3">
              {order.lulu_carrier
                ? t('print:detail.tracking_line', { carrier: order.lulu_carrier, number: order.lulu_tracking_number ?? '' })
                : (order.lulu_tracking_number ?? '')}
            </p>
            <a
              href={order.lulu_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-green-300 hover:underline"
            >
              {t('print:detail.track_cta')} <ExternalLink size={14} />
            </a>
          </section>
        )}

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:detail.section_summary')}</h2>
          <OrderSummaryTable order={order} />
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:detail.section_shipping_to')}</h2>
          <div className="rounded-xl glass border border-galaxy-text-muted/10 p-4 text-sm">
            <p className="font-semibold">{order.ship_name}</p>
            <p className="text-galaxy-text-muted">
              {t('print:detail.address_line', {
                city: order.ship_city,
                state: order.ship_state,
                postal_code: order.ship_postal_code,
              })}
            </p>
          </div>
        </section>

        <a
          href={`mailto:support@mybooklab.app?subject=${supportSubject}&body=${supportBody}`}
          className="block w-full text-center py-3 rounded-xl glass border border-galaxy-text-muted/20 text-sm hover:border-galaxy-text-muted/40 transition-colors"
        >
          {t('print:detail.report_problem')}
        </a>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">{children}</div>
}
