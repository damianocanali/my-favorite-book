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
          // Was the one light surface in an otherwise dark app. Now the
          // iOS modal recipe: 24px radius, purple-gradient fill, purple glow.
          className="relative w-full max-w-md rounded-modal p-6 max-h-[90vh] overflow-y-auto text-white bg-gradient-to-br from-[#38246B] to-[#662E80] shadow-glow-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          <h2 className="font-heading text-xl font-bold mb-4">Payment</h2>

          {!stripe || !clientSecret ? (
            <div className="flex items-center justify-center py-12 text-white/60">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <Elements
              stripe={stripe}
              options={{
                clientSecret,
                // Match the surrounding dark modal so Stripe's iframe
                // doesn't punch a white rectangle through it.
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#BF5AF2',
                    colorBackground: '#2C204C',
                    colorText: '#FFFFFF',
                    colorDanger: '#FF453A',
                    borderRadius: '12px',
                    fontFamily: 'Nunito, system-ui, sans-serif',
                  },
                },
              }}
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
        className="mt-4 w-full py-3 rounded-full border-[1.5px] border-white/30 bg-gradient-to-b from-btn-primary-from to-btn-primary-to text-white font-heading font-bold shadow-glow-purple transition-shadow hover:shadow-[0_8px_34px_rgba(191,90,242,0.7)] disabled:opacity-50"
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
