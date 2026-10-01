// Owner-only review of class print requests ("My Writing Year", migration
// 024). Nothing reaches Lulu until the owner says so, here (controller
// ruling R2), in two separate steps:
//
//   1. Approve & render
//      POST {id, action:'shipping_options'}     Lulu's shipping options for
//                                               this address and box (read-only)
//      POST {id, action:'approve', shippingLevel?}  requested → approved
//                                               (re-checks R1; books must be in)
//      POST {id, action:'render', childId, rerender?}  one child's interior +
//                                               cover PDFs (approved, unclaimed)
//   2. The owner opens every child's PDF (GET ?id — links last one hour)
//      POST {id, action:'estimate'}             read-only: pages × children
//      POST {id, action:'submit'}               ONE Lulu print job, a line item
//                                               per (still active) child, one address
//
//   GET  /api/admin/class-prints               every request, newest first
//   GET  /api/admin/class-prints?id=…          one request + its children
//   POST {id, action:'cancel'}                 only while Lulu can't have it
//   POST {id, action:'reconcile', luluPrintJobId | confirmNoOrder:true}
//        a request stuck with a claim (submit crashed or the write after
//        Lulu failed): record the job id Lulu has, or — after checking Lulu —
//        release the claim
//   POST {id, action:'mark', status}           manual in_production/shipped/failed
//
// The owner is OWNER_USER_ID, checked the same way as api/admin/usage.js.
// Submitting is idempotent: the one call that flips submit_claimed_at from
// null (status approved) is the only one that can create the print job, so
// a double click — or two tabs — can never place two Lulu orders. Once a
// job id exists it is always written down, even when the rest fails.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, sbEnv, isUuid } from '../_school.js'
import { LuluClient } from '../../lib/print/lulu.js'
import { renderHtmlToPdf } from '../../lib/print/pdf-render.js'
import { spineWidthInches } from '../../lib/print/spine-width.js'
import { buildWritingYearInteriorHtml, buildWritingYearCoverHtml } from '../../lib/print/writing-year-html.js'
import { canPrintClass, canMovePrint, SHIPPING_LEVELS, defaultShippingLevel } from '../../lib/school/writingYear.js'
import { writingYearPdfPrefix } from '../../lib/deleteUser.js'

// Softcover, same SKU as api/print-orders/submit-to-lulu.js. Keep in sync.
export const SOFTCOVER_POD = '0850X0850FCSTDPB080CW444MXX'
const BUCKET = 'print-pdfs'
const LULU_URL_SECONDS = 60 * 60 * 24 * 7 // Lulu fetches the files later
const ADMIN_URL_SECONDS = 60 * 60 // the owner's review links
// Carrier label lines are 35 characters on most carriers; Lulu's client
// here has no organization field, so the school goes on the name line.
export const LABEL_NAME_MAX = 35

function reply(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req),
  })
}

async function requireOwner(req) {
  const owner = process.env.OWNER_USER_ID
  if (!owner || !sbEnv()) return reply(req, 503, { error: 'Not configured' })
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!tok) return reply(req, 401, { error: 'Missing token' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${tok}` } })
  if (!r.ok) return reply(req, 401, { error: 'Invalid token' })
  const user = await r.json().catch(() => null)
  if (!user?.id) return reply(req, 401, { error: 'Invalid token' })
  if (user.id !== owner) return reply(req, 403, { error: 'Forbidden' })
  return null
}

async function read(path, what) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

async function patchRequest(id, filter, patch) {
  const res = await sb(`/rest/v1/class_print_requests?id=eq.${id}${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`class_print_requests patch failed: ${res.status}`)
  const rows = await res.json().catch(() => [])
  return rows?.[0] ?? null
}

const REQUEST_COLS = 'id,classroom_id,license_id,term_start,school_year,status,school_name,contact_name,contact_email,contact_phone,' +
  'address_line1,address_line2,city,state_code,postal_code,country_code,children_count,excluded_count,books_frozen_at,' +
  'shipping_level,submit_claimed_at,lulu_print_job_id,lulu_status,tracking,error,created_at,updated_at,approved_at,' +
  'submitted_at,shipped_at,canceled_at,pdfs_purged_at'

async function getRequest(id) {
  const rows = await read(`/rest/v1/class_print_requests?id=eq.${id}&select=${REQUEST_COLS},classrooms(name,locale)`, 'class_print_requests')
  return rows?.[0] ?? null
}

async function getChildren(id, { withBook = false, childId = null } = {}) {
  return read(
    `/rest/v1/class_print_request_children?request_id=eq.${id}${childId ? `&id=eq.${childId}` : ''}` +
      `&select=id,student_id,display_name,position,interior_key,cover_key,page_count,rendered_at${withBook ? ',book' : ''},class_students(auth_user_id,status)` +
      '&order=position.asc',
    'class_print_request_children'
  )
}

const studentOf = (child) => (Array.isArray(child.class_students) ? child.class_students[0] : child.class_students) ?? null
const authIdOf = (child) => studentOf(child)?.auth_user_id ?? null
// A child removed from the class (or whose account is gone) is not printed.
const isActive = (child) => studentOf(child)?.status === 'active'
const isRendered = (c) => !!(c.interior_key && c.cover_key && c.rendered_at)

async function upload(key, buffer) {
  const res = await sb(`/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`upload ${key} failed (${res.status})`)
}

async function signedUrl(key, seconds) {
  const res = await sb(`/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: 'POST', body: JSON.stringify({ expiresIn: seconds }),
  })
  if (!res.ok) throw new Error(`sign ${key} failed (${res.status})`)
  const { signedURL } = await res.json()
  return `${sbEnv().url}/storage/v1${signedURL}`
}

