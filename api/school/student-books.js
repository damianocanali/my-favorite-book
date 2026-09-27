export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, sb, json, isUuid } from '../_school.js'

const MAX_BOOK_ID_LEN = 128

// A small, safe preview only: a real http(s) URL is exposed as a cover.
// book_data can also hold '[saved-locally]' (never uploaded to Storage —
// see api/sync-books.js's keepOrStrip) or a raw data: URI from a row
// written before that stripping existed. Either would bloat this list
// payload for nothing useful, so both collapse to null rather than being
// forwarded as-is.
function safeCover(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })

    const url = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const studentId = url.searchParams.get('studentId')
    const bookId = url.searchParams.get('bookId')

    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response

    if (!checkRateLimit(`school-student-books:${o.auth.userId}`, 300).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    // Same "doesn't exist" answer for a bad id, a foreign student, and a
    // missing one — ids must not be probeable.
    if (!isUuid(studentId)) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
    if (bookId != null && bookId.length > MAX_BOOK_ID_LEN) {
      return json(req, 400, { error: 'Invalid book id', code: 'bad_request' })
    }

    // Scoped to THIS class via classroom_id — a studentId that belongs to
    // another class must read as "doesn't exist". No status filter: a
    // removed student's books stay visible, the teacher may still need to
    // review their work (brief requirement).
    const studentRes = await sb(
      `/rest/v1/class_students?id=eq.${studentId}&classroom_id=eq.${o.classroom.id}` +
        `&select=id,display_name,avatar_emoji,auth_user_id`
    )
    if (!studentRes.ok) throw new Error(`class_students lookup failed: ${studentRes.status}`)
    const studentRows = await studentRes.json()
    const student = studentRows?.[0]
    if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })

    // The student's own auth_user_id (looked up server-side above) is the
    // ONLY value ever used to scope user_books — never anything the client
    // sends, so a `userId` query param (if one were ever added) could never
    // read someone else's books.
    if (bookId) {
      const bookRes = await sb(
        `/rest/v1/user_books?user_id=eq.${student.auth_user_id}&book_id=eq.${encodeURIComponent(bookId)}` +
          `&select=book_data`
      )
      if (!bookRes.ok) throw new Error(`user_books lookup failed: ${bookRes.status}`)
      const bookRows = await bookRes.json()
      if (!bookRows?.[0]) return json(req, 404, { error: 'Book not found', code: 'book_not_found' })
      return json(req, 200, { book: bookRows[0].book_data })
    }

    // Only the columns a list needs — never the full book_data. The cover
    // is pulled out as its own JSON-path select so the raw jsonb blob never
    // leaves Postgres.
    const listRes = await sb(
      `/rest/v1/user_books?user_id=eq.${student.auth_user_id}` +
        `&select=book_id,title,updated_at,cover:book_data->>coverImage&order=updated_at.desc`
    )
    if (!listRes.ok) throw new Error(`user_books list failed: ${listRes.status}`)
    const rows = await listRes.json()

    return json(req, 200, {
      student: { id: student.id, display_name: student.display_name, avatar_emoji: student.avatar_emoji },
      books: rows.map((r) => ({
        book_id: r.book_id,
        title: r.title,
        updated_at: r.updated_at,
        cover: safeCover(r.cover),
      })),
    })
  } catch (e) {
    console.error('school/student-books: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
