// The two Atlas partner callbacks (contract FIXED — Atlas is deployed):
//
//   POST {ATLAS_BASE_URL}/api/referral/redeemed  { token, externalRef, feeCents: 100 }
//   POST {ATLAS_BASE_URL}/api/referral/reversed  { token, reason, keepAccess: false }
//   Authorization: Bearer {PARTNER_CALLBACK_SECRET}
//
// Each call returns an `outcome`, never throws:
//   redeemed:  recorded | already_redeemed | invalid (400) | config_error (401) | retry (5xx/network)
//   reversed:  reversed | not_billable     | invalid (400) | config_error (401) | retry
// Nothing personal is ever sent — only the token Atlas issued and our opaque
// payment reference. The secret and the token are never logged here.

export const FEE_CENTS = 100
const TIMEOUT_MS = 8000

function outcomeFor(httpStatus, status, okStatuses) {
  if (httpStatus === 200 && okStatuses.includes(status)) return status
  if (httpStatus === 400 || httpStatus === 422) return 'invalid'
  // 401 is the documented "bad partner secret". 403/404 also mean our side
  // is misconfigured (wrong secret / wrong ATLAS_BASE_URL): no blind retry.
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) return 'config_error'
  // 5xx, 408, 429, network/timeout, or a 200 we don't understand: retry
  // (both endpoints are idempotent on Atlas's side).
  return 'retry'
}

async function post(path, body, cfg, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.callbackSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json().catch(() => null)
    return { httpStatus: res.status, status: typeof data?.status === 'string' ? data.status : null }
  } catch (e) {
    return { httpStatus: 0, status: null, error: e?.name === 'TimeoutError' ? 'timeout' : 'network' }
  }
}

export async function reportRedeemed({ token, externalRef }, cfg, opts) {
  const r = await post('/api/referral/redeemed', { token, externalRef, feeCents: FEE_CENTS }, cfg, opts)
  return { ...r, outcome: outcomeFor(r.httpStatus, r.status, ['recorded', 'already_redeemed']) }
}

export async function reportReversed({ token, reason = 'refunded' }, cfg, opts) {
  const r = await post('/api/referral/reversed', { token, reason, keepAccess: false }, cfg, opts)
  return { ...r, outcome: outcomeFor(r.httpStatus, r.status, ['reversed', 'not_billable']) }
}
