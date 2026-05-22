// scripts/apple-secret.mjs
//
// Generates the JWT that Supabase's Apple OAuth provider expects as
// "Secret Key". Apple's OAuth flow uses a short-lived signed JWT instead
// of a long-lived shared secret — Supabase used to auto-mint this in
// their dashboard, but newer versions removed the UI, so we sign it
// ourselves.
//
// Output JWT validity: 6 months (Apple's max). Set a calendar reminder
// to re-run this script every ~5 months and update the Supabase
// "Secret Key" field, otherwise Apple sign-in will start failing.
//
// Run with:
//   APPLE_TEAM_ID=ABCD123456 \
//   APPLE_KEY_ID=XXXX111111 \
//   APPLE_SERVICES_ID=app.mybooklab.auth \
//   APPLE_PRIVATE_KEY_PATH=./AuthKey_XXXX111111.p8 \
//   node scripts/apple-secret.mjs
//
// Then paste the printed JWT into Supabase → Authentication → Providers
// → Apple → "Secret Key" field.

import { readFileSync, statSync } from 'node:fs'
import { createSign, createPrivateKey } from 'node:crypto'

const TEAM_ID = process.env.APPLE_TEAM_ID
const KEY_ID = process.env.APPLE_KEY_ID
const SERVICES_ID = process.env.APPLE_SERVICES_ID
const PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH

for (const [name, value] of Object.entries({
  APPLE_TEAM_ID: TEAM_ID,
  APPLE_KEY_ID: KEY_ID,
  APPLE_SERVICES_ID: SERVICES_ID,
  APPLE_PRIVATE_KEY_PATH: PRIVATE_KEY_PATH,
})) {
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
}

let stat
try { stat = statSync(PRIVATE_KEY_PATH) } catch (e) {
  console.error(`Cannot access ${PRIVATE_KEY_PATH}: ${e.message}`)
  process.exit(1)
}
if (stat.isDirectory()) {
  console.error(`APPLE_PRIVATE_KEY_PATH points at a directory, not a file.`)
  console.error(`Find the actual .p8 with:  find ~/Downloads -name 'AuthKey_*.p8'`)
  process.exit(1)
}
const pem = readFileSync(PRIVATE_KEY_PATH, 'utf8')
if (!pem.includes('BEGIN PRIVATE KEY')) {
  console.error(`${PRIVATE_KEY_PATH} does not look like a PEM private key.`)
  console.error(`Expected the file you downloaded from Apple — usually AuthKey_<KEY_ID>.p8`)
  process.exit(1)
}
const privateKey = createPrivateKey({ key: pem, format: 'pem' })

const now = Math.floor(Date.now() / 1000)
const sixMonths = 60 * 60 * 24 * 180

const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + sixMonths,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
}

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const signingInput = `${b64url(header)}.${b64url(payload)}`

// Apple's OAuth requires the IEEE P1363 (raw R||S) signature format,
// NOT the DER encoding Node produces by default. dsaEncoding: 'ieee-p1363'
// (Node ≥ 16) emits the correct 64-byte signature.
const signer = createSign('SHA256')
signer.update(signingInput)
const signature = signer
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  .toString('base64')
  .replace(/=+$/, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

const jwt = `${signingInput}.${signature}`

console.log('\nApple client secret JWT (paste into Supabase → Apple → Secret Key):\n')
console.log(jwt)
console.log(`\nExpires: ${new Date((now + sixMonths) * 1000).toISOString()}`)
console.log('Set a reminder to re-run this script before then.')
