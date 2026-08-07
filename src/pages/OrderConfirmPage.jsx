import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { CheckCircle2 } from 'lucide-react'
import { useRewardsStore } from '../stores/useRewardsStore'

export default function OrderConfirmPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  const earnBadge = useRewardsStore((s) => s.earnBadge)

  useEffect(() => {
    if (!isNew) return
    let canceled = false
    // Ordering a real printed copy is the biggest thing a child completes
    // in this app, and it went unrewarded. `?new=1` is only set on the
    // redirect straight after a successful order, and earnBadge is
    // idempotent server-side, so this credits exactly once.
    earnBadge('printed_book')
    import('canvas-confetti').then((mod) => {
      if (canceled) return
      const confetti = mod.default ?? mod
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } })
    }).catch(() => {})
    return () => { canceled = true }
  }, [isNew, earnBadge])

  const shortId = (id ?? '').slice(-8).toUpperCase()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-galaxy-text font-body">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="text-center max-w-md"
      >
        <CheckCircle2 size={64} className="mx-auto text-green-400 mb-4" />
        <h1 className="font-heading text-3xl font-bold mb-2">Order placed! 🎉</h1>
        <p className="text-galaxy-text-muted">Order #{shortId}</p>
        <p className="mt-6">Usually arrives in <span className="font-semibold">10–14 business days</span>.</p>
        <p className="text-galaxy-text-muted text-sm mt-2">We'll send you an email when your book ships.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/bookshelf" className="w-full py-3 rounded-xl bg-galaxy-primary text-white font-heading font-bold hover:bg-purple-500 transition-colors">
            Back to my shelf
          </Link>
          <Link to={`/orders/${id}`} className="text-sm text-galaxy-text-muted hover:text-galaxy-text underline">
            View order status
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
