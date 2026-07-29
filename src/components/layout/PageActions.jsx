import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const PAGE_ACTIONS_ID = 'page-actions-slot'

/**
 * Renders a page's action buttons into the app's navigation bar instead of
 * a row inside the page. On reading screens that row was costing ~120px of
 * vertical space (its own line plus the back button's), which squeezed the
 * book. AppShell owns the slot; pages just declare what goes in it.
 *
 * The slot only exists after AppShell has mounted, so the first render
 * yields nothing and the effect picks it up on the next tick.
 */
export default function PageActions({ children }) {
  const [host, setHost] = useState(null)

  useEffect(() => {
    setHost(document.getElementById(PAGE_ACTIONS_ID))
  }, [])

  if (!host) return null
  return createPortal(children, host)
}
