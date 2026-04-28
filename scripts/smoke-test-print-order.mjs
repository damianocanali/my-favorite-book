// Run with:
//   SUPABASE_ACCESS_TOKEN=... BOOK_ID=... \
//   API_BASE=http://localhost:3000 \
//   node scripts/smoke-test-print-order.mjs
const API = process.env.API_BASE ?? 'http://localhost:3000'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const BOOK_ID = process.env.BOOK_ID

if (!TOKEN || !BOOK_ID) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or BOOK_ID')
  process.exit(1)
}

async function jpost(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${await r.text()}`)
  return r.json()
}
async function jget(path) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

console.log('1. Creating order…')
const created = await jpost('/api/print-orders/create', {
  bookId: BOOK_ID,
  format: 'hardcover',
  quantity: 1,
  shipping: {
    name: 'Smoke Test',
    address_line1: '123 Main St',
    city: 'Austin',
    state: 'TX',
    postal_code: '78701',
    country: 'US',
    email: 'smoke@example.com',
  },
})
console.log('   order:', created.orderId, 'total:', created.totalCents, 'cents')

console.log('2. Confirm Payment Intent in Stripe (use Stripe Dashboard test card 4242 4242 4242 4242).')
console.log('   client_secret:', created.clientSecret)
console.log('   Press Enter once payment is confirmed…')
await new Promise((r) => process.stdin.once('data', r))

console.log('3. Polling order status…')
for (let i = 0; i < 60; i++) {
  const o = await jget(`/api/print-orders/get?id=${created.orderId}`)
  console.log(`   t+${i*10}s status=${o.status}`)
  if (['submitted','in_production','shipped','failed','refunded'].includes(o.status)) break
  await new Promise((r) => setTimeout(r, 10_000))
}

console.log('Done. Verify in Lulu sandbox dashboard.')