async function licenseOk(classroomId) {
  const rows = await read(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=status,expires_at`, 'class_licenses')
  return canPrintClass(rows?.[0] ?? null)
}

/// "Lincoln Elementary – Attn Ms Rivera", cut to the label line: the
/// school name gives way first, the contact keeps at least its start.
export function labelName(school, contact, max = LABEL_NAME_MAX) {
  const s = String(school ?? '').trim()
  const c = String(contact ?? '').trim()
  const attn = ` – Attn ${c}`
  if (`${s}${attn}`.length <= max) return `${s}${attn}`
  const room = max - attn.length
  if (room >= 8) return `${s.slice(0, room - 1).trimEnd()}…${attn}`
  return `${s.slice(0, 12).trimEnd()}… – Attn ${c}`.slice(0, max)
}

const opsEmail = (r) => process.env.PRINT_OPS_EMAIL || r.contact_email

// ── Actions ────────────────────────────────────────────────────────────

async function shippingOptions(req, r) {
  if (!['requested', 'approved'].includes(r.status) || r.submit_claimed_at) {
    return reply(req, 409, { error: `Not while ${r.status}`, code: 'bad_status' })
  }
  const children = await getChildren(r.id)
  const quantity = children.filter(isActive).length
  const res = await new LuluClient().getShippingOptions({
    country_code: r.country_code,
    ...(r.state_code ? { state_code: r.state_code } : {}),
    postcode: r.postal_code,
    city: r.city,
    pod_package_id: SOFTCOVER_POD,
    quantity: String(quantity),
  })
  const list = Array.isArray(res) ? res : (res?.results ?? res?.shipping_options ?? [])
  const options = list
    .map((o) => ({
      level: o.level ?? o.shipping_level ?? null,
      cost: o.total_cost_incl_tax ?? o.cost_excl_tax ?? o.cost ?? null,
      currency: o.currency ?? null,
      min_days: o.total_days_min ?? o.min_delivery_days ?? null,
      max_days: o.total_days_max ?? o.max_delivery_days ?? null,
    }))
    .filter((o) => SHIPPING_LEVELS.includes(o.level))
  return reply(req, 200, { quantity, options, default: defaultShippingLevel(r.country_code) })
}

async function approve(req, r, body) {
  if (r.status !== 'requested') return reply(req, 409, { error: `Cannot approve a ${r.status} request`, code: 'bad_status' })
  if (!r.books_frozen_at) return reply(req, 409, { error: 'The books for this request were not saved', code: 'books_missing' })
  // R1 again: a license that lapsed since the teacher asked doesn't print.
  if (!(await licenseOk(r.classroom_id))) return reply(req, 409, { error: 'The class license is not paid', code: 'license_not_paid' })
  const level = body.shippingLevel ?? defaultShippingLevel(r.country_code)
  if (!SHIPPING_LEVELS.includes(level)) return reply(req, 400, { error: 'Unknown shipping level' })
  const row = await patchRequest(r.id, '&status=eq.requested', { status: 'approved', approved_at: new Date().toISOString(), shipping_level: level })
  if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
  return reply(req, 200, { request: row })
}

async function render(req, r, body) {
  if (r.status !== 'approved' || r.submit_claimed_at) {
    return reply(req, 409, { error: 'Only an approved request that has not been sent can be rendered', code: 'bad_status' })
  }
  const childId = body.childId
  if (!isUuid(childId)) return reply(req, 400, { error: 'Invalid child id' })
  // Only this child's frozen book: a class's worth is megabytes.
  const [child] = await getChildren(r.id, { withBook: true, childId })
  if (!child) return reply(req, 404, { error: 'Child not found' })
  if (!isActive(child)) return reply(req, 409, { error: 'This child has left the class — they are not printed', code: 'child_removed' })
  if (child.rendered_at && body.rerender !== true) {
    return reply(req, 409, { error: 'Already rendered. Re-render explicitly to replace it.', code: 'already_rendered' })
  }
  if (!Array.isArray(child.book?.pieces)) return reply(req, 409, { error: 'This child\'s book is missing', code: 'books_missing' })
  const authId = authIdOf(child)

  const { html, pageCount } = buildWritingYearInteriorHtml(child.book)
  const interior = await renderHtmlToPdf({ html })
  const dims = await new LuluClient().getCoverDimensions({ pod_package_id: SOFTCOVER_POD, interior_page_count: pageCount, unit: 'inch' })
  const widthInches = Number(dims.width)
  const heightInches = Number(dims.height)
  const coverHtml = buildWritingYearCoverHtml(child.book, {
    widthInches, heightInches, spineWidthInches: spineWidthInches({ format: 'softcover', pageCount }),
  })
  const cover = await renderHtmlToPdf({ html: coverHtml, widthInches, heightInches })

  // Under the child's own folder, so purgeUser finds and deletes them.
  const base = `${writingYearPdfPrefix(authId)}${r.id}`
  const interiorKey = `${base}-interior.pdf`
  const coverKey = `${base}-cover.pdf`
  await upload(interiorKey, interior)
  await upload(coverKey, cover)
  // A render racing a submit never changes what was sent: re-check the
  // claim before recording the new files.
  const now = await getRequest(r.id)
  if (now?.status !== 'approved' || now.submit_claimed_at) {
    return reply(req, 409, { error: 'It is being sent to the printer', code: 'already_submitting' })
  }
  const res = await sb(`/rest/v1/class_print_request_children?id=eq.${child.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ interior_key: interiorKey, cover_key: coverKey, page_count: pageCount, rendered_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`class_print_request_children patch failed: ${res.status}`)
  return reply(req, 200, { child: { id: child.id, page_count: pageCount, rendered: true } })
}

// Read-only. The Lulu client here has no cost calculation, so the owner
// sees what drives the cost: books × pages (+ shipping, chosen at approval).
async function estimate(req, r) {
  const children = (await getChildren(r.id)).filter(isActive)
  const pages = children.map((c) => c.page_count ?? 0)
  return reply(req, 200, {
    books: children.length,
    pages_total: pages.reduce((a, b) => a + b, 0),
    pages_per_book: pages,
    all_rendered: children.every(isRendered),
    shipping_level: r.shipping_level ?? defaultShippingLevel(r.country_code),
    lulu_cost: null,
  })
}

export function buildLuluPayload(r, children, urls) {
  return {
    external_id: r.id,
    // Lulu's job notices go to us; the school's contact is on the parcel.
    contact_email: opsEmail(r),
    shipping_level: r.shipping_level || defaultShippingLevel(r.country_code),
    shipping_address: {
      name: labelName(r.school_name, r.contact_name),
      street1: r.address_line1,
      street2: r.address_line2 || undefined,
      city: r.city,
      state_code: r.state_code || undefined,
      postcode: r.postal_code,
      country_code: r.country_code,
      phone_number: r.contact_phone,
      email: r.contact_email,
    },
    line_items: children.map((c, i) => ({
      external_id: `${r.id}-${c.position}`,
      quantity: 1,
      pod_package_id: SOFTCOVER_POD,
      title: `My Writing Year — ${c.display_name}`.slice(0, 200),
      interior: { source_url: urls[i].interior },
      cover: { source_url: urls[i].cover },
    })),
  }
}

async function submit(req, r) {
  if (['submitted', 'in_production', 'shipped'].includes(r.status)) {
    return reply(req, 200, { ok: true, idempotent: true, status: r.status, lulu_print_job_id: r.lulu_print_job_id })
  }
  if (r.status !== 'approved') return reply(req, 409, { error: `Cannot submit a ${r.status} request`, code: 'bad_status' })
  if (r.submit_claimed_at) return reply(req, 409, { error: 'Already being sent to the printer', code: 'already_submitting' })
  // Removed children are left out; everyone still in the class must be rendered.
  const children = (await getChildren(r.id)).filter(isActive)
  if (!children.length) return reply(req, 409, { error: 'No children left in this request', code: 'no_children' })
  const missing = children.filter((c) => !isRendered(c))
  if (missing.length) return reply(req, 409, { error: 'Render every child first', code: 'not_rendered', missing: missing.map((c) => c.id) })
  if (!(await licenseOk(r.classroom_id))) return reply(req, 409, { error: 'The class license is not paid', code: 'license_not_paid' })

  // The claim: exactly one caller gets the row back.
  const claimed = await patchRequest(r.id, '&status=eq.approved&submit_claimed_at=is.null', { submit_claimed_at: new Date().toISOString() })
  if (!claimed) return reply(req, 409, { error: 'Already being sent to the printer', code: 'already_submitting' })

  let job = null
  try {
    const urls = []
    for (const c of children) urls.push({ interior: await signedUrl(c.interior_key, LULU_URL_SECONDS), cover: await signedUrl(c.cover_key, LULU_URL_SECONDS) })
    job = await new LuluClient().createPrintJob(buildLuluPayload(claimed, children, urls))
    const row = await patchRequest(r.id, '', {
      status: 'submitted', lulu_print_job_id: String(job.id), lulu_status: job?.status?.name ?? null,
      submitted_at: new Date().toISOString(), children_count: children.length, error: null,
    })
    return reply(req, 200, { ok: true, request: row, lulu_print_job_id: String(job.id) })
  } catch (e) {
    const message = String(e?.message ?? e).slice(0, 900)
    if (job?.id) {
      // Lulu HAS the order: it must never look unsent. Write the job id
      // down (status submitted) with what went wrong after.
      const jobId = String(job.id)
      console.error('[admin/class-prints] Lulu accepted job', jobId, 'but the write after failed:', message)
      try {
        await patchRequest(r.id, '', {
          status: 'submitted', lulu_print_job_id: jobId, submitted_at: new Date().toISOString(),
          children_count: children.length, error: `Recorded after a failed write: ${message}`.slice(0, 1000),
        })
        return reply(req, 200, { ok: true, lulu_print_job_id: jobId, warning: message })
      } catch (e2) {
        // Still claimed: cancel is refused until the owner reconciles with this id.
        console.error('[admin/class-prints] CRITICAL could not record Lulu job', jobId, 'for request', r.id, e2?.message)
        return reply(req, 502, { error: `Lulu job ${jobId} was created but not recorded. Reconcile with this job id.`, code: 'record_failed', lulu_print_job_id: jobId })
      }
    }
    console.error('[admin/class-prints] submit failed', r.id, message)
    // failed, not back to approved, and the claim stays: an error can hide
    // an order Lulu took (a timeout). Check Lulu, then reconcile.
    await patchRequest(r.id, '', { status: 'failed', error: message }).catch(() => {})
    return reply(req, 502, { error: message, code: 'lulu_failed' })
  }
}

async function cancel(req, r) {
  if (!canMovePrint(r.status, 'canceled')) return reply(req, 409, { error: `Cannot cancel a ${r.status} request`, code: 'bad_status' })
  // Lulu may have it: only after an explicit reconcile.
  if (r.submit_claimed_at) {
    return reply(req, 409, { error: 'It may have reached Lulu — check Lulu and reconcile first', code: 'needs_reconcile' })
  }
  const row = await patchRequest(r.id, `&status=eq.${r.status}&submit_claimed_at=is.null`, { status: 'canceled', canceled_at: new Date().toISOString() })
  if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
  return reply(req, 200, { request: row })
}

async function reconcile(req, r, body) {
  if (!r.submit_claimed_at || !['approved', 'failed'].includes(r.status)) {
    return reply(req, 409, { error: 'Nothing to reconcile', code: 'bad_status' })
  }
  const filter = `&status=eq.${r.status}&submit_claimed_at=not.is.null`
  if (typeof body.luluPrintJobId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(body.luluPrintJobId)) {
    // Lulu has it: record it; the webhook takes it from here.
    const row = await patchRequest(r.id, filter, {
      status: 'submitted', lulu_print_job_id: body.luluPrintJobId, submitted_at: new Date().toISOString(),
      error: r.error ? `Reconciled: ${r.error}`.slice(0, 1000) : null,
    })
    if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
    return reply(req, 200, { request: row })
  }
  if (body.confirmNoOrder === true) {
    // The owner checked Lulu: no active order. Release the claim; an
    // approved request can be sent again, a failed one can be canceled.
    const row = await patchRequest(r.id, filter, { submit_claimed_at: null })
    if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
    return reply(req, 200, { request: row })
  }
  return reply(req, 400, { error: 'Give the Lulu job id, or confirm no order exists' })
}

const MARKABLE = ['in_production', 'shipped', 'failed']
async function mark(req, r, status) {
  if (!MARKABLE.includes(status) || !canMovePrint(r.status, status)) {
    return reply(req, 409, { error: `Cannot move ${r.status} to ${status}`, code: 'bad_status' })
  }
  const patch = { status }
  if (status === 'shipped') patch.shipped_at = new Date().toISOString()
  const row = await patchRequest(r.id, `&status=eq.${r.status}`, patch)
  if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
  return reply(req, 200, { request: row })
}

// ── Routes ─────────────────────────────────────────────────────────────

export async function GET(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const denied = await requireOwner(req)
  if (denied) return denied
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (id !== null) {
      if (!isUuid(id)) return reply(req, 400, { error: 'Invalid id' })
      const r = await getRequest(id)
      if (!r) return reply(req, 404, { error: 'Not found' })
      const children = await getChildren(id)
      const out = []
      for (const c of children) {
        const rendered = isRendered(c)
        out.push({
          id: c.id, student_id: c.student_id, display_name: c.display_name, position: c.position,
          page_count: c.page_count, rendered, removed: !isActive(c),
          interior_url: rendered ? await signedUrl(c.interior_key, ADMIN_URL_SECONDS) : null,
          cover_url: rendered ? await signedUrl(c.cover_key, ADMIN_URL_SECONDS) : null,
        })
      }
      return reply(req, 200, { request: r, children: out, active_count: out.filter((c) => !c.removed).length })
    }
    const rows = await read(
      `/rest/v1/class_print_requests?select=id,status,school_year,school_name,children_count,excluded_count,created_at,submitted_at,submit_claimed_at,lulu_print_job_id,error,classrooms(name)&order=created_at.desc&limit=200`,
      'class_print_requests'
    )
    return reply(req, 200, { requests: rows })
  } catch (e) {
    console.error('[admin/class-prints] GET failed', e?.message)
    return reply(req, 503, { error: 'Service unavailable' })
  }
}

export async function POST(req) {
  const cors = handleCors(req)
  if (cors) return cors
  const denied = await requireOwner(req)
  if (denied) return denied
  try {
    const body = (await req.json().catch(() => null)) ?? {}
    if (!isUuid(body.id)) return reply(req, 400, { error: 'Invalid id' })
    const r = await getRequest(body.id)
    if (!r) return reply(req, 404, { error: 'Not found' })
    switch (body.action) {
      case 'shipping_options': return await shippingOptions(req, r)
      case 'approve': return await approve(req, r, body)
      case 'render': return await render(req, r, body)
      case 'estimate': return await estimate(req, r)
      case 'submit': return await submit(req, r)
      case 'cancel': return await cancel(req, r)
      case 'reconcile': return await reconcile(req, r, body)
      case 'mark': return await mark(req, r, body.status)
      default: return reply(req, 400, { error: 'Unknown action' })
    }
  } catch (e) {
    console.error('[admin/class-prints] POST failed', e?.message)
    return reply(req, 503, { error: String(e?.message ?? 'Service unavailable').slice(0, 300) })
  }
}

export const OPTIONS = GET
