// Shared auth for internal print-worker endpoints (submit-to-lulu, refund,
// pdf-worker). These compare a bearer secret; the comparison is
// constant-time and FAILS CLOSED when PRINT_WORKER_SECRET is unset (so a
// missing env var can't turn `Bearer undefined` into a valid credential).
const SECRET = process.env.PRINT_WORKER_SECRET

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** True only when the request carries the configured worker bearer secret. */
export function hasWorkerSecret(req) {
  if (!SECRET) return false // fail closed
  const header = req.headers?.['authorization'] ?? req.headers?.get?.('authorization') ?? ''
  return safeEqual(header, `Bearer ${SECRET}`)
}
