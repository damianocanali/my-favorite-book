// Owner-only review of class print requests ("My Writing Year", migration
// 024). Nothing reaches Lulu until the owner says so, here (controller
// ruling R2):
//
//   GET  /api/admin/class-prints               every request, newest first
//   GET  /api/admin/class-prints?id=…          one request + its children
//                                              (signed PDF links once rendered)
//   POST {id, action:'approve'}                requested → approved (re-checks R1)
//   POST {id, action:'render', childId}        render one child's interior +
//                                              cover PDFs (approved only)
//   POST {id, action:'submit'}                 every child rendered → ONE Lulu
//                                              print job, one line item per
//                                              child, one shipping address
//   POST {id, action:'cancel'}                 before the printer has it
//   POST {id, action:'mark', status}           manual in_production/shipped/failed
//
// The owner is OWNER_USER_ID, checked the same way as api/admin/usage.js.
// Submitting is idempotent: the one call that flips submit_claimed_at from
// null (status approved) is the only one that can create the print job, so
// a double click — or two tabs — can never place two Lulu orders.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { handleCors, withCors } from '../_rateLimit.js'
import { sb, sbEnv, isUuid } from '../_school.js'
import { LuluClient } from '../../lib/print/lulu.js'
import { renderHtmlToPdf } from '../../lib/print/pdf-render.js'
import { spineWidthInches } from '../../lib/print/spine-width.js'
import { buildWritingYearInteriorHtml, buildWritingYearCoverHtml } from '../../lib/print/writing-year-html.js'
import { canPrintClass, canMovePrint } from '../../lib/school/writingYear.js'
import { writingYearPdfPrefix } from '../../lib/deleteUser.js'

// Softcover, same SKU as api/print-orders/submit-to-lulu.js. Keep in sync.
export const SOFTCOVER_POD = '0850X0850FCSTDPB080CW444MXX'
const BUCKET = 'print-pdfs'
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7

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

const REQUEST_COLS = 'id,classroom_id,school_year,status,school_name,contact_name,contact_email,contact_phone,' +
  'address_line1,address_line2,city,state_code,postal_code,country_code,children_count,excluded_count,' +
  'submit_claimed_at,lulu_print_job_id,lulu_status,tracking,error,created_at,updated_at,approved_at,submitted_at,shipped_at,canceled_at'

async function getRequest(id) {
  const rows = await read(`/rest/v1/class_print_requests?id=eq.${id}&select=${REQUEST_COLS},classrooms(name,locale)`, 'class_print_requests')
  return rows?.[0] ?? null
}

async function getChildren(id, { withBook = false, childId = null } = {}) {
  return read(
    `/rest/v1/class_print_request_children?request_id=eq.${id}${childId ? `&id=eq.${childId}` : ''}` +
      `&select=id,student_id,display_name,position,interior_key,cover_key,page_count,rendered_at${withBook ? ',book' : ''},class_students(auth_user_id)` +
      '&order=position.asc',
    'class_print_request_children'
  )
}

async function upload(key, buffer) {
  const res = await sb(`/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`upload ${key} failed (${res.status})`)
}

async function signedUrl(key) {
  const res = await sb(`/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: 'POST', body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
  })
  if (!res.ok) throw new Error(`sign ${key} failed (${res.status})`)
  const { signedURL } = await res.json()
  return `${sbEnv().url}/storage/v1${signedURL}`
}

const authIdOf = (child) => (Array.isArray(child.class_students) ? child.class_students[0] : child.class_students)?.auth_user_id

