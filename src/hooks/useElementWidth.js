import { useEffect, useState } from 'react'

/// The content width of the element `ref` points at, kept up to date with a
/// ResizeObserver (0 until measured, and where there is no ResizeObserver).
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}
