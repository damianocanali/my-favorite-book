// GET /api/school/writing-year-pdf?classId&studentId — the teacher's free
// PDF of one child's "My Writing Year" (spec §3: a child leaving mid-year
// can take a PDF). Rendered on demand through the print pipeline's
// lib/print/pdf-render.js and streamed back; nothing is stored. Node
// runtime: headless Chromium doesn't run on the edge.
export const config = { runtime: 'nodejs', maxDuration: 120 }

import { handleCors, checkRateLimit, withCors } from '../_rateLimit.js'
import { requireClassOwner, json, isUuid } from '../_school.js'
import { read, buildBooks } from '../_writingYear.js'
import { buildWritingYearInteriorHtml } from '../../lib/print/writing-year-html.js'
import { renderHtmlToPdf } from '../../lib/print/pdf-render.js'
import { PageOverflowError } from '../../lib/print/overflow.js'

const safeFileName = (s) => String(s ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'writing-year'

export async function GET(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const params = new URL(req.url).searchParams
    const o = await requireClassOwner(req, params.get('classId'))
    if (!o.ok) return o.response
    // Rendering is heavy: a class's worth an hour is plenty.
    if (!checkRateLimit(`school-wy-pdf:${o.auth.userId}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const studentId = params.get('studentId')
    if (!isUuid(studentId)) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    const rows = await read(
      `/rest/v1/class_students?id=eq.${studentId}&classroom_id=eq.${o.classroom.id}&select=id,display_name,avatar_emoji,auth_user_id`,
      'class_students'
    )
    if (!rows?.[0]) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    const [{ student, book }] = await buildBooks(o.classroom, [rows[0]])
    const { html } = buildWritingYearInteriorHtml(book)
    let pdf
    try {
      pdf = await renderHtmlToPdf({ html, checkOverflow: '.page' })
    } catch (e) {
      if (!(e instanceof PageOverflowError)) throw e
      // Never a clipped book: name the pages so the teacher can shorten them.
      return json(req, 409, { error: e.message, code: 'page_overflow', pages: e.pages })
    }
    const headers = {
      'Content-Type': 'application/pdf',
      // ASCII fallback + the UTF-8 name (a header can't carry "Lucía" raw).
      'Content-Disposition': `attachment; filename="writing-year-${book.year}.pdf"; filename*=UTF-8''${encodeURIComponent(`${safeFileName(student.display_name)} ${book.year}.pdf`)}`,
      'Cache-Control': 'no-store',
    }
    return new Response(pdf, { status: 200, headers: withCors(headers, req) })
  } catch (e) {
    console.error('school/writing-year-pdf: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

export const OPTIONS = GET
