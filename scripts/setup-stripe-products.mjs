// scripts/setup-stripe-products.mjs
// Run with: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs
// Idempotent: searches for existing products by metadata.kind before creating.

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
})

const PRODUCTS = [
  {
    kind: 'print_book_hardcover',
    name: 'My Book Lab — Hardcover Print',
    description: 'Premium hardcover print of your custom book.',
    unit_amount: 3999,
  },
  {
    kind: 'print_book_softcover',
    name: 'My Book Lab — Softcover Print',
    description: 'Softcover print of your custom book.',
    unit_amount: 1999,
  },
]

async function findProductByKind(kind) {
  const list = await stripe.products.search({
    query: `metadata['kind']:'${kind}' AND active:'true'`,
  })
  return list.data[0] ?? null
}

async function findActivePrice(productId, unit_amount) {
  const list = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  return list.data.find((p) => p.unit_amount === unit_amount) ?? null
}

async function ensure({ kind, name, description, unit_amount }) {
  let product = await findProductByKind(kind)
  if (!product) {
    product = await stripe.products.create({
      name,
      description,
      metadata: { kind },
      shippable: true,
      tax_code: 'txcd_30060003', // "Books — physical" (Stripe tax code; verify in Stripe Dashboard)
    })
    console.log(`Created product ${kind} → ${product.id}`)
  }

  let price = await findActivePrice(product.id, unit_amount)
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount,
      currency: 'usd',
      tax_behavior: 'exclusive',
    })
    console.log(`Created price for ${kind} → ${price.id} ($${unit_amount / 100})`)
  }

  console.log(`${kind}: product=${product.id} price=${price.id}`)
  return { kind, product, price }
}

const out = []
for (const p of PRODUCTS) out.push(await ensure(p))

console.log('\nAdd these to your environment / lib/print/pricing.js:')
for (const { kind, price } of out) {
  console.log(`  ${kind.toUpperCase()}_PRICE_ID=${price.id}`)
}
