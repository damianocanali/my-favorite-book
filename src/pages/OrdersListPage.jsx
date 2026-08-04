import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import OrderStatusPill from '../components/print/OrderStatusPill'
import { formatPriceCents } from '../lib/printPricing'

export default function OrdersListPage() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || !supabase) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('print_orders')
        .select('id, book_id, format, quantity, total_cents, status, created_at, ship_name')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      // `?? []` only covers null. Anything else non-list that comes back on
      // a 200 sailed through and crashed the orders.map below.
      else setOrders(Array.isArray(data) ? data : [])
    })()
    return () => { cancelled = true }
  }, [user?.id])

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><Link to="/login" className="underline">Log in to see your orders.</Link></div>
  }

  return (
    <div className="min-h-screen text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
          <Package size={22} /> My print orders
        </h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {orders === null ? (
          <div className="flex items-center justify-center py-12 text-galaxy-text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-galaxy-text-muted mb-4">No orders yet.</p>
            <Link to="/bookshelf" className="text-galaxy-primary hover:underline">Pick a book to print →</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="block p-4 rounded-xl glass border border-galaxy-text-muted/10 hover:border-galaxy-text-muted/30 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-body font-semibold truncate">{o.ship_name || 'Print order'}</p>
                      <p className="text-xs text-galaxy-text-muted mt-0.5">
                        {o.quantity} × {o.format} · {new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <OrderStatusPill status={o.status} />
                      <p className="text-sm font-bold text-galaxy-text mt-1.5">{formatPriceCents(o.total_cents)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
