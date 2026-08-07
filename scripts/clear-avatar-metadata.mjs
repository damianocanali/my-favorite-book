// scripts/clear-avatar-metadata.mjs
//
// EMERGENCY FIX: an earlier build stored the user's avatar as a ~20KB
// base64 data URL in Supabase user_metadata. GoTrue embeds
// user_metadata inside the JWT access token, which made the token so
// large that iOS CFNetwork dropped the Authorization header
// ("Dropping HTTP field due to overlong value"). Result: every
// authenticated request went out unauthenticated and RLS returned
// nothing — empty bookshelf, empty orders, failed avatar saves.
//
// This script uses the service-role key + GoTrue admin API to strip
// avatar_url out of the user's user_metadata, shrinking the token back
// to normal size. Run it once per affected user. After running, the
// user should sign out and sign back in to mint a fresh, small token.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     USER_EMAIL=canali.damiano@yahoo.com \
//     node scripts/clear-avatar-metadata.mjs

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_EMAIL = process.env.USER_EMAIL

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, USER_EMAIL })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(1) }
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// 1. Find the user by email via the admin list endpoint.
console.log(`Looking up ${USER_EMAIL}…`)
const listRes = await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users?per_page=200`,
  { headers: adminHeaders }
)
if (!listRes.ok) {
  console.error(`Admin list failed (${listRes.status}): ${await listRes.text()}`)
  process.exit(1)
}
const listBody = await listRes.json()
const users = listBody.users ?? listBody ?? []
const user = users.find((u) => (u.email || '').toLowerCase() === USER_EMAIL.toLowerCase())
if (!user) {
  console.error(`No user found with email ${USER_EMAIL} in the first 200 users.`)
  process.exit(1)
}

console.log(`Found user ${user.id}`)
const meta = user.user_metadata ?? {}
const avatarLen = (meta.avatar_url || '').length
console.log(`Current user_metadata keys: ${Object.keys(meta).join(', ') || '(none)'}`)
console.log(`avatar_url length: ${avatarLen} chars`)

if (avatarLen === 0) {
  console.log('No oversized avatar_url found — nothing to clear. Token should be fine.')
  process.exit(0)
}

// 2. GoTrue's admin update MERGES user_metadata (it does not replace).
// To remove a key via a merge you set it to null — sending the object
// without avatar_url leaves the old value in place. So explicitly null
// it out.
const updateRes = await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
  {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ user_metadata: { avatar_url: null } }),
  }
)
if (!updateRes.ok) {
  console.error(`Admin update failed (${updateRes.status}): ${await updateRes.text()}`)
  process.exit(1)
}

const updated = await updateRes.json()
const newMeta = updated.user_metadata ?? {}
const newLen = (newMeta.avatar_url || '').length
console.log(`\nUpdated. avatar_url length is now: ${newLen} (was ${avatarLen})`)
console.log('Remaining keys:', Object.keys(newMeta).join(', ') || '(none)')
if (newLen > 1000) {
  console.error('⚠️  Still oversized — the merge did not clear it. Tell the dev.')
  process.exit(1)
}
console.log('\nNext step: in the iOS app, sign OUT and sign back IN to get a')
console.log('fresh (small) token. Books, orders, and everything else should work.')
