// GET /api/school/export?classId=[&studentId=] — the teacher's ZIP of a
// class's data, or one child's (privacy review §7.4; spec: export at lapse
// and year end, NDPA "return of data"). Teacher only, own class only
// (requireClassOwner: same 404 for missing and someone else's), works on
// an archived or lapsed class too. Rate-limited: it reads a lot.
//
// Node runtime for the ZIP (fflate). No PDF rendering here — see
// lib/school/export.js and its README.
export const config = { runtime: 'nodejs', maxDuration: 60 }

import { handleCors, checkRateLimit, withCors } from '../_rateLimit.js'
import { requireClassOwner, json, isUuid } from '../_school.js'
import { read, readAll, buildBooks } from '../_writingYear.js'
import { buildWritingYearInteriorHtml } from '../../lib/print/writing-year-html.js'
import { buildExportZip, safeName } from '../../lib/school/export.js'

const STUDENT_SELECT = 'id,display_name,avatar_emoji,status,created_at,removed_at,last_sign_in_at,auth_user_id'
const inList = (ids) => `in.(${ids.map(encodeURIComponent).join(',')})`
const group = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ??= []).push(r), m), {})

function studentEntry(s, { booksBy, handInsBy, checkinsBy, wyBy }) {
  const book = wyBy[s.id]
  let html = null
  try { html = book ? buildWritingYearInteriorHtml(book).html : null } catch { html = null }
  const { auth_user_id: _omit, ...student } = s
  return {
    student,
    books: booksBy[s.auth_user_id] ?? [],
    handIns: handInsBy[s.id] ?? [],
    checkins: (checkinsBy[s.id] ?? []).map(({ created_at, feeling, need }) => ({ created_at, feeling, need })),
    writingYear: book ? { book, html } : null,
  }
}

export async function GET(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const params = new URL(req.url).searchParams
    const o = await requireClassOwner(req, params.get('classId'))
    if (!o.ok) return o.response
    if (!checkRateLimit(`school-export:${o.auth.userId}`, 20).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const classId = o.classroom.id
    const studentId = params.get('studentId')
    if (studentId != null && !isUuid(studentId)) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    const students = await readAll(
      `/rest/v1/class_students?classroom_id=eq.${classId}` + (studentId ? `&id=eq.${studentId}` : '') + `&select=${STUDENT_SELECT}`,
      'display_name.asc,id.asc', 'class_students'
    )
    if (studentId && !students.length) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    const ids = students.map((s) => s.id)
    const authIds = students.map((s) => s.auth_user_id).filter(Boolean)
    const [assignments, handIns, checkins, books, built, classMeta] = await Promise.all([
      readAll(`/rest/v1/assignments?classroom_id=eq.${classId}&select=id,title,prompt,status,due_at,created_at`, 'created_at.asc,id.asc', 'assignments'),
      ids.length
        ? readAll(
          `/rest/v1/class_submissions?classroom_id=eq.${classId}&student_id=${inList(ids)}` +
            '&select=id,student_id,assignment_id,book_title,book_snapshot,version,submitted_at,' +
            'submission_feedback(comment,sticker,created_at),submission_grades(version,level,tips,returned,created_at)',
          'submitted_at.asc,id.asc', 'class_submissions')
        : [],
      ids.length
        ? readAll(`/rest/v1/class_checkins?classroom_id=eq.${classId}&student_id=${inList(ids)}&select=id,student_id,feeling,need,created_at`, 'created_at.asc,id.asc', 'class_checkins')
        : [],
      // Scoped by the auth ids of THIS class's students only.
      authIds.length
        ? readAll(`/rest/v1/user_books?user_id=${inList(authIds)}&select=id,user_id,book_id,title,book_data,updated_at,created_at`, 'updated_at.asc,id.asc', 'user_books')
        : [],
      students.length ? buildBooks(o.classroom, students) : [],
      read(`/rest/v1/classrooms?id=eq.${classId}&select=created_at`, 'classrooms'),
    ])

    const handInsBy = group(handIns, 'student_id')
    const checkinsBy = group(checkins, 'student_id')
    const booksBy = group(books, 'user_id')
    const wyBy = Object.fromEntries(built.map(({ student, book }) => [student.id, book]))

    const zip = buildExportZip({
      classroom: { ...o.classroom, created_at: classMeta?.[0]?.created_at ?? null },
      assignments,
      single: !!studentId,
      students: students.map((st) => studentEntry(st, { booksBy, handInsBy, checkinsBy, wyBy })),
    })

    const base = studentId ? safeName(students[0].display_name, students[0].id) : safeName(o.classroom.name, classId)
    const date = new Date().toISOString().slice(0, 10)
    const fileName = `${base}-${date}.zip`
    const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
    const headers = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
    }
    return new Response(zip, { status: 200, headers: withCors(headers, req) })
  } catch (e) {
    console.error('school/export: unhandled error', e?.message)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
