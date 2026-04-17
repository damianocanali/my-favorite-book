import { isNative } from '../capacitor'
import { supabase } from './supabase'

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

/**
 * Like apiFetch, but attaches the current Supabase access token as a Bearer
 * header so the endpoint can verify the caller. If no session exists the
 * request is still made (endpoint will return 401).
 */
export async function apiFetchAuthed(path, options = {}) {
  let token = null
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    token = data?.session?.access_token ?? null
  }
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}
