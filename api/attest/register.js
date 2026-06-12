// POST /api/attest/register — verifies an App Attest attestation object
// and stores the device key. Runs on the NODE runtime (no edge config):
// attestation verification needs full CBOR + X.509 chain validation,
// which node-app-attest does with Node crypto. This runs once per
// install, so Node cold starts don't matter.
//
// Body: { challengeId, keyId, attestation (base64) }

import { verifyAttestation } from 'node-app-attest'

const MAX_ATTESTATION_CHARS = 100_000 // base64; real objects are ~5-8KB

const TEAM_ID = process.env.APP_ATTEST_TEAM_ID || 'G53XBRCRVU'
const BUNDLE_ID = process.env.APP_ATTEST_BUNDLE_ID || 'com.myfavoritebook.app'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(503).json({ error: 'App Attest not configured' })
  }

  // Node-runtime JWT check (verifyJwt in _auth.js expects an edge
  // Request; here headers are a plain object).
  const authHeader = req.headers.authorization || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return res.status(401).json({ error: 'Missing bearer token' })

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  })
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' })
  const user = await userRes.json().catch(() => null)
  if (!user?.id) return res.status(401).json({ error: 'Could not identify user' })

  const { challengeId, keyId, attestation } = req.body || {}
  if (typeof challengeId !== 'string' || typeof keyId !== 'string' || typeof attestation !== 'string') {
    return res.status(400).json({ error: 'challengeId, keyId and attestation are required' })
  }
  if (attestation.length > MAX_ATTESTATION_CHARS || keyId.length > 100) {
    return res.status(413).json({ error: 'Payload too large' })
  }

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // Consume the one-time challenge (atomic; NULL when reused/expired).
  const challengeRes = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_attest_challenge`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ p_id: challengeId, p_user_id: user.id }),
  })
  if (!challengeRes.ok) return res.status(500).json({ error: 'Challenge lookup failed' })
  const challenge = await challengeRes.json().catch(() => null)
  if (!challenge || typeof challenge !== 'string') {
    return res.status(400).json({ error: 'Challenge invalid or expired' })
  }

  let verified
  try {
    verified = verifyAttestation({
      attestation: Buffer.from(attestation, 'base64'),
      // The iOS client hashes the UTF-8 bytes of this same string for
      // attestKey's clientDataHash; the library does SHA256(challenge).
      challenge,
      keyId,
      bundleIdentifier: BUNDLE_ID,
      teamIdentifier: TEAM_ID,
      // Dev-signed builds attest against Apple's development environment.
      // Allowed off-production (previews) or via explicit override.
      allowDevelopmentEnvironment:
        process.env.APP_ATTEST_ALLOW_DEV === 'true' || process.env.VERCEL_ENV !== 'production',
    })
  } catch (e) {
    console.warn('[attest-register] verification failed:', e?.message)
    return res.status(400).json({ error: 'Attestation verification failed' })
  }

  // Upsert: a reinstalled app generates a fresh key; re-registering the
  // same keyId just refreshes the row.
  const upsert = await fetch(`${supabaseUrl}/rest/v1/app_attest_keys`, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      key_id: keyId,
      user_id: user.id,
      public_key_pem: verified.publicKey,
      environment: verified.environment,
      counter: 0,
    }),
  })
  if (!upsert.ok) {
    console.error('[attest-register] key store failed', upsert.status)
    return res.status(500).json({ error: 'Failed to store key' })
  }

  return res.status(200).json({ registered: true, environment: verified.environment })
}
