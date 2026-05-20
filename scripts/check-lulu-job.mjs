// scripts/check-lulu-job.mjs
//
// Query Lulu Direct directly for the current status of a print job,
// bypassing our own DB / webhook chain. Use when an order has been in
// `submitted` for a while and we want ground truth from Lulu.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     node scripts/check-lulu-job.mjs 2871842

import { LuluClient } from '../lib/print/lulu.js'

const id = (process.argv[2] || '').trim()
if (!id) {
  console.error('Usage: node scripts/check-lulu-job.mjs <lulu_print_job_id>')
  process.exit(1)
}

if (!process.env.LULU_CLIENT_KEY || !process.env.LULU_CLIENT_SECRET) {
  console.error('Missing LULU_CLIENT_KEY or LULU_CLIENT_SECRET in environment')
  process.exit(1)
}

console.log(`Lulu base: ${process.env.LULU_API_BASE ?? '(default sandbox)'}`)
console.log(`Fetching print job ${id}…\n`)

const lulu = new LuluClient()
const job = await lulu.getPrintJob(id)

// Print a curated view first, then the full object for debugging.
console.log('=== Print Job Summary ====================================')
console.log('id:               ', job.id)
console.log('status:           ', job.status?.name ?? '(unknown)')
console.log('status message:   ', job.status?.message ?? '—')
console.log('date_created:     ', job.date_created)
console.log('date_modified:    ', job.date_modified)

const items = job.line_items ?? []
items.forEach((li, i) => {
  console.log(`\nline_item[${i}]:`)
  console.log('  title:          ', li.title)
  console.log('  pod_package_id: ', li.pod_package_id)
  console.log('  status:         ', li.status?.name ?? '—')
  console.log('  tracking_id:    ', li.tracking_id ?? '—')
  console.log('  tracking_urls:  ', li.tracking_urls?.join(', ') ?? '—')
  console.log('  printable:      ', li.printable_id ?? '—')
})

const ship = job.shipping_address ?? {}
console.log('\nshipping_address: ',
  `${ship.name ?? ''}, ${ship.street1 ?? ''}, ${ship.city ?? ''}, ${ship.state_code ?? ''} ${ship.postcode ?? ''} ${ship.country_code ?? ''}`)
console.log('shipping_level:   ', job.shipping_level ?? '—')

console.log('\n=== Full Response ========================================')
console.log(JSON.stringify(job, null, 2))
