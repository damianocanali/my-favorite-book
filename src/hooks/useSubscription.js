import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { getPlan } from '../lib/plans'

/**
 * Returns the current user's subscription plan and features.
 * Falls back to 'free' if Supabase is unavailable or user is not logged in.
 */
export function useSubscription() {
  const user = useAuthStore((s) => s.user)
  const [planKey, setPlanKey] = useState('free')
  const [stripeCustomerId, setStripeCustomerId] = useState(null)
  const [status, setStatus] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false)
      setPlanKey('free')
      return
    }

    let cancelled = false

    async function fetchSubscription() {
      setLoading(true)
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, status, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (data && (data.status === 'active' || data.status === 'trialing')) {
        setPlanKey(data.plan || 'free')
        setStripeCustomerId(data.stripe_customer_id)
        setStatus(data.status)
      } else {
        setPlanKey('free')
        setStatus('free')
      }
      setLoading(false)
    }

    fetchSubscription()
    return () => { cancelled = true }
  }, [user?.id])

  const plan = getPlan(planKey)
  const isPaid = planKey !== 'free'

  return { plan, planKey, stripeCustomerId, status, loading, isPaid }
}
