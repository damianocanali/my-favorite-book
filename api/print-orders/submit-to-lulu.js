// Internal endpoint. Auth: Bearer ${PRINT_WORKER_SECRET}.
// Idempotent: re-call on `submitted+` is a no-op success.
export const config = { maxDuration: 60 }

import { LuluClient } from '../../lib/print/lulu.js'
import { canAdvance } from '../../lib/print/state.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WORKER_SECRET = process.env.PRINT_WORKER_SECRET

// Verified against Lulu sandbox 2026-04-27 via cost-calc probe.
// 0850X0850 = 8.5"×8.5" trim, FC = full color, STD = standard quality,
// CW = casewrap (hardcover), PB = perfect-bound (softcover),
// 080 = 80# paper, CW = coated white, 444 / MXX = standard glue + cover.
// Both require >= 24 pages; pad short books in the PDF worker.
const POD_PACKAGE = {
  hardcover: '0850X0850FCSTDCW080CW444MXX',
  softcover: '0850X0850FCSTDPB080CW444MXX',
}

async function getOrder(id) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders?id=eq.${id}&select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  const rows = await r.json()
  return rows?.[0] ?? null
}

async function patchOrder(id, patch) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`patchOrder failed (${r.status})`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers['authorization'] || ''
  if (auth !== `Bearer ${WORKER_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })

  const { orderId } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' })

  const order = await getOrder(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  if (['submitted','in_production','shipped','delivered'].includes(order.status)) {
    return res.status(200).json({ ok: true, idempotent: true, status: order.status })
  }
  if (!canAdvance(order.status, 'submitted')) {
    return res.status(409).json({ error: `cannot advance from ${order.status}` })
  }
  if (!order.interior_pdf_url || !order.cover_pdf_url) {
    return res.status(409).json({ error: 'PDFs not ready' })
  }

  try {
    const lulu = new LuluClient()
    const pod = POD_PACKAGE[order.format]
    if (!pod) throw new Error(`no POD package for format ${order.format}`)

    const job = await lulu.createPrintJob({
      external_id: order.id,
      contact_email: order.ship_email,
      shipping_level: 'MAIL',
      shipping_address: {
        name: order.ship_name,
        street1: order.ship_address_line1,
        street2: order.ship_address_line2 ?? undefined,
        city: order.ship_city,
        state_code: order.ship_state,
        postcode: order.ship_postal_code,
        country_code: order.ship_country,
        phone_number: order.ship_phone ?? undefined,
      },
      line_items: [{
        external_id: `${order.id}-1`,
        quantity: order.quantity,
        pod_package_id: pod,
        title: order.book_snapshot?.title?.slice(0, 200) || 'My Book Lab Story',
        interior: { source_url: order.interior_pdf_url },
        cover: { source_url: order.cover_pdf_url },
      }],
    })

    await patchOrder(orderId, {
      lulu_order_id: String(job.id),
      status: 'submitted',
      status_message: null,
    })

    return res.status(200).json({ ok: true, lulu_order_id: job.id })
  } catch (err) {
    await patchOrder(orderId, { status: 'failed', status_message: String(err?.message ?? err).slice(0, 500) }).catch(() => {})
    const base = process.env.PUBLIC_BASE_URL || `http://${req.headers.host}`
    fetch(`${base}/api/print-orders/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WORKER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason: `submit_to_lulu: ${String(err?.message ?? err).slice(0, 200)}` }),
    }).catch(() => {})
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
