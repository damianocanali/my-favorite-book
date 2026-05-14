import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// supabase-js v2 serializes auth operations via navigator.locks. Whenever
// two callers do auth work concurrently (page mount + a polling tick, or
// a Capacitor reentry firing onAuthStateChange while a getSession is in
// flight) the older lock holder gets "Lock was stolen by another request"
// and the call rejects. We only ever have one Supabase client per app
// process — there is no cross-tab session race to protect against — so
// we swap the lock for a pass-through that runs operations immediately.
const passthroughLock = (_name, _acquireTimeout, fn) => fn()

export const supabase = url && key
  ? createClient(url, key, { auth: { lock: passthroughLock } })
  : null
