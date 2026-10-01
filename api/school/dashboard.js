export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, requireClassOwner, sb, json } from '../_school.js'
import { isLate } from '../../lib/school/assignments.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CHECKINS_PER_STUDENT = 20
const DASHBOARD_ASSIGNMENTS = 5
const HELP_SELECT = 'id,student_id,classroom_id,kind,asks,in_hours,created_at,updated_at,class_students(display_name)'

// class_help_requests.student_id -> class_students(id) is a to-one embed;
// PostgREST returns it as an object, but be defensive about a one-element
// array too (see classes.js's firstOf for the same defensiveness on
// class_licenses).
function embeddedName(row) {
  const s = row.class_students
  return (Array.isArray(s) ? s[0]?.display_name : s?.display_name) ?? null
}

// Grownup asks first, then newest-first within each group. `kind` can't be
// sorted with a plain PostgREST order-by ('book' < 'grownup' alphabetically,
// backwards from what the brief wants), so this is done in JS.
function sortHelp(rows) {
  return [...rows].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'grownup' ? -1 : 1
    return new Date(b.created_at) - new Date(a.created_at)
  })
}

function shapeHelp(row, extra = {}) {
  return {
    id: row.id,
    student_id: row.student_id,
    display_name: embeddedName(row),
    kind: row.kind,
    asks: row.asks,
    in_hours: row.in_hours,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...extra,
  }
}

// One extra bulk query for the whole roster's avatar thumbnails — copied
// from api/school/students.js's loadAvatarMap (not imported: that function
// is private to that module, and the brief calls for "the approach", not a
// shared dependency between the two handlers). Best-effort: a failed lookup
// just means no thumbnails this load, so it fails OPEN, unlike every other
// read on this page which fails closed.
async function loadAvatarMap(authUserIds) {
  const ids = [...new Set(authUserIds.filter(Boolean))]
  if (!ids.length) return {}
  try {
    const res = await sb(`/rest/v1/user_inventory?user_id=in.(${ids.map(encodeURIComponent).join(',')})&select=user_id,avatar_url`)
    if (!res.ok) return {}
    const rows = await res.json()
    const map = {}
    for (const r of rows) if (r.avatar_url) map[r.user_id] = r.avatar_url
    return map
  } catch {
    return {}
  }
}

// The cross-class ("needs you now") view: every non-archived class this
// teacher owns, plus their unseen help asks across all of them.
async function crossClassDashboard(req, teacherId) {
  // Fails closed: a broken lookup must never read as "no classes".
  const classesRes = await sb(
    `/rest/v1/classrooms?owner_user_id=eq.${encodeURIComponent(teacherId)}&archived_at=is.null&select=id,name&order=created_at.desc`
  )
  if (!classesRes.ok) throw new Error(`classrooms lookup failed: ${classesRes.status}`)
  const classes = await classesRes.json()
  if (!classes.length) return json(req, 200, { classes: [], help: [] })

  // Built only from the ids this same request just read from the DB — never
  // from anything the client sent — so a teacher can never probe another
  // teacher's help queue by guessing classroom ids.
  const ids = classes.map((c) => c.id)
  const nameById = new Map(classes.map((c) => [c.id, c.name]))

  const helpRes = await sb(
    `/rest/v1/class_help_requests?classroom_id=in.(${ids.map(encodeURIComponent).join(',')})` +
      `&seen_at=is.null&select=${HELP_SELECT}&order=created_at.desc`
  )
  if (!helpRes.ok) throw new Error(`help lookup failed: ${helpRes.status}`)
  const helpRows = await helpRes.json()
  const help = sortHelp(helpRows).map((r) => shapeHelp(r, { classroom_id: r.classroom_id, class_name: nameById.get(r.classroom_id) ?? null }))

  return json(req, 200, { classes: classes.map(({ id, name }) => ({ id, name })), help })
}

