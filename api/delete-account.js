export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Recoverable deletion: POST schedules it (idempotent), GET reports status.
// The actual hard delete happens later in the purge cron (lib/deleteUser.js).
const GRACE_DAYS = 7

function json(status, obj, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: withCors({ 'Content-Type': 'application/json' }, req),
  })
}

function scheduledFor(requestedAt) {
  return new Date(new Date(requestedAt).getTime() + GRACE_DAYS * 86400000).toISOString()
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Not configured' }, req)

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const { userId } = auth

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  if (req.method === 'GET') {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/account_deletions?user_id=eq.${userId}&select=requested_at`,
      { headers }
    )
    const rows = await res.json().catch(() => [])
    const requested_at = rows?.[0]?.requested_at ?? null
    return json(
      200,
      requested_at
        ? { pending: true, requested_at, scheduled_for: scheduledFor(requested_at) }
        : { pending: false },
      req
    )
  }

  if (req.method === 'POST') {
    const res = await fetch(`${supabaseUrl}/rest/v1/account_deletions?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!res.ok) {
      console.error('[delete-account] schedule failed', res.status, await res.text().catch(() => ''))
      return json(500, { error: 'Could not schedule deletion' }, req)
    }
    let rows = await res.json().catch(() => [])
    if (!rows?.length) {
      const get = await fetch(
        `${supabaseUrl}/rest/v1/account_deletions?user_id=eq.${userId}&select=requested_at`,
        { headers }
      )
      rows = await get.json().catch(() => [])
    }
    const requested_at = rows?.[0]?.requested_at
    if (!requested_at) {
      console.error('[delete-account] scheduled but could not read requested_at')
      return json(500, { error: 'Could not schedule deletion' }, req)
    }
    return json(200, { scheduled: true, scheduled_for: scheduledFor(requested_at) }, req)
  }

  return json(405, { error: 'Method not allowed' }, req)
}
