// src/pages/PrintOrderPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'

import { useAuthStore } from '../stores/useAuthStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { usePrintOrderStore } from '../stores/usePrintOrderStore'
import { apiFetchAuthed } from '../lib/api'
import { PRINT_PRICES, FLAT_SHIPPING_CENTS, totalCents, formatPriceCents } from '../lib/printPricing'
import { pay } from '../services/printPaymentService'

import PrintableBook from '../components/print/PrintableBook'
import FormatCard from '../components/print/FormatCard'
import QuantityStepper from '../components/print/QuantityStepper'
import PaymentSheetModal from '../components/print/PaymentSheetModal'
import ParentalGate from '../components/ui/ParentalGate'

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export default function PrintOrderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()

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
        <Link to="/login" className="underline">Please log in to continue.</Link>
      </Centered>
    )
  }
  if (!book) {
    return (
      <Centered>
        <p className="text-galaxy-text-muted">Book not found.</p>
        <Link to="/bookshelf" className="underline mt-2">Back to bookshelf</Link>
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
          setError(result.error || 'Payment failed')
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
    <div className="min-h-screen bg-galaxy-bg text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 -ml-2 hover:bg-galaxy-bg-light rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading text-2xl font-bold">Order a print</h1>
        </header>

        {/* Preview */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Preview</h2>
          <div className="rounded-xl border border-galaxy-text-muted/20 bg-white max-h-[60vh] overflow-y-auto">
            <PrintableBook book={book} visible />
          </div>
          <p className="text-xs text-galaxy-text-muted mt-2">Scroll through every page to confirm before printing.</p>
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
            <span className="text-sm">I've reviewed every page</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={store.finishedChecked}
              onChange={(e) => store.setChecks({ finishedChecked: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-galaxy-text-muted/40"
            />
            <span className="text-sm">This book is finished and ready to print</span>
          </label>
        </section>

        {/* Format */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Format</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormatCard
              format="hardcover"
              label="Hardcover"
              price={PRINT_PRICES.hardcover.label}
              deliveryDays={PRINT_PRICES.hardcover.deliveryDays}
              selected={store.format === 'hardcover'}
              onSelect={store.setFormat}
            />
            <FormatCard
              format="softcover"
              label="Softcover"
              price={PRINT_PRICES.softcover.label}
              deliveryDays={PRINT_PRICES.softcover.deliveryDays}
              selected={store.format === 'softcover'}
              onSelect={store.setFormat}
            />
          </div>
        </section>

        {/* Quantity */}
        <section className="mb-8 flex items-center justify-between">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted">Quantity</h2>
          <QuantityStepper value={store.quantity} onChange={store.setQuantity} />
        </section>

        {/* Shipping */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Shipping</h2>
          <ShippingFields store={store} />
        </section>

        {/* Totals */}
        <section className="mb-8 p-4 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10">
          <Row label={`${store.quantity} × ${PRINT_PRICES[store.format].label} ${store.format}`} value={formatPriceCents(subtotal)} />
          <Row label="Shipping" value={formatPriceCents(FLAT_SHIPPING_CENTS)} />
          <Row label="Tax" value="$0.00" />
          <div className="h-px bg-galaxy-text-muted/20 my-2" />
          <Row label="Total" value={formatPriceCents(total)} bold />
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
              : 'bg-galaxy-bg-light text-galaxy-text-muted cursor-not-allowed'
          }`}
        >
          {store.submitting ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Processing…</span>
          ) : (
            <>Continue to payment · {formatPriceCents(total)}</>
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

function ShippingFields({ store }) {
  const sh = store.shipping
  const set = (patch) => store.setShipping(patch)
  const input = 'w-full px-3 py-2.5 rounded-lg bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:outline-none focus:border-galaxy-primary'
  return (
    <div className="grid grid-cols-2 gap-3">
      <input className={`${input} col-span-2`} placeholder="Full name" value={sh.name} onChange={(e) => set({ name: e.target.value })} />
      <input className={`${input} col-span-2`} placeholder="Address" value={sh.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
      <input className={`${input} col-span-2`} placeholder="Apt, suite, etc. (optional)" value={sh.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
      <input className={input} placeholder="City" value={sh.city} onChange={(e) => set({ city: e.target.value })} />
      <input className={input} placeholder="State (e.g. TX)" maxLength={2} value={sh.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} />
      <input className={input} placeholder="ZIP" value={sh.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
      <input className={input} type="tel" placeholder="Phone" value={sh.phone} onChange={(e) => set({ phone: e.target.value })} />
      <input className={`${input} col-span-2`} type="email" placeholder="Email" value={sh.email} onChange={(e) => set({ email: e.target.value })} />
    </div>
  )
}
