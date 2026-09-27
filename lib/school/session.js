// Mint a session for a student account without sending any email.
//
// Admin generate_link returns the magic-link token instead of mailing it,
// and verify exchanges its hash for a session. Both are plain GoTrue REST,
// so this runs on the Edge with no SDK.
export async function mintStudentSession({ url, serviceKey, anonKey, email }) {
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!link.ok) {
    console.error('[school/session] generate_link failed', link.status)
    return null
  }
  const data = await link.json().catch(() => ({}))
  const tokenHash = data.hashed_token ?? data.properties?.hashed_token
  if (!tokenHash) return null

  const verify = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  })
  if (!verify.ok) {
    console.error('[school/session] verify failed', verify.status)
    return null
  }
  const s = await verify.json().catch(() => null)
  if (!s?.access_token || !s?.refresh_token) return null
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at }
}