async function oneClassDashboard(req, o) {
  const classroomId = o.classroom.id
  const nowIso = new Date().toISOString()
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
  // images_today resets per calendar day; the brief accepts UTC as the
  // definition of "today" here.
  const today = nowIso.slice(0, 10)

  // The license decides what billing figures are shown — fails closed.
  const licRes = await sb(`/rest/v1/class_licenses?classroom_id=eq.${classroomId}&select=status,expires_at,image_allowance,images_used`)
  if (!licRes.ok) throw new Error(`license lookup failed: ${licRes.status}`)
  const license = (await licRes.json())?.[0] ?? null

  // Active roster — fails closed.
  const studentsRes = await sb(
    `/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active` +
      `&select=id,display_name,avatar_emoji,status,locked_until,hard_locked,last_sign_in_at,images_day,images_today,auth_user_id` +
      `&order=display_name.asc`
  )
  if (!studentsRes.ok) throw new Error(`class_students lookup failed: ${studentsRes.status}`)
  const students = await studentsRes.json()
  const authIds = students.map((s) => s.auth_user_id).filter(Boolean)

  // One query for the whole class's books, never book_data — fails closed.
  const bookRows = authIds.length
    ? await (async () => {
        const r = await sb(`/rest/v1/user_books?user_id=in.(${authIds.map(encodeURIComponent).join(',')})&select=user_id,updated_at`)
        if (!r.ok) throw new Error(`user_books lookup failed: ${r.status}`)
        return r.json()
      })()
    : []

  // One query for the whole class's recent check-ins — fails closed.
  const checkinsRes = await sb(
    `/rest/v1/class_checkins?classroom_id=eq.${classroomId}&created_at=gte.${encodeURIComponent(weekAgo)}` +
      `&select=student_id,feeling,need,created_at&order=created_at.desc`
  )
  if (!checkinsRes.ok) throw new Error(`class_checkins lookup failed: ${checkinsRes.status}`)
  const checkinRows = await checkinsRes.json()

  // Unseen help for this class — fails closed: a teacher must never see
  // "nothing pending" because of a transient DB hiccup.
  const helpRes = await sb(`/rest/v1/class_help_requests?classroom_id=eq.${classroomId}&seen_at=is.null&select=${HELP_SELECT}&order=created_at.desc`)
  if (!helpRes.ok) throw new Error(`help lookup failed: ${helpRes.status}`)
  const helpRows = await helpRes.json()

  // The newest few assignments students can see, and every hand-in for
  // them in ONE query (not one per assignment or per student) — both fail
  // closed: "nobody handed in" must never be a DB hiccup.
  const assignmentsRes = await sb(
    `/rest/v1/assignments?classroom_id=eq.${classroomId}&status=in.(published,closed)` +
      `&select=id,title,status,due_at,allow_late&order=created_at.desc&limit=${DASHBOARD_ASSIGNMENTS}`
  )
  if (!assignmentsRes.ok) throw new Error(`assignments lookup failed: ${assignmentsRes.status}`)
  // allow_late: the nudge suggestions only count assignments still open.
  const assignments = (await assignmentsRes.json()).map(({ id, title, status, due_at, allow_late }) => ({ id, title, status, due_at, allow_late }))
  const subRows = assignments.length
    ? await (async () => {
        const r = await sb(
          `/rest/v1/class_submissions?classroom_id=eq.${classroomId}` +
            `&assignment_id=in.(${assignments.map((a) => a.id).join(',')})&select=assignment_id,student_id,submitted_at,returned_at`
        )
        if (!r.ok) throw new Error(`class_submissions lookup failed: ${r.status}`)
        return r.json()
      })()
    : []
  const dueById = new Map(assignments.map((a) => [a.id, a.due_at]))
  const handInState = new Map() // `${student_id}:${assignment_id}` -> 'handed_in' | 'late'
  for (const r of subRows) {
    // Sent back to revise (migration 022): not done until they hand in
    // again, so it reads not_started — for the chips, the counts and the
    // nudge suggestions alike.
    if (r.returned_at) continue
    handInState.set(`${r.student_id}:${r.assignment_id}`, isLate(r.submitted_at, dueById.get(r.assignment_id)) ? 'late' : 'handed_in')
  }
  const assignmentMap = (studentId) =>
    Object.fromEntries(assignments.map((a) => [a.id, handInState.get(`${studentId}:${a.id}`) ?? 'not_started']))

  const avatarByAuthId = await loadAvatarMap(authIds)

  const booksByStudent = new Map()
  let booksEditedThisWeek = 0
  for (const row of bookRows) {
    const entry = booksByStudent.get(row.user_id) ?? { count: 0, latest: null }
    entry.count += 1
    if (!entry.latest || new Date(row.updated_at) > new Date(entry.latest)) entry.latest = row.updated_at
    booksByStudent.set(row.user_id, entry)
    if (new Date(row.updated_at) >= new Date(weekAgo)) booksEditedThisWeek += 1
  }

  const checkinsByStudent = new Map()
  for (const row of checkinRows) {
    const list = checkinsByStudent.get(row.student_id) ?? []
    if (list.length < MAX_CHECKINS_PER_STUDENT) list.push({ feeling: row.feeling, need: row.need, created_at: row.created_at })
    checkinsByStudent.set(row.student_id, list)
  }

  let activeThisWeek = 0
  const outStudents = students.map((s) => {
    const activeThisWeekFlag = !!s.last_sign_in_at && new Date(s.last_sign_in_at) >= new Date(weekAgo)
    if (activeThisWeekFlag) activeThisWeek += 1
    const books = booksByStudent.get(s.auth_user_id) ?? { count: 0, latest: null }
    const avatar_url = avatarByAuthId[s.auth_user_id]
    return {
      id: s.id,
      display_name: s.display_name,
      avatar_emoji: s.avatar_emoji,
      ...(avatar_url ? { avatar_url } : {}),
      status: s.status,
      // Combines the temporary (locked_until) and permanent (hard_locked,
      // 10 wrong guesses) locks: this surface has one "locked" field, and a
      // teacher scanning it needs "can this student sign in right now?",
      // not which of the two reasons caused it.
      locked: s.hard_locked || (!!s.locked_until && new Date(s.locked_until) > new Date()),
      last_sign_in_at: s.last_sign_in_at,
      books_count: books.count,
      last_book_edited_at: books.latest,
      images_today: s.images_day === today ? s.images_today : 0,
      checkins_7d: checkinsByStudent.get(s.id) ?? [],
      inactive_7d: !activeThisWeekFlag,
      assignments: assignmentMap(s.id),
    }
  })

  const help = sortHelp(helpRows).map((r) => shapeHelp(r))

  return json(req, 200, {
    class: {
      id: o.classroom.id,
      name: o.classroom.name,
      code: o.classroom.code,
      license: license ? { status: license.status, expires_at: license.expires_at, image_allowance: license.image_allowance, images_used: license.images_used } : null,
      student_count: students.length,
    },
    summary: {
      active_this_week: activeThisWeek,
      total_students: students.length,
      books_total: bookRows.length,
      books_edited_this_week: booksEditedThisWeek,
      images_used: license?.images_used ?? 0,
      image_allowance: license?.image_allowance ?? 0,
    },
    students: outStudents,
    help,
    assignments,
  })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const classId = new URL(req.url).searchParams.get('classId')

    if (!classId) {
      const t = await requireTeacher(req)
      if (!t.ok) return t.response
      if (!checkRateLimit(`school-dashboard:${t.auth.userId}`, 600).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      return await crossClassDashboard(req, t.auth.userId)
    }

    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response
    if (!checkRateLimit(`school-dashboard:${o.auth.userId}`, 600).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    return await oneClassDashboard(req, o)
  } catch (e) {
    console.error('school/dashboard: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}
