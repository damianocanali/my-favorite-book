// Shared reads for "My Writing Year" (migration 024): the teacher/student
// routes (api/school/writing-year.js), the teacher's per-child PDF
// (api/school/writing-year-pdf.js) and the class print request all build a
// child's book from the same rows, the same way.
import { sb, sbEnv } from './_school.js'
import { buildChildBook, schoolYear, handInSnapshot } from '../lib/school/writingYear.js'

// Fails CLOSED: a non-2xx throws and becomes 503 upstream.
export async function read(path, what) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

// PostgREST caps a response (1000 rows by default): read page by page in a
// fixed order so a book never silently loses pieces.
export const PAGE = 1000
export async function readAll(path, order, what) {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = await read(`${path}&order=${order}&limit=${PAGE}&offset=${offset}`, what)
    if (!Array.isArray(rows)) throw new Error(`${what} not a list`)
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

export const one = (v) => (Array.isArray(v) ? v[0] : v) ?? {}

// The list columns of a piece (never the snapshots).
export const ITEM_SELECT = 'id,student_id,kind,submission_id,book_id,title,position,added_by,approved,created_at'

/// Avatar picture URLs by auth user id (user_inventory), for the cover.
export async function avatarsFor(authIds) {
  const ids = authIds.filter(Boolean)
  if (!ids.length) return {}
  const rows = await read(
    `/rest/v1/user_inventory?user_id=in.(${ids.map(encodeURIComponent).join(',')})&select=user_id,avatar_url`,
    'user_inventory'
  )
  const map = {}
  for (const r of Array.isArray(rows) ? rows : []) if (r.avatar_url) map[r.user_id] = r.avatar_url
  return map
}

/// Every APPROVED piece's content for the class (or one child), in order,
/// grouped by student id. A hand-in piece prints its latest graded version
/// (handInSnapshot): the hand-in's latest if graded, else the copy frozen
/// when it was chosen, else the latest.
export async function piecesByStudent(classroomId, studentId = null) {
  const rows = await readAll(
    `/rest/v1/writing_year_items?classroom_id=eq.${classroomId}&approved=is.true` +
      (studentId ? `&student_id=eq.${studentId}` : '') +
      '&select=id,student_id,kind,title,position,book_snapshot,snapshot_version,' +
      'class_submissions(book_title,book_snapshot,version,submission_grades(version))',
    'student_id.asc,position.asc',
    'writing_year_items'
  )
  const by = {}
  for (const r of rows) {
    const sub = r.kind === 'submission' ? one(r.class_submissions) : null
    const snapshot = sub
      ? handInSnapshot({
        frozen: r.book_snapshot, frozenVersion: r.snapshot_version,
        latest: sub.book_snapshot, latestVersion: sub.version,
        gradedVersions: (sub.submission_grades ?? []).map((g) => g.version),
      })
      : r.book_snapshot
    ;(by[r.student_id] ??= []).push({ title: r.title || sub?.book_title || '', snapshot })
  }
  return by
}

export async function metaByStudent(classroomId, studentId = null) {
  const rows = await read(
    `/rest/v1/writing_year_meta?classroom_id=eq.${classroomId}` + (studentId ? `&student_id=eq.${studentId}` : '') +
      '&select=student_id,about_favorite,about_best_sentence,about_learned,teacher_note,cover_title',
    'writing_year_meta'
  )
  const by = {}
  for (const r of Array.isArray(rows) ? rows : []) by[r.student_id] = r
  return by
}

/// The built book for each given student (class_students rows with
/// id, display_name, avatar_emoji, auth_user_id), in the given order.
export async function buildBooks(classroom, students, { now = new Date() } = {}) {
  const single = students.length === 1 ? students[0].id : null
  const [pieces, meta, avatars] = await Promise.all([
    piecesByStudent(classroom.id, single),
    metaByStudent(classroom.id, single),
    avatarsFor(students.map((s) => s.auth_user_id)),
  ])
  const year = schoolYear(now)
  return students.map((s) => ({
    student: s,
    book: buildChildBook({
      student: s,
      avatarUrl: avatars[s.auth_user_id] ?? null,
      className: classroom.name,
      lang: classroom.locale,
      year,
      pieces: pieces[s.id] ?? [],
      meta: meta[s.id],
      imageOrigin: sbEnv()?.url ?? null,
    }),
  }))
}
