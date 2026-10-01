export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, json, isUuid } from '../_school.js'
import { raisedName } from '../../lib/school/assignments.js'
import { snapshotBook } from '../../lib/school/snapshot.js'
import {
  MAX_ITEMS, MAX_PENDING, ABOUT_MAX, ABOUT_FIELDS, NOTE_MAX, COVER_TITLE_MAX,
  canPrintClass, cleanAddress, cleanShortText, schoolYear, hasPieces, aboutMeDone,
} from '../../lib/school/writingYear.js'
import { read, readAll, ITEM_SELECT, buildBooks } from '../_writingYear.js'

// "My Writing Year" (spec 2026-10-01 §3, migration 024).
//
// Teacher (class owner) — every call carries classId:
//   GET  ?classId                       overview: each child's counts, the
//                                       print requests, whether the class can print
//   GET  ?classId&studentId             one child's pieces (in order), About me, note
//   GET  ?classId&studentId&preview=1   one child's book as it will print
//   GET  ?classId&submissionId          is this hand-in in the child's Writing Year?
//   POST {classId, action:'add', submissionId}          add a graded hand-in
//   POST {classId, action:'approve'|'remove', itemId}   a suggestion / any piece
//   POST {classId, action:'reorder', studentId, itemIds}
//   POST {classId, action:'note', studentId, teacherNote?, coverTitle?}
//   POST {classId, action:'print_summary'}              who'd be in a class print
//   POST {classId, action:'print', address}             ask for the class books (R1–R3)
//   POST {classId, action:'cancel_print', requestId}    only while still 'requested'
// Student (their own Writing Year only):
//   GET                                  my pieces (read-only order), About me,
//                                        what I can still suggest
//   GET  ?preview=1                      my book as it will print
//   POST {action:'suggest', submissionId | bookId}
//   POST {action:'withdraw', itemId}     a suggestion still waiting
//   POST {action:'about', about_favorite?, about_best_sentence?, about_learned?}
//
// Printing never talks to Lulu from here: a request waits for the owner's
// review in the admin area (api/admin/class-prints.js).

const bad = (req, error) => json(req, 400, { error, code: 'bad_request' })
const notFound = (req) => json(req, 404, { error: 'Not found', code: 'not_found' })
const archived = (req) => json(req, 409, { error: 'This class is archived. Restore it to make changes.', code: 'class_archived' })

// Raised by the 024 RPCs.
const RPC_ERRORS = {
  submission_not_found: [404, 'Hand-in not found', 'submission_not_found'],
  student_not_found: [404, 'Student not found', 'student_not_found'],
  not_graded: [409, 'Grade it first, then add it to their Writing Year', 'not_graded'],
  too_many_items: [409, `A Writing Year holds up to ${MAX_ITEMS} pieces`, 'too_many_items'],
  too_many_pending: [409, 'Your teacher has a few of your ideas to look at first', 'too_many_pending'],
  order_mismatch: [409, 'The pieces changed. Refresh and try again.', 'order_mismatch'],
  license_not_paid: [403, "Printing isn't available for this class yet", 'print_not_available'],
  already_requested: [409, 'The class books for this year have already been asked for', 'already_requested'],
  children_changed: [409, 'The class changed. Refresh and try again.', 'children_changed'],
  no_children: [409, 'No child has a piece in their Writing Year yet', 'no_children'],
}

async function rpc(req, name, args, failMessage) {
  const res = await sb(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })
  if (!res.ok) {
    const mapped = RPC_ERRORS[await raisedName(res)]
    if (mapped) return { response: json(req, mapped[0], { error: mapped[1], code: mapped[2] }) }
    return { response: json(req, 502, { error: failMessage, code: 'upstream' }) }
  }
  return { data: await res.json() }
}

