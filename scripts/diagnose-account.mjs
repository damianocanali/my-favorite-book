// scripts/diagnose-account.mjs
//
// One-shot diagnostic for the "can't see books/orders" problem. Uses
// the service-role key to report, for a given email:
//   - the user id
//   - whether user_metadata still contains an oversized avatar_url
//     (which poisons the JWT and makes iOS drop the auth header)
//   - how many user_books rows exist
//   - how many print_orders rows exist
//
// If the data counts are > 0 here but the app shows nothing, the
// problem is client-side (token / session). If the counts are 0, the
// app is pointed at a different Supabase project than where the data
// lives.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     USER_EMAIL=canali.damiano@yahoo.com \
//     node scripts/diagnose-account.mjs

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_EMAIL = process.env.USER_EMAIL

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, USER_EMAIL })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(1) }
}

const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

console.log(`Supabase project: ${SUPABASE_URL}`)
console.log(`Looking up ${USER_EMAIL}…\n`)

// 1. Find the user.
const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: h })
if (!listRes.ok) { console.error(`admin list failed (${listRes.status})`); process.exit(1) }
const body = await listRes.json()
const users = body.users ?? body ?? []
const user = users.find((u) => (u.email || '').toLowerCase() === USER_EMAIL.toLowerCase())
if (!user) {
  console.error(`No user with email ${USER_EMAIL} found in this project.`)
  console.error(`→ The app may be pointed at a DIFFERENT Supabase project than the one in .env.production.`)
  process.exit(1)
}

console.log('=== USER ===')
console.log('id:   ', user.id)
console.log('email:', user.email)
const meta = user.user_metadata ?? {}
console.log('user_metadata keys:', Object.keys(meta).join(', ') || '(none)')
const avatarLen = (meta.avatar_url || '').length
console.log('avatar_url length:', avatarLen, avatarLen > 1000 ? '⚠️  STILL OVERSIZED — token will be dropped by iOS' : '✓ ok')

// Rough JWT size estimate: user_metadata is embedded in the token.
const metaSize = JSON.stringify(meta).length
console.log('user_metadata total size:', metaSize, 'chars', metaSize > 2000 ? '⚠️  large' : '✓')

// 2. Count books.
const booksRes = await fetch(
  `${SUPABASE_URL}/rest/v1/user_books?user_id=eq.${user.id}&select=book_id,title`,
  { headers: h }
)
const books = booksRes.ok ? await booksRes.json() : []
console.log('\n=== user_books ===')
console.log('count:', Array.isArray(books) ? books.length : 'error')
if (Array.isArray(books)) {
  for (const b of books.slice(0, 10)) console.log('  •', b.title ?? b.book_id)
}

// 3. Count orders.
const ordersRes = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?user_id=eq.${user.id}&select=id,status,total_cents`,
  { headers: h }
)
const orders = ordersRes.ok ? await ordersRes.json() : []
console.log('\n=== print_orders ===')
console.log('count:', Array.isArray(orders) ? orders.length : 'error')
if (Array.isArray(orders)) {
  for (const o of orders.slice(0, 10)) {
    console.log('  •', String(o.id).slice(-8).toUpperCase(), o.status, `$${(o.total_cents/100).toFixed(2)}`)
  }
}

console.log('\n=== VERDICT ===')
if (avatarLen > 1000) {
  console.log('❌ avatar_url is STILL in user_metadata. The clear script did not')
  console.log('   take effect (or was run against a different project). Re-run')
  console.log('   clear-avatar-metadata.mjs, confirm it says "Cleared", then sign')
  console.log('   out + back in on the app.')
} else if ((books.length ?? 0) === 0 && (orders.length ?? 0) === 0) {
  console.log('⚠️  Token looks fine, but this project has 0 books and 0 orders for')
  console.log('   this user. The app is likely pointed at a different Supabase')
  console.log('   project than the one your data lives in. Compare SUPABASE_URL.')
} else {
  console.log('✓ Token is clean AND data exists here. If the app still shows')
  console.log('  nothing, you are running a stale build OR have not signed out +')
  console.log('  back in since clearing the avatar. Force-quit the app, sign out,')
  console.log('  sign back in (fresh token), and the data should appear.')
}
