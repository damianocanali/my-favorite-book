// src/hooks/useOrderPolling.js
// Fetches a print order by id and polls every 30s while in non-terminal
// states. Stops polling on the terminal states (delivered, failed, refunded)
// and on unmount.
import { useEffect, useRef, useState } from 'react'
import { apiFetchAuthed } from '../lib/api'

const POLL_MS = 30_000
const TERMINAL = new Set(['delivered', 'failed', 'refunded'])

export function useOrderPolling(orderId) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function fetchOnce() {
      try {
        const res = await apiFetchAuthed(`/api/print-orders/get?id=${encodeURIComponent(orderId)}`)
        const body = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(body?.error || `HTTP ${res.status}`)
        } else {
          setOrder(body)
          setError(null)
          if (TERMINAL.has(body.status) && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOnce()
    intervalRef.current = setInterval(fetchOnce, POLL_MS)

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [orderId])

  return { order, error, loading }
}
