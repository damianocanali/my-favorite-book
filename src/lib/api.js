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

// Cached access token. supabase.auth.getSession() takes a Web Lock under the
// hood; when two callers race for it (e.g. order page mount + poll tick),
// one gets "Lock was stolen by another request". Keeping the token in
// module scope and refreshing it via onAuthStateChange means the hot path
// of every API call never touches the lock.
let cachedToken = null
let tokenInitPromise = null

function primeFromSession() {
  if (!supabase) return Promise.resolve(null)
  if (tokenInitPromise) return tokenInitPromise
  tokenInitPromise = supabase.auth.getSession()
    .then(({ data }) => {
      cachedToken = data?.session?.access_token ?? null
      return cachedToken
    })
    .catch(() => null)
  return tokenInitPromise
}

if (supabase) {
  primeFromSession()
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token ?? null
    tokenInitPromise = null
  })
}

/**
 * Like apiFetch, but attaches the current Supabase access token as a Bearer
 * header so the endpoint can verify the caller. If no session exists the
 * request is still made (endpoint will return 401).
 */
export async function apiFetchAuthed(path, options = {}) {
  let token = cachedToken
  if (!token && supabase) token = await primeFromSession()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}
