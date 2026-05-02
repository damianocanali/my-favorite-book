// Internal endpoint, called by stripe-webhook.js after `paid`.
// Auth: Bearer ${PRINT_WORKER_SECRET}.
// Idempotent: a re-call on a `pdf_ready` order is a no-op success.
export const config = { maxDuration: 300 }

import { upscaleAllIllustrations } from '../../lib/print/upscale.js'
import { buildInteriorHtml, buildCoverHtml } from '../../lib/print/pdf-html.js'
import { renderHtmlToPdf } from '../../lib/print/pdf-render.js'
import { canAdvance } from '../../lib/print/state.js'
import { spineWidthInches } from '../../lib/print/spine-width.js'
import { LuluClient } from '../../lib/print/lulu.js'

// pod_package_id values are duplicated here from submit-to-lulu.js because
// we need to know the SKU at PDF-generation time to query Lulu's exact
// cover dimensions. Keep in sync.
const POD_PACKAGE = {
  hardcover: '0850X0850FCSTDCW080CW444MXX',
  softcover: '0850X0850FCSTDPB080CW444MXX',
}

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WORKER_SECRET = process.env.PRINT_WORKER_SECRET

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
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`patchOrder failed (${r.status}): ${text}`)
  }
}

async function uploadPdf({ key, buffer }) {
  const r = await fetch(`${SUPABASE}/storage/v1/object/print-pdfs/${key}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: buffer,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`upload ${key} failed (${r.status}): ${text}`)
  }
}

async function signedUrl(key, expiresInSeconds = 60 * 60 * 24 * 7) {
  const r = await fetch(`${SUPABASE}/storage/v1/object/sign/print-pdfs/${key}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  })
  if (!r.ok) throw new Error(`sign URL failed (${r.status})`)
  const { signedURL } = await r.json()
  return `${SUPABASE}/storage/v1${signedURL}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers['authorization'] || ''
  if (auth !== `Bearer ${WORKER_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })

  const { orderId } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' })

  const order = await getOrder(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  if (order.status === 'pdf_ready' || order.status === 'submitted' || order.status === 'in_production' || order.status === 'shipped' || order.status === 'delivered') {
    return res.status(200).json({ ok: true, idempotent: true, status: order.status })
  }
  if (!canAdvance(order.status, 'pdf_ready')) {
    return res.status(409).json({ error: `cannot advance from ${order.status}` })
  }

  try {
    const upscaled = await upscaleAllIllustrations(order.book_snapshot)

    // Interior PDF: story pages + closing pages, no cover. The HTML builder
    // pads to Lulu's 24-page minimum with closing/promo content (see
    // lib/print/pdf-html.js).
    const interiorHtml = await buildInteriorHtml(upscaled)
    const interiorPdf = await renderHtmlToPdf({ html: interiorHtml })

    // Cover spread: back + spine + front as ONE wide page. Lulu validates
    // the spread dimensions strictly, and they differ a lot between
    // hardcover (~19" wide due to case wrap) and softcover (~17.4"). Query
    // Lulu's cover-dimensions API for the exact size — never compute locally.
    const interiorPageCount = Math.max(24, upscaled.pages.length + 3) // story + The End/About/Promo
    const spine = spineWidthInches({ format: order.format, pageCount: interiorPageCount })
    const podPackageId = POD_PACKAGE[order.format]
    if (!podPackageId) throw new Error(`no POD package for format ${order.format}`)
    const lulu = new LuluClient()
    const dims = await lulu.getCoverDimensions({
      pod_package_id: podPackageId,
      interior_page_count: interiorPageCount,
      unit: 'inch',
    })
    const widthInches = Number(dims.width)
    const heightInches = Number(dims.height)
    const coverHtml = await buildCoverHtml(upscaled, {
      widthInches, heightInches, spineWidthInches: spine,
    })
    const coverPdf = await renderHtmlToPdf({
      html: coverHtml, widthInches, heightInches,
    })

    const interiorKey = `${orderId}/interior.pdf`
    const coverKey = `${orderId}/cover.pdf`
    await uploadPdf({ key: interiorKey, buffer: interiorPdf })
    await uploadPdf({ key: coverKey, buffer: coverPdf })

    const interiorUrl = await signedUrl(interiorKey)
    const coverUrl = await signedUrl(coverKey)

    await patchOrder(orderId, {
      interior_pdf_url: interiorUrl,
      cover_pdf_url: coverUrl,
      status: 'pdf_ready',
      status_message: null,
    })

    const base = process.env.PUBLIC_BASE_URL || `http://${req.headers.host}`
    fetch(`${base}/api/print-orders/submit-to-lulu`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WORKER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }).catch((e) => console.error('[print] lulu submitter dispatch failed', e))

    return res.status(200).json({ ok: true, status: 'pdf_ready' })
  } catch (err) {
    await patchOrder(orderId, { status: 'failed', status_message: String(err?.message ?? err).slice(0, 500) }).catch(() => {})
    const base = process.env.PUBLIC_BASE_URL || `http://${req.headers.host}`
    fetch(`${base}/api/print-orders/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WORKER_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason: `pdf_worker: ${String(err?.message ?? err).slice(0, 200)}` }),
    }).catch(() => {})
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