async function licenseOk(classroomId) {
  const rows = await read(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=status,expires_at`, 'class_licenses')
  return canPrintClass(rows?.[0] ?? null)
}

// ── Actions ────────────────────────────────────────────────────────────

async function approve(req, r) {
  if (r.status !== 'requested') return reply(req, 409, { error: `Cannot approve a ${r.status} request`, code: 'bad_status' })
  // R1 again: a license that lapsed since the teacher asked doesn't print.
  if (!(await licenseOk(r.classroom_id))) return reply(req, 409, { error: 'The class license is not paid', code: 'license_not_paid' })
  const row = await patchRequest(r.id, '&status=eq.requested', { status: 'approved', approved_at: new Date().toISOString() })
  if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
  return reply(req, 200, { request: row })
}

async function render(req, r, childId) {
  if (r.status !== 'approved' || r.submit_claimed_at) {
    return reply(req, 409, { error: 'Only an approved request that has not been sent can be rendered', code: 'bad_status' })
  }
  if (!isUuid(childId)) return reply(req, 400, { error: 'Invalid child id' })
  // Only this child's frozen book: a class's worth is megabytes.
  const children = await getChildren(r.id, { withBook: true, childId })
  const child = children.find((c) => c.id === childId)
  if (!child) return reply(req, 404, { error: 'Child not found' })
  const authId = authIdOf(child)
  if (!authId) return reply(req, 409, { error: 'This child has left the class', code: 'child_gone' })

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
  const res = await sb(`/rest/v1/class_print_request_children?id=eq.${child.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ interior_key: interiorKey, cover_key: coverKey, page_count: pageCount, rendered_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`class_print_request_children patch failed: ${res.status}`)
  return reply(req, 200, { child: { id: child.id, page_count: pageCount, rendered: true } })
}

export function buildLuluPayload(r, children, urls) {
  return {
    external_id: r.id,
    contact_email: r.contact_email,
    shipping_level: 'MAIL',
    shipping_address: {
      name: r.contact_name,
      street1: r.address_line1,
      street2: r.address_line2 || undefined,
      city: r.city,
      state_code: r.state_code || undefined,
      postcode: r.postal_code,
      country_code: r.country_code,
      phone_number: r.contact_phone,
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
  const children = await getChildren(r.id)
  if (!children.length) return reply(req, 409, { error: 'No children left in this request', code: 'no_children' })
  const missing = children.filter((c) => !c.interior_key || !c.cover_key)
  if (missing.length) return reply(req, 409, { error: 'Render every child first', code: 'not_rendered', missing: missing.map((c) => c.id) })
  if (!(await licenseOk(r.classroom_id))) return reply(req, 409, { error: 'The class license is not paid', code: 'license_not_paid' })

  // The claim: exactly one caller gets the row back.
  const claimed = await patchRequest(r.id, '&status=eq.approved&submit_claimed_at=is.null', { submit_claimed_at: new Date().toISOString() })
  if (!claimed) return reply(req, 409, { error: 'Already being sent to the printer', code: 'already_submitting' })

  try {
    const urls = []
    for (const c of children) urls.push({ interior: await signedUrl(c.interior_key), cover: await signedUrl(c.cover_key) })
    const job = await new LuluClient().createPrintJob(buildLuluPayload(r, children, urls))
    const row = await patchRequest(r.id, '', {
      status: 'submitted', lulu_print_job_id: String(job.id), lulu_status: job?.status?.name ?? null,
      submitted_at: new Date().toISOString(), error: null,
    })
    return reply(req, 200, { ok: true, request: row, lulu_print_job_id: String(job.id) })
  } catch (e) {
    const message = String(e?.message ?? e).slice(0, 1000)
    console.error('[admin/class-prints] submit failed', r.id, message)
    // failed, not back to approved: an error after Lulu accepted the job
    // (a timeout, a failed write) must not invite a second order. Check
    // Lulu, then cancel and let the teacher ask again.
    await patchRequest(r.id, '', { status: 'failed', error: message }).catch(() => {})
    return reply(req, 502, { error: message, code: 'lulu_failed' })
  }
}

async function cancel(req, r) {
  if (!canMovePrint(r.status, 'canceled')) return reply(req, 409, { error: `Cannot cancel a ${r.status} request`, code: 'bad_status' })
  // An approved request mid-submit could already be at Lulu.
  if (r.status === 'approved' && r.submit_claimed_at) {
    return reply(req, 409, { error: 'It is being sent to the printer — check Lulu first', code: 'already_submitting' })
  }
  const row = await patchRequest(r.id, `&status=eq.${r.status}`, { status: 'canceled', canceled_at: new Date().toISOString() })
  if (!row) return reply(req, 409, { error: 'The request changed', code: 'bad_status' })
  return reply(req, 200, { request: row })
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
      const withLinks = []
      for (const c of children) {
        withLinks.push({
          id: c.id, student_id: c.student_id, display_name: c.display_name, position: c.position,
          page_count: c.page_count, rendered: !!(c.interior_key && c.cover_key),
          interior_url: c.interior_key ? await signedUrl(c.interior_key) : null,
          cover_url: c.cover_key ? await signedUrl(c.cover_key) : null,
        })
      }
      return reply(req, 200, { request: r, children: withLinks })
    }
    const rows = await read(
      `/rest/v1/class_print_requests?select=id,status,school_year,school_name,children_count,excluded_count,created_at,submitted_at,lulu_print_job_id,error,classrooms(name)&order=created_at.desc&limit=200`,
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
      case 'approve': return await approve(req, r)
      case 'render': return await render(req, r, body.childId)
      case 'submit': return await submit(req, r)
      case 'cancel': return await cancel(req, r)
      case 'mark': return await mark(req, r, body.status)
      default: return reply(req, 400, { error: 'Unknown action' })
    }
  } catch (e) {
    console.error('[admin/class-prints] POST failed', e?.message)
    return reply(req, 503, { error: String(e?.message ?? 'Service unavailable').slice(0, 300) })
  }
}

export const OPTIONS = GET