const itemShape = (r) => ({
  id: r.id, kind: r.kind, title: r.title, position: r.position, approved: !!r.approved,
  added_by: r.added_by, submission_id: r.submission_id ?? null, book_id: r.book_id ?? null, created_at: r.created_at,
})
const metaShape = (m) => ({
  about_favorite: m?.about_favorite ?? '', about_best_sentence: m?.about_best_sentence ?? '',
  about_learned: m?.about_learned ?? '', teacher_note: m?.teacher_note ?? '', cover_title: m?.cover_title ?? null,
})
const requestShape = (r) => ({
  id: r.id, status: r.status, school_year: r.school_year, children_count: r.children_count,
  excluded_count: r.excluded_count, school_name: r.school_name, created_at: r.created_at,
  approved_at: r.approved_at ?? null, submitted_at: r.submitted_at ?? null, shipped_at: r.shipped_at ?? null,
  canceled_at: r.canceled_at ?? null, tracking: r.tracking ?? null,
  // The books never finished saving (the request is written first, the
  // books right after): the teacher is told to cancel and ask again.
  books_missing: booksMissing(r),
})
const REQUEST_SELECT = 'id,status,school_year,children_count,excluded_count,school_name,created_at,approved_at,submitted_at,shipped_at,canceled_at,tracking,books_frozen_at'
// Two minutes covers the request that is still being written.
export const BOOKS_GRACE_MS = 2 * 60 * 1000
const booksMissing = (r, now = Date.now()) =>
  r.status === 'requested' && !r.books_frozen_at && now - new Date(r.created_at).getTime() > BOOKS_GRACE_MS

