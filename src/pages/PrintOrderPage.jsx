// src/pages/PrintOrderPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../stores/useAuthStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { usePrintOrderStore } from '../stores/usePrintOrderStore'
import { apiFetchAuthed } from '../lib/api'
import { PRINT_PRICES, FLAT_SHIPPING_CENTS, totalCents, formatPriceCents, formatLabelKey } from '../lib/printPricing'
import { pay } from '../services/printPaymentService'
import { formatNumber } from '../i18n/formats'

import PrintableBook from '../components/print/PrintableBook'
import BackMatterPreview from '../components/print/BackMatterPreview'
import FormatCard from '../components/print/FormatCard'
import QuantityStepper from '../components/print/QuantityStepper'
import PaymentSheetModal from '../components/print/PaymentSheetModal'
import ParentalGate from '../components/ui/ParentalGate'

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export default function PrintOrderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const user = useAuthStore((s) => s.user)
  const books = useBookshelfStore((s) => s.books) ?? []
  const book = books.find((b) => b.id === bookId) ?? null

  const store = usePrintOrderStore()
  const [showGate, setShowGate] = useState(false)
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [error, setError] = useState(null)

  // Pre-fill bookId + email once on mount; never overwrite user-edited values.
  useEffect(() => {
    if (store.bookId !== bookId) {
      store.setBookId(bookId)
    }
    if (!store.shipping.email && user?.email) {
      store.setShipping({ email: user.email })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, user?.email])

  if (!user) {
    return (
      <Centered>
        <Link to="/login" className="underline">{t('print:gate.login_required')}</Link>
      </Centered>
    )
  }
  if (!book) {
    return (
      <Centered>
        <p className="text-galaxy-text-muted">{t('print:gate.book_not_found')}</p>
        <Link to="/bookshelf" className="underline mt-2">{t('print:gate.back_to_bookshelf')}</Link>
      </Centered>
    )
  }

  const valid = store.isFormValid()
  const subtotal = PRINT_PRICES[store.format].cents * store.quantity
  const total = totalCents({ format: store.format, quantity: store.quantity })

  const handleContinue = () => {
    if (!valid) return
    setShowGate(true)
  }

  const submitOrder = async () => {
    setShowGate(false)
    setError(null)
    store.setSubmitting(true)
    try {
      const res = await apiFetchAuthed('/api/print-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          format: store.format,
          quantity: store.quantity,
          shipping: store.shipping,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)

      store.setOrderResult({
        orderId: body.orderId,
        clientSecret: body.clientSecret,
        totalCents: body.totalCents,
      })

      // iOS uses the native Capacitor payment sheet; web mounts Stripe
      // PaymentElement in a modal. The native sheet collects card details
      // itself; the web modal needs a separate render step.
      if (isNativeIos) {
        const returnUrl = `${window.location.origin}/orders/${body.orderId}/confirm?new=1`
        const result = await pay({ clientSecret: body.clientSecret, returnUrl })
        if (result.ok) {
          navigate(`/orders/${body.orderId}/confirm?new=1`)
        } else if (result.canceled) {
          setError(null)
        } else {
          setError(result.error || t('print:payment.failed'))
        }
      } else {
        // Web — show PaymentElement modal. confirmPayment inside the modal
        // redirects to /orders/:id/confirm?new=1 on success.
        setShowPaymentSheet(true)
      }
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      store.setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} aria-label={t('common:actions.back')} className="p-2 -ml-2 hover:glass rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading text-2xl font-bold">{t('print:order.title')}</h1>
        </header>

        {/* Preview */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:order.section_preview')}</h2>
          <div className="rounded-xl border border-galaxy-text-muted/20 bg-white max-h-[60vh] overflow-y-auto">
            <PrintableBook book={book} visible />
          </div>
          <p className="text-xs text-galaxy-text-muted mt-2">{t('print:order.preview_hint')}</p>
        </section>

        {/* What else is in the printed book — fixed back matter + padding */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:order.section_back_matter')}</h2>
          <BackMatterPreview book={book} />
        </section>

        {/* Confirmation checkboxes */}
        <section className="mb-8 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={store.reviewChecked}
              onChange={(e) => store.setChecks({ reviewChecked: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-galaxy-text-muted/40"
            />
            <span className="text-sm">{t('print:order.check_reviewed')}</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={store.finishedChecked}
              onChange={(e) => store.setChecks({ finishedChecked: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-galaxy-text-muted/40"
            />
            <span className="text-sm">{t('print:order.check_finished')}</span>
          </label>
        </section>

        {/* Format */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:order.section_format')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormatCard
              format="hardcover"
              label={t('print:format.hardcover')}
              price={formatPriceCents(PRINT_PRICES.hardcover.cents)}
              deliveryDays={PRINT_PRICES.hardcover.deliveryDays}
              selected={store.format === 'hardcover'}
              onSelect={store.setFormat}
            />
            <FormatCard
              format="softcover"
              label={t('print:format.softcover')}
              price={formatPriceCents(PRINT_PRICES.softcover.cents)}
              deliveryDays={PRINT_PRICES.softcover.deliveryDays}
              selected={store.format === 'softcover'}
              onSelect={store.setFormat}
            />
          </div>
        </section>

        {/* Quantity */}
        <section className="mb-8 flex items-center justify-between">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted">{t('print:order.section_quantity')}</h2>
          <QuantityStepper value={store.quantity} onChange={store.setQuantity} />
        </section>

        {/* Shipping */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">{t('print:order.section_shipping')}</h2>
          <ShippingFields store={store} />
        </section>

        {/* Totals */}
        <section className="mb-8 p-4 rounded-xl glass border border-galaxy-text-muted/10">
          <Row
            label={t('print:order.line_item', {
              quantity: formatNumber(store.quantity),
              price: formatPriceCents(PRINT_PRICES[store.format].cents),
              format: t(formatLabelKey(store.format)),
            })}
            value={formatPriceCents(subtotal)}
          />
          <Row label={t('print:summary.shipping')} value={formatPriceCents(FLAT_SHIPPING_CENTS)} />
          <Row label={t('print:summary.tax')} value={formatPriceCents(0)} />
          <div className="h-px bg-galaxy-text-muted/20 my-2" />
          <Row label={t('print:summary.total')} value={formatPriceCents(total)} bold />
        </section>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <motion.button
          onClick={handleContinue}
          disabled={!valid || store.submitting}
          whileTap={!valid || store.submitting ? {} : { scale: 0.98 }}
          className={`w-full py-4 rounded-xl font-heading text-lg font-bold transition-colors ${
            valid && !store.submitting
              ? 'bg-galaxy-primary text-white hover:bg-purple-500'
              : 'glass text-galaxy-text-muted cursor-not-allowed'
          }`}
        >
          {store.submitting ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />{t('print:payment.processing')}</span>
          ) : (
            t('print:order.continue_to_payment', { price: formatPriceCents(total) })
          )}
        </motion.button>
      </div>

      {showGate && (
        <ParentalGate
          onPass={submitOrder}
          onClose={() => setShowGate(false)}
        />
      )}

      <PaymentSheetModal
        open={showPaymentSheet}
        clientSecret={store.clientSecret}
        returnUrl={store.orderId ? `${window.location.origin}/orders/${store.orderId}/confirm?new=1` : ''}
        onClose={() => setShowPaymentSheet(false)}
      />
    </div>
  )
}

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>{children}</div>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between text-sm py-1 ${bold ? 'font-bold text-galaxy-text' : 'text-galaxy-text-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

const INPUT_CLASS = 'w-full px-3 py-2.5 rounded-lg glass border border-galaxy-text-muted/20 text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:outline-none focus:border-galaxy-primary'

/// Every field used to be placeholder-only. A placeholder disappears the
/// moment the field has focus — so the one moment you most need to know what
/// you are typing is the moment the hint is gone — and it is not a label as
/// far as a screen reader is concerned. Longer translations also truncate
/// inside the box. Real <label>s fix all three.
function Field({ id, label, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-body text-galaxy-text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function ShippingFields({ store }) {
  const { t } = useTranslation()
  const sh = store.shipping
  const set = (patch) => store.setShipping(patch)
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id="ship-name" label={t('print:shipping.name')} className="col-span-2">
        <input id="ship-name" className={INPUT_CLASS} autoComplete="name" value={sh.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="ship-address1" label={t('print:shipping.address_line1')} className="col-span-2">
        <input id="ship-address1" className={INPUT_CLASS} autoComplete="address-line1" value={sh.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
      </Field>
      <Field id="ship-address2" label={t('print:shipping.address_line2')} className="col-span-2">
        <input id="ship-address2" className={INPUT_CLASS} autoComplete="address-line2" value={sh.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
      </Field>
      <Field id="ship-city" label={t('print:shipping.city')}>
        <input id="ship-city" className={INPUT_CLASS} autoComplete="address-level2" value={sh.city} onChange={(e) => set({ city: e.target.value })} />
      </Field>
      <Field id="ship-state" label={t('print:shipping.state')}>
        <input id="ship-state" className={INPUT_CLASS} autoComplete="address-level1" placeholder={t('print:shipping.state_placeholder')} maxLength={2} value={sh.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} />
      </Field>
      <Field id="ship-postal" label={t('print:shipping.postal_code')}>
        <input id="ship-postal" className={INPUT_CLASS} autoComplete="postal-code" value={sh.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
      </Field>
      <Field id="ship-phone" label={t('print:shipping.phone')}>
        <input id="ship-phone" className={INPUT_CLASS} type="tel" autoComplete="tel" value={sh.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field id="ship-email" label={t('print:shipping.email')} className="col-span-2">
        <input id="ship-email" className={INPUT_CLASS} type="email" autoComplete="email" value={sh.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
    </div>
  )
}
