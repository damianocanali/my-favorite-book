// scripts/check-order.mjs
//
// Look up a print order by its short id (the last-8-uppercased form shown
// in the UI). Prints status, Lulu state, timestamps, and any error.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     node scripts/check-order.mjs A97C4BFD

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY })) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(1)
  }
}

const shortId = (process.argv[2] || '').trim().toUpperCase()
if (!shortId) {
  console.error('Usage: node scripts/check-order.mjs <SHORT_ID>')
  process.exit(1)
}

// short id is the last 8 chars of the full UUID, uppercased. The id column
// is a uuid type, which PostgREST can't ilike-match, so fetch recent rows
// and filter in JS. Limit keeps the request small.
const suffix = shortId.toLowerCase()
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?select=*&order=created_at.desc&limit=200`,
  {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  }
)

if (!res.ok) {
  console.error(`Lookup failed (${res.status}): ${await res.text()}`)
  process.exit(1)
}

const all = await res.json()
// Match anywhere in the lowercased UUID — accepts the 8-char short id,
// a partial suffix, or the full UUID. Multiple matches print all of them.
const needle = suffix
const rows = all.filter((o) => String(o.id).toLowerCase().includes(needle))
if (rows.length === 0) {
  console.log(`No order found matching "${shortId}" in the last ${all.length} orders.`)
  process.exit(0)
}
if (rows.length > 1) {
  console.log(`Matched ${rows.length} orders; showing all:\n`)
}

for (const o of rows) {
  console.log('\n=== Order ===========================================')
  // Print every column, sorted, so we never miss one because of a stale
  // column-name guess in this script.
  for (const k of Object.keys(o).sort()) {
    const v = o[k]
    const display = v === null || v === undefined ? '—' : v
    console.log(`${k}:`.padEnd(28), display)
  }
}
