export const config = { runtime: 'edge' }

import { purgeUser, GRACE_DAYS } from '../../lib/deleteUser.js'

const CRON_SECRET = process.env.CRON_SECRET

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export default async function handler(req) {
  const header = req.headers.get('authorization') || ''
  if (!CRON_SECRET || !safeEqual(header, `Bearer ${CRON_SECRET}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000).toISOString()
  const res = await fetch(
    `${supabaseUrl}/rest/v1/account_deletions?requested_at=lt.${encodeURIComponent(cutoff)}&select=user_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (!res.ok) {
    console.error('[purge-deletions] could not list deletions', res.status)
    return new Response(JSON.stringify({ error: 'Could not list deletions' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    })
  }
  const parsed = await res.json().catch(() => [])
  const list = Array.isArray(parsed) ? parsed : []

  let purged = 0
  let failed = 0
  for (const row of list) {
    try {
      const { ok } = await purgeUser(row.user_id, { supabaseUrl, serviceKey, stripeSecretKey })
      if (ok) purged++
      else failed++
    } catch (e) {
      failed++
      console.error('[purge-deletions] error for a user:', e?.message)
    }
  }

  return new Response(JSON.stringify({ considered: list.length, purged, failed }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
