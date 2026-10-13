import { useEffect, useState } from 'react'

/// The content width of the element `ref` points at, kept up to date with a
/// ResizeObserver (0 until measured, and where there is no ResizeObserver).
export function useElementWidth(ref) {
  return useElementSize(ref).width
}

/// The content box ({ width, height }) of the element `ref` points at, kept
/// up to date with a ResizeObserver ({ 0, 0 } until measured).
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/// Whether the CSS media query matches, following changes (false where
/// there is no matchMedia, e.g. server rendering and tests).
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [query])
  return matches
}
