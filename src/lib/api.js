import { isNative } from '../capacitor'

// On native (iOS/Android), API calls need the full Vercel URL.
// On web, relative URLs work fine.
const API_BASE = isNative
  ? (import.meta.env.VITE_API_BASE_URL || '')
  : ''

/**
 * Wrapper around fetch that prepends the API base URL on native platforms.
 * Usage: apiFetch('/api/generate-image', { method: 'POST', ... })
 */
export function apiFetch(path, options) {
  return fetch(`${API_BASE}${path}`, options)
}
