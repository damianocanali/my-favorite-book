import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore, selectIsStudent } from '../stores/useAuthStore'
import { getPlan } from '../lib/plans'

/**
 * Pure: which plan key applies, given a user and (if one was fetched) their
 * `subscriptions` row. A class (student) account always resolves to
 * 'student', regardless of what the row says — a student account never has
 * a real Stripe subscription, and `app_metadata.role` is the one field a
 * signed-in student can't rewrite themselves, so it has to win over
 * anything a stale/bugged row might otherwise claim. Consumer accounts keep
 * today's logic unchanged: the row's plan when its status is active or
 * trialing, else 'free'.
 * @param {object|null} user
 * @param {{plan?: string, status?: string}|null} subscriptionRow
 * @returns {string}
 */
export function planKeyFor(user, subscriptionRow) {
  if (selectIsStudent({ user })) return 'student'
  if (subscriptionRow && (subscriptionRow.status === 'active' || subscriptionRow.status === 'trialing')) {
    return subscriptionRow.plan || 'free'
  }
  return 'free'
}

/**
 * Returns the current user's subscription plan and features.
 * Falls back to 'free' if Supabase is unavailable or user is not logged in.
 * A class (student) account short-circuits to the fixed 'student' plan
 * without ever querying `subscriptions` — see planKeyFor above.
 */
export function useSubscription() {
  const user = useAuthStore((s) => s.user)
  const isStudent = useAuthStore(selectIsStudent)
  const [planKey, setPlanKey] = useState(() => planKeyFor(user, null))
  const [stripeCustomerId, setStripeCustomerId] = useState(null)
  const [status, setStatus] = useState('free')
  const [loading, setLoading] = useState(!isStudent)

  useEffect(() => {
    if (isStudent) {
      // Fixed plan, no subscription row exists (or should ever be queried)
      // for a student — nothing to fetch, nothing to wait on.
      setPlanKey('student')
      setStripeCustomerId(null)
      setStatus('active')
      setLoading(false)
      return
    }

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

      setPlanKey(planKeyFor(user, data))
      if (data && (data.status === 'active' || data.status === 'trialing')) {
        setStripeCustomerId(data.stripe_customer_id)
        setStatus(data.status)
      } else {
        setStatus('free')
      }
      setLoading(false)
    }

    fetchSubscription()
    return () => { cancelled = true }
  }, [user?.id, isStudent])

  const plan = getPlan(planKey)
  // 'student' !== 'free' makes this true automatically — called out
  // explicitly here (rather than left as an incidental side effect of the
  // string comparison) because it's load-bearing: every upsell/paywall
  // surface in the app treats isPaid:false as "show the upgrade nudge",
  // and a class account must never see one.
  const isPaid = planKey !== 'free'

  return { plan, planKey, stripeCustomerId, status, loading, isPaid }
}
