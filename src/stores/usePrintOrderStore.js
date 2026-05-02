import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const EMPTY_SHIPPING = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  email: '',
  phone: '',
  country: 'US',
}

const INITIAL = {
  bookId: null,
  format: 'hardcover',
  quantity: 1,
  shipping: EMPTY_SHIPPING,
  reviewChecked: false,
  finishedChecked: false,
  // Ephemeral — cleared on reset, excluded from persist:
  orderId: null,
  clientSecret: null,
  totalCents: null,
  submitting: false,
  error: null,
}

const STATE_RE = /^[A-Z]{2}$/
const ZIP_RE = /^\d{5}(-\d{4})?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const usePrintOrderStore = create(
  persist(
    (set, get) => ({
      ...INITIAL,

      setBookId: (bookId) => set({ bookId }),

      setFormat: (format) => set({ format }),

      setQuantity: (quantity) =>
        set({ quantity: Math.max(1, Math.min(10, Number(quantity) || 1)) }),

      setShipping: (patch) =>
        set((s) => ({ shipping: { ...s.shipping, ...patch } })),

      setChecks: (patch) => set(patch),

      setOrderResult: ({ orderId, clientSecret, totalCents }) =>
        set({ orderId, clientSecret, totalCents }),

      setSubmitting: (submitting) => set({ submitting }),

      setError: (error) => set({ error }),

      isFormValid: () => {
        const s = get()
        if (!s.reviewChecked || !s.finishedChecked) return false
        const sh = s.shipping
        if (!sh.name?.trim()) return false
        if (!sh.address_line1?.trim()) return false
        if (!sh.city?.trim()) return false
        if (!STATE_RE.test(sh.state || '')) return false
        if (!ZIP_RE.test(sh.postal_code || '')) return false
        if (!EMAIL_RE.test(sh.email || '')) return false
        const phoneDigits = (sh.phone || '').replace(/\D/g, '')
        if (phoneDigits.length < 10) return false
        return true
      },

      reset: () => set({ ...INITIAL, shipping: { ...EMPTY_SHIPPING } }),
    }),
    {
      name: 'mybooklab-print-order',
      // Persist only the form fields a parent might want to keep across visits.
      partialize: (s) => ({
        format: s.format,
        quantity: s.quantity,
        shipping: s.shipping,
        reviewChecked: s.reviewChecked,
        finishedChecked: s.finishedChecked,
        bookId: s.bookId,
      }),
    }
  )
)