async function classLicense(classroomId) {
  const rows = await read(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=id,status,starts_at,expires_at`, 'class_licenses')
  return rows?.[0] ?? null
}

// R3: the live (non-canceled) request in the license's CURRENT term, if any.
async function liveRequestFor(license) {
  if (!license?.id || !license.starts_at) return null
  const rows = await read(
    `/rest/v1/class_print_requests?license_id=eq.${license.id}&term_start=eq.${encodeURIComponent(license.starts_at)}` +
      `&status=neq.canceled&select=${REQUEST_SELECT}&limit=1`,
    'class_print_requests'
  )
  return rows?.[0] ?? null
}

async function activeStudents(classroomId) {
  return readAll(
    `/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id,display_name,avatar_emoji,auth_user_id`,
    'display_name.asc,id.asc',
    'class_students'
  )
}

async function studentInClass(classroomId, studentId) {
  if (!isUuid(studentId)) return null
  const rows = await read(
    `/rest/v1/class_students?id=eq.${studentId}&classroom_id=eq.${classroomId}&select=id,display_name,avatar_emoji,auth_user_id,status`,
    'class_students'
  )
  return rows?.[0] ?? null
}

// ── Teacher ────────────────────────────────────────────────────────────

async function teacherOverview(req, o) {
  const license = await classLicense(o.classroom.id)
  const [students, items, metas, requests, current] = await Promise.all([
    activeStudents(o.classroom.id),
    readAll(`/rest/v1/writing_year_items?classroom_id=eq.${o.classroom.id}&select=student_id,approved`, 'id.asc', 'writing_year_items'),
    read(`/rest/v1/writing_year_meta?classroom_id=eq.${o.classroom.id}&select=student_id,about_favorite,about_best_sentence,about_learned,teacher_note`, 'writing_year_meta'),
    read(`/rest/v1/class_print_requests?classroom_id=eq.${o.classroom.id}&select=${REQUEST_SELECT}&order=created_at.desc&limit=20`, 'class_print_requests'),
    liveRequestFor(license),
  ])
  const counts = {}
  for (const it of items) {
    const c = (counts[it.student_id] ??= { items: 0, pending: 0 })
    if (it.approved) c.items++
    else c.pending++
  }
  const metaBy = Object.fromEntries((metas ?? []).map((m) => [m.student_id, m]))
  const year = schoolYear()
  return json(req, 200, {
    school_year: year,
    can_print: canPrintClass(license),
    children: students.map((s) => ({
      student_id: s.id,
      display_name: s.display_name,
      avatar_emoji: s.avatar_emoji,
      item_count: counts[s.id]?.items ?? 0,
      pending_count: counts[s.id]?.pending ?? 0,
      about_me_done: aboutMeDone(metaBy[s.id]),
      has_note: !!metaBy[s.id]?.teacher_note,
    })),
    requests: (requests ?? []).map(requestShape),
    // The request that counts for this license term (R3), shown with its
    // status timeline instead of the "Print" button.
    current_request: current ? requestShape(current) : null,
  })
}

async function teacherChild(req, o, studentId, preview) {
  const student = await studentInClass(o.classroom.id, studentId)
  if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
  if (preview) {
    const [{ book }] = await buildBooks(o.classroom, [student])
    return json(req, 200, { book })
  }
  const [items, metas] = await Promise.all([
    readAll(`/rest/v1/writing_year_items?student_id=eq.${student.id}&classroom_id=eq.${o.classroom.id}&select=${ITEM_SELECT}`, 'position.asc', 'writing_year_items'),
    read(`/rest/v1/writing_year_meta?student_id=eq.${student.id}&select=*`, 'writing_year_meta'),
  ])
  return json(req, 200, {
    student: { id: student.id, display_name: student.display_name, avatar_emoji: student.avatar_emoji, status: student.status },
    items: items.map(itemShape),
    meta: metaShape(metas?.[0]),
  })
}

async function teacherSubmissionState(req, o, submissionId) {
  if (!isUuid(submissionId)) return bad(req, 'Invalid submission id')
  const rows = await read(
    `/rest/v1/writing_year_items?submission_id=eq.${submissionId}&classroom_id=eq.${o.classroom.id}&select=id,approved,added_by`,
    'writing_year_items'
  )
  const r = rows?.[0]
  return json(req, 200, { item: r ? { id: r.id, approved: !!r.approved, added_by: r.added_by } : null })
}

async function itemInClass(classroomId, itemId) {
  if (!isUuid(itemId)) return null
  const rows = await read(`/rest/v1/writing_year_items?id=eq.${itemId}&classroom_id=eq.${classroomId}&select=${ITEM_SELECT}`, 'writing_year_items')
  return rows?.[0] ?? null
}

async function teacherAdd(req, o, body) {
  if (!isUuid(body.submissionId)) return bad(req, 'Invalid submission id')
  const r = await rpc(req, 'school_wy_add_item', {
    p_classroom_id: o.classroom.id, p_student_id: null, p_submission_id: body.submissionId,
    p_book_id: null, p_book_snapshot: null, p_title: null, p_added_by: 'teacher',
    p_max_items: MAX_ITEMS, p_max_pending: MAX_PENDING,
  }, 'Could not add it')
  if (r.response) return r.response
  return json(req, r.data.existed ? 200 : 201, { item: r.data })
}

async function teacherApprove(req, o, body) {
  const item = await itemInClass(o.classroom.id, body.itemId)
  if (!item) return notFound(req)
  const res = await sb(`/rest/v1/writing_year_items?id=eq.${item.id}&classroom_id=eq.${o.classroom.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ approved: true, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not approve it', code: 'upstream' })
  return json(req, 200, { item: itemShape({ ...item, approved: true }) })
}

async function teacherRemove(req, o, body) {
  const item = await itemInClass(o.classroom.id, body.itemId)
  if (!item) return notFound(req)
  const res = await sb(`/rest/v1/writing_year_items?id=eq.${item.id}&classroom_id=eq.${o.classroom.id}`, { method: 'DELETE' })
  if (!res.ok) return json(req, 502, { error: 'Could not remove it', code: 'upstream' })
  return json(req, 200, { ok: true })
}

async function teacherReorder(req, o, body) {
  if (!isUuid(body.studentId)) return bad(req, 'Invalid student id')
  const ids = body.itemIds
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_ITEMS || !ids.every(isUuid)) return bad(req, 'Invalid order')
  const r = await rpc(req, 'school_wy_reorder', {
    p_classroom_id: o.classroom.id, p_student_id: body.studentId, p_item_ids: ids,
  }, 'Could not save the order')
  if (r.response) return r.response
  return json(req, 200, { ok: true })
}

async function upsertMeta(classroomId, studentId, patch) {
  const res = await sb('/rest/v1/writing_year_meta?on_conflict=student_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ student_id: studentId, classroom_id: classroomId, ...patch, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return rows?.[0] ?? null
}

async function teacherNote(req, o, body) {
  const student = await studentInClass(o.classroom.id, body.studentId)
  if (!student) return json(req, 404, { error: 'Student not found', code: 'student_not_found' })
  const patch = {}
  if (body.teacherNote !== undefined) {
    const v = cleanShortText(body.teacherNote, NOTE_MAX)
    if (v === null) return bad(req, `Keep the note under ${NOTE_MAX} characters`)
    patch.teacher_note = v
  }
  if (body.coverTitle !== undefined) {
    const v = cleanShortText(body.coverTitle, COVER_TITLE_MAX)
    if (v === null) return bad(req, `Keep the title under ${COVER_TITLE_MAX} characters`)
    patch.cover_title = v || null
  }
  if (!Object.keys(patch).length) return bad(req, 'Nothing to save')
  const row = await upsertMeta(o.classroom.id, student.id, patch)
  if (!row) return json(req, 502, { error: 'Could not save the note', code: 'upstream' })
  return json(req, 200, { meta: metaShape(row) })
}

// Who'd be in the class print: every active child with at least one
// printable piece; the rest are listed so the teacher can follow up.
async function classBooks(o) {
  const students = await activeStudents(o.classroom.id)
  const books = students.length ? await buildBooks(o.classroom, students) : []
  const included = books.filter((b) => hasPieces(b.book))
  const excluded = books.filter((b) => !hasPieces(b.book))
  return { included, excluded }
}
const named = (list) => list.map(({ student }) => ({ student_id: student.id, display_name: student.display_name }))

async function teacherPrintSummary(req, o) {
  const [license, { included, excluded }] = await Promise.all([classLicense(o.classroom.id), classBooks(o)])
  return json(req, 200, {
    can_print: canPrintClass(license),
    school_year: schoolYear(),
    included: named(included),
    excluded: named(excluded),
  })
}

async function teacherPrint(req, o, body) {
  const license = await classLicense(o.classroom.id)
  // R1, fast path (school_create_class_print re-checks under a lock).
  if (!canPrintClass(license)) {
    return json(req, 403, { error: RPC_ERRORS.license_not_paid[1], code: 'print_not_available' })
  }
  const address = cleanAddress(body.address)
  if (!address.ok) return json(req, 400, { error: address.error, code: 'bad_address', field: address.field })
  // R3, fast path (the partial unique index on the license term is the real guard).
  if (await liveRequestFor(license)) return json(req, 409, { error: RPC_ERRORS.already_requested[1], code: 'already_requested' })

  const { included, excluded } = await classBooks(o)
  if (!included.length) return json(req, 409, { error: RPC_ERRORS.no_children[1], code: 'no_children' })
  // Each child's book is one row, capped at 2 MB (migration 024): name the
  // children whose book is too big before anything is written.
  const tooBig = included.filter(({ book }) => new TextEncoder().encode(JSON.stringify(book)).length > MAX_BOOK_BYTES)
  if (tooBig.length) {
    const names = tooBig.map(({ student }) => student.display_name)
    return json(req, 413, {
      error: `These books are too big to print: ${names.join(', ')}. Remove a piece and try again.`,
      code: 'print_book_too_big', names,
    })
  }
  const year = schoolYear()
  const r = await rpc(req, 'school_create_class_print', {
    p_classroom_id: o.classroom.id,
    p_requested_by: o.auth.userId,
    p_school_year: year,
    p_address: address.address,
    p_children: included.map(({ student }) => ({ student_id: student.id, display_name: student.display_name })),
    p_excluded_count: excluded.length,
  }, 'Could not send the request')
  if (r.response) return r.response

  // The books, one child per write (a class's worth of books is too big
  // for one request body), built here from the database — never sent by
  // the client. All in, then books_frozen_at; anything fails, the request
  // is canceled so the teacher can simply ask again.
  const bookOf = Object.fromEntries(included.map(({ student, book }) => [student.id, book]))
  const ok = await writeBooks(r.data.children ?? [], bookOf)
  const now = new Date().toISOString()
  const fin = await sb(`/rest/v1/class_print_requests?id=eq.${r.data.id}&status=eq.requested`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(ok
      ? { books_frozen_at: now, updated_at: now }
      : { status: 'canceled', canceled_at: now, updated_at: now, error: 'Books could not be saved' }),
  }).catch(() => null)
  if (!ok || !fin?.ok) {
    console.error('school/writing-year: freezing the books failed', r.data.id)
    return json(req, 502, { error: 'Could not send the request', code: 'upstream' })
  }
  return json(req, 201, {
    request: { id: r.data.id, status: 'requested', school_year: year, children_count: r.data.children_count, excluded_count: excluded.length },
    included: named(included),
    excluded: named(excluded),
  })
}

const BOOK_WRITE_BATCH = 5
// Must match the class_print_request_children.book check in 024 (2 MB).
export const MAX_BOOK_BYTES = 2_000_000
async function writeBooks(children, bookOf) {
  for (let i = 0; i < children.length; i += BOOK_WRITE_BATCH) {
    const results = await Promise.all(children.slice(i, i + BOOK_WRITE_BATCH).map((c) =>
      sb(`/rest/v1/class_print_request_children?id=eq.${c.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ book: bookOf[c.student_id] }),
      }).then((res) => res.ok).catch(() => false)))
    if (results.includes(false)) return false
  }
  return true
}

async function teacherCancelPrint(req, o, body) {
  if (!isUuid(body.requestId)) return bad(req, 'Invalid request id')
  // Only while nobody has reviewed it: after that it's the owner's call.
  const res = await sb(
    `/rest/v1/class_print_requests?id=eq.${body.requestId}&classroom_id=eq.${o.classroom.id}&status=eq.requested`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    }
  )
  if (!res.ok) return json(req, 502, { error: 'Could not cancel it', code: 'upstream' })
  const rows = await res.json().catch(() => [])
  if (!rows?.length) return json(req, 409, { error: 'This request is already on its way. Contact us to change it.', code: 'cannot_cancel' })
  return json(req, 200, { request: requestShape(rows[0]) })
}

// ── Student ────────────────────────────────────────────────────────────

async function studentView(req, s, preview) {
  const self = { id: s.student.id, display_name: s.student.display_name, avatar_emoji: s.student.avatar_emoji, auth_user_id: s.auth.userId }
  if (preview) {
    const [{ book }] = await buildBooks(s.classroom, [self])
    // The teacher's note is a surprise for the printed book.
    return json(req, 200, { book: { ...book, teacher_note: '' } })
  }
  const [items, metas, handIns, books] = await Promise.all([
    readAll(`/rest/v1/writing_year_items?student_id=eq.${s.student.id}&select=${ITEM_SELECT}`, 'position.asc', 'writing_year_items'),
    read(`/rest/v1/writing_year_meta?student_id=eq.${s.student.id}&select=*`, 'writing_year_meta'),
    readAll(`/rest/v1/class_submissions?student_id=eq.${s.student.id}&select=id,book_title,submitted_at`, 'submitted_at.desc', 'class_submissions'),
    read(`/rest/v1/user_books?user_id=eq.${encodeURIComponent(s.auth.userId)}&select=book_id,title,updated_at&order=updated_at.desc&limit=100`, 'user_books'),
  ])
  const takenSubs = new Set(items.map((i) => i.submission_id).filter(Boolean))
  const takenBooks = new Set(items.map((i) => i.book_id).filter(Boolean))
  const m = metaShape(metas?.[0])
  return json(req, 200, {
    school_year: schoolYear(),
    // The child sees the order the teacher chose (read-only) and their
    // own waiting suggestions — never the teacher's note.
    items: items.map(itemShape),
    about: { about_favorite: m.about_favorite, about_best_sentence: m.about_best_sentence, about_learned: m.about_learned },
    suggestable: [
      ...handIns.filter((h) => !takenSubs.has(h.id)).map((h) => ({ kind: 'submission', submission_id: h.id, title: h.book_title })),
      ...(books ?? []).filter((b) => !takenBooks.has(b.book_id)).map((b) => ({ kind: 'book', book_id: b.book_id, title: b.title })),
    ],
    limits: { max_items: MAX_ITEMS, max_pending: MAX_PENDING, about_max: ABOUT_MAX },
  })
}

async function studentSuggest(req, s, body) {
  const base = {
    p_classroom_id: s.classroom.id, p_student_id: s.student.id, p_added_by: 'child_suggested',
    p_max_items: MAX_ITEMS, p_max_pending: MAX_PENDING,
  }
  let args
  if (body.submissionId !== undefined) {
    if (!isUuid(body.submissionId)) return bad(req, 'Invalid hand-in')
    // The RPC checks the hand-in is in this class AND this child's.
    args = { ...base, p_submission_id: body.submissionId, p_book_id: null, p_book_snapshot: null, p_title: null }
  } else if (typeof body.bookId === 'string' && body.bookId.length >= 1 && body.bookId.length <= 128) {
    // Their own book only: scoped by the caller's own auth user id.
    const rows = await read(
      `/rest/v1/user_books?user_id=eq.${encodeURIComponent(s.auth.userId)}&book_id=eq.${encodeURIComponent(body.bookId)}&select=title,book_data`,
      'user_books'
    )
    if (!rows?.[0]) return json(req, 404, { error: 'Book not found', code: 'book_not_found' })
    const snap = snapshotBook(rows[0].book_data)
    if (!snap) return json(req, 413, { error: 'That book is too big to add', code: 'book_too_big' })
    args = { ...base, p_submission_id: null, p_book_id: body.bookId, p_book_snapshot: snap, p_title: String(rows[0].title ?? snap.title ?? '').slice(0, 200) }
  } else {
    return bad(req, 'Choose a piece')
  }
  const r = await rpc(req, 'school_wy_add_item', args, 'Could not send it')
  if (r.response) return r.response
  return json(req, r.data.existed ? 200 : 201, { item: r.data })
}

async function studentWithdraw(req, s, body) {
  if (!isUuid(body.itemId)) return bad(req, 'Invalid id')
  // Their own suggestion, still waiting — never an approved piece.
  const res = await sb(
    `/rest/v1/writing_year_items?id=eq.${body.itemId}&student_id=eq.${s.student.id}&approved=is.false`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } }
  )
  if (!res.ok) return json(req, 502, { error: 'Could not take it back', code: 'upstream' })
  const rows = await res.json().catch(() => [])
  if (!rows?.length) return notFound(req)
  return json(req, 200, { ok: true })
}

async function studentAbout(req, s, body) {
  const patch = {}
  for (const f of ABOUT_FIELDS) {
    if (body[f] === undefined) continue
    const v = cleanShortText(body[f], ABOUT_MAX)
    if (v === null) return bad(req, `Keep it under ${ABOUT_MAX} characters`)
    patch[f] = v
  }
  if (!Object.keys(patch).length) return bad(req, 'Nothing to save')
  const row = await upsertMeta(s.classroom.id, s.student.id, patch)
  if (!row) return json(req, 502, { error: 'Could not save it', code: 'upstream' })
  const m = metaShape(row)
  return json(req, 200, { about: { about_favorite: m.about_favorite, about_best_sentence: m.about_best_sentence, about_learned: m.about_learned } })
}

// ── Routing ────────────────────────────────────────────────────────────

const limited = (req, key, n) =>
  checkRateLimit(key, n).allowed ? null : json(req, 429, { error: 'Too many requests', code: 'rate_limited' })

const TEACHER_WRITES = {
  add: teacherAdd, approve: teacherApprove, remove: teacherRemove, reorder: teacherReorder,
  note: teacherNote, print: teacherPrint, cancel_print: teacherCancelPrint,
}
const STUDENT_WRITES = { suggest: studentSuggest, withdraw: studentWithdraw, about: studentAbout }

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const preview = params.get('preview') === '1'
      if (params.get('classId') !== null) {
        const o = await requireClassOwner(req, params.get('classId'))
        if (!o.ok) return o.response
        const rl = limited(req, `school-wy:${o.auth.userId}`, 600)
        if (rl) return rl
        if (params.get('submissionId') !== null) return await teacherSubmissionState(req, o, params.get('submissionId'))
        if (params.get('studentId') !== null) return await teacherChild(req, o, params.get('studentId'), preview)
        return await teacherOverview(req, o)
      }
      const s = await requireStudent(req)
      if (!s.ok) return s.response
      const rl = limited(req, `school-wy-student:${s.student.id}`, 300)
      if (rl) return rl
      return await studentView(req, s, preview)
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = (await req.json().catch(() => null)) ?? {}

    // classId present: the teacher route (a student gets 403 there);
    // absent: the student route (a teacher gets 403 not_a_student).
    if (body.classId !== undefined) {
      const o = await requireClassOwner(req, body.classId)
      if (!o.ok) return o.response
      const rl = limited(req, `school-wy:${o.auth.userId}`, 600)
      if (rl) return rl
      if (body.action === 'print_summary') return await teacherPrintSummary(req, o)
      const fn = TEACHER_WRITES[body.action]
      if (!fn) return bad(req, 'Unknown action')
      if (o.classroom.archived_at) return archived(req)
      if (body.action === 'print' || body.action === 'cancel_print') {
        const prl = limited(req, `school-wy-print:${o.auth.userId}`, 10)
        if (prl) return prl
      }
      return await fn(req, o, body)
    }

    const s = await requireStudent(req)
    if (!s.ok) return s.response
    const rl = limited(req, `school-wy-student:${s.student.id}`, 120)
    if (rl) return rl
    const fn = STUDENT_WRITES[body.action]
    if (!fn) return bad(req, 'Unknown action')
    return await fn(req, s, body)
  } catch (e) {
    console.error('school/writing-year: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
