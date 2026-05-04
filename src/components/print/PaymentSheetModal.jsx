// Stripe PaymentElement modal for the web payment flow. iOS uses the native
// Capacitor PaymentSheet via printPaymentService.pay; web needs Stripe.js
// Elements + PaymentElement to collect card details before confirming the
// PaymentIntent. confirmPayment redirects to return_url on success.
import { useEffect, useState } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, X, AlertTriangle } from 'lucide-react'
import { getStripe } from '../../lib/stripe'

export default function PaymentSheetModal({ open, clientSecret, returnUrl, onClose }) {
  const [stripe, setStripe] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getStripe().then((s) => { if (!cancelled) setStripe(s) })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative w-full max-w-md bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
          <h2 className="font-heading text-xl font-bold mb-4">Payment</h2>

          {!stripe || !clientSecret ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <Elements
              stripe={stripe}
              options={{ clientSecret, appearance: { theme: 'stripe' } }}
            >
              <PaymentForm returnUrl={returnUrl} />
            </Elements>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function PaymentForm({ returnUrl }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    // Stripe redirects on success — code below only runs on failure.
    if (error) setError(error.message ?? 'Payment failed')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="mt-4 w-full py-3 rounded-xl bg-purple-600 text-white font-heading font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Processing…
          </span>
        ) : (
          'Pay'
        )}
      </button>
    </form>
  )
}
