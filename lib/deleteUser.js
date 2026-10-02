import { deleteAtVendor } from './vendorDeletion.js'
import { startDeletionLog, finishDeletionLog, studentCounts, classCounts } from './school/deletionLog.js'

// Shared so the schedule endpoint and the purge cron can never disagree.
export const GRACE_DAYS = 7

// Must match BUCKET in api/_imageStore.js, which writes the objects.
const ILLUSTRATION_BUCKET = 'book-illustrations'

// Storage's list endpoint returns at most this many names per call.
export const STORAGE_PAGE = 1000
// A runaway guard, not a real limit: 200 pages is 200,000 objects under one
// prefix, far beyond any real account. Hitting it is logged loudly.
const MAX_STORAGE_PAGES = 200

/// Deletes every object under `prefix` in `bucket`, page by page.
///
/// Storage has no "delete by prefix", so this lists a page of names and
/// deletes them, then lists again from the start (offset 0, because the
/// page just deleted is gone) until a page comes back short. A failed list
/// or delete stops the loop rather than spinning on it.
///
/// Returns { ok, deleted }. `ok` is false when a list or delete failed (or
/// threw) or the runaway guard tripped; callers decide whether that is
/// fatal (print PDFs, whose order ids are lost with the account) or
/// best-effort (illustrations, see purgeStoredImages).
export async function purgeStoragePrefix(sb, bucket, prefix, label = 'storage') {
  let deleted = 0
  try {
    for (let page = 0; page < MAX_STORAGE_PAGES; page++) {
      const listRes = await sb(`/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, limit: STORAGE_PAGE, offset: 0 }),
      })
      if (!listRes.ok) {
        console.warn(`[purgeUser] ${label} list failed`, listRes.status)
        return { ok: false, deleted }
      }
      const objects = await listRes.json().catch(() => null)
      if (!Array.isArray(objects)) {
        console.warn(`[purgeUser] ${label} list returned a non-array body`)
        return { ok: false, deleted }
      }
      if (objects.length === 0) return { ok: true, deleted }

      const prefixes = objects.map((o) => `${prefix}${o.name}`)
      const delRes = await sb(`/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes }),
      })
      if (!delRes.ok) {
        console.warn(`[purgeUser] ${label} delete failed`, delRes.status, prefixes.length, 'objects')
        return { ok: false, deleted }
      }
      deleted += prefixes.length
      if (objects.length < STORAGE_PAGE) return { ok: true, deleted }
    }
    console.error(`[purgeUser] ${label} purge hit the ${MAX_STORAGE_PAGES}-page guard — objects may remain`)
    return { ok: false, deleted }
  } catch (e) {
    console.warn(`[purgeUser] ${label} purge threw`, e?.message)
    return { ok: false, deleted }
  }
}

/// Remove every stored illustration belonging to one user.
///
/// Best-effort by design: a storage failure must not abort the purge,
/// because the database rows — the part that actually carries the child's
/// name and age — are already gone by the time this runs, and leaving the
/// account undeleted over an orphaned PNG is the worse trade. Failures are
/// logged loudly (in purgeStoragePrefix) so they can be swept separately.
async function purgeStoredImages(userId, sb) {
  return purgeStoragePrefix(sb, ILLUSTRATION_BUCKET, `${userId}/`, 'storage')
}

// A child's rendered "My Writing Year" PDFs (migration 024): the admin
// print step stores them in the private print-pdfs bucket as
// writing-year/<child auth user id>/<request id>-{interior,cover}.pdf, flat
// under the user's folder so one list finds them all. Best-effort, like the
// illustrations above: the database rows are gone with the auth user.
const PRINT_BUCKET = 'print-pdfs'
export const writingYearPdfPrefix = (userId) => `writing-year/${userId}/`

async function purgeWritingYearPdfs(userId, sb) {
  return purgeStoragePrefix(sb, PRINT_BUCKET, writingYearPdfPrefix(userId), 'writing-year')
}

// A consumer's printed-book PDFs: api/print-orders/pdf-worker.js stores
// them as print-pdfs/<order id>/{interior,cover}.pdf. print_orders.user_id
// is ON DELETE CASCADE, so once the auth user is gone the order ids — the
// only way to find these files — go with it. That makes this step fail
// CLOSED, unlike the illustrations: a failed lookup or delete aborts the
// purge so tomorrow's run still has the ids.
export const printOrderPdfPrefix = (orderId) => `${orderId}/`

async function purgePrintOrderPdfs(userId, sb) {
  const res = await sb(`/rest/v1/print_orders?user_id=eq.${userId}&select=id`)
  if (!res.ok) {
    console.error('[purgeUser] print_orders lookup failed — aborting so the order ids stay findable', res.status)
    return { ok: false }
  }
  const orders = await res.json().catch(() => null)
  if (!Array.isArray(orders)) {
    console.error('[purgeUser] print_orders lookup returned a non-array body — aborting')
    return { ok: false }
  }
  for (const { id } of orders) {
    if (!id) continue
    const r = await purgeStoragePrefix(sb, PRINT_BUCKET, printOrderPdfPrefix(id), 'print-order')
    if (!r.ok) {
      console.error('[purgeUser] print order PDF delete failed — aborting', id)
      return { ok: false }
    }
  }
  return { ok: true }
}

// Shared by purgeUser and purgeClassroom so both talk to PostgREST/GoTrue
// the same way.
function makeSb({ supabaseUrl, serviceKey }) {
  return (path, init = {}) =>
    fetch(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(init.headers || {}),
      },
    })
}

/// Purges one classroom a teacher owned (schools stage 1, migration 018).
///
/// A classroom's students do NOT cascade-delete from the classroom row —
/// class_students.classroom_id is ON DELETE RESTRICT, same as the owner FK —
/// so every student has to be purged, as a full account, before the class
/// itself can go. Each student is purged through purgeUser itself (not just
/// their class_students row): that's the only path that also removes their
/// own books, images and auth user, and it's safe to reuse here because
/// students never own classes of their own (their own classrooms lookup
/// below will simply come back empty).
///
/// Aborts on the first failure so a half-purged class is left in a state the
/// next cron run can find and retry, rather than silently dropping some
/// students' data while "completing".
const STUDENT_PURGE_CONCURRENCY = 4

export async function purgeClassroom(classroom, ctx) {
  const sb = makeSb(ctx)

  // No status filter: a student removed from the class (soft-deleted via
  // class_students.status) still has a row here and still needs their own
  // account purged. Who counts as "in this classroom" is decided by the
  // foreign key alone, never by status.
  const studentsRes = await sb(`/rest/v1/class_students?classroom_id=eq.${classroom.id}&select=id,auth_user_id`)
  if (!studentsRes.ok) {
    console.error('[purgeClassroom] student list failed — aborting', classroom.id, studentsRes.status)
    return { ok: false }
  }
  const students = await studentsRes.json().catch(() => null)
  if (!Array.isArray(students)) {
    // Fail closed, same reasoning as the classrooms list in purgeUser below:
    // an unexpected body must never be read as "no students".
    console.error('[purgeClassroom] student list returned a non-array body — aborting', classroom.id)
    return { ok: false }
  }
  // A few students at a time: a full class purged one by one is ~35
  // sequential account purges, too slow for a teacher waiting on "Delete
  // class". Workers stop picking up new students after the first failure,
  // and the class row is only deleted if every student purge succeeded.
  //
  // ctx.deletionLog ({ actorKind, actorUserId?, reason? }): every child's
  // purge gets its own deletion_log row (ids and counts, no names), written
  // first; a row that can't be written stops the purge (fail closed).
  const { deletionLog, ...purgeCtx } = ctx
  let failedStudent = null
  let next = 0
  const purgeOne = async (student) => {
    let logId = null
    if (deletionLog) {
      logId = await startDeletionLog(sb, {
        actorUserId: deletionLog.actorUserId ?? null, actorKind: deletionLog.actorKind,
        action: 'purge_class_student', classroomId: classroom.id, targetId: student.id ?? null,
        counts: await studentCounts(sb, student), reason: deletionLog.reason ?? null,
      })
      if (logId == null) return { ok: false }
    }
    const result = await purgeUser(student.auth_user_id, { ...purgeCtx, skipVendors: true })
    if (deletionLog) await finishDeletionLog(sb, logId, result.ok)
    return result
  }
  const worker = async () => {
    while (!failedStudent && next < students.length) {
      const student = students[next++]
      const result = await purgeOne(student)
      if (!result.ok) failedStudent = student.auth_user_id
    }
  }
  await Promise.all(Array.from({ length: Math.min(STUDENT_PURGE_CONCURRENCY, students.length) }, worker))
  if (failedStudent) {
    console.error('[purgeClassroom] a student purge failed — aborting', classroom.id, failedStudent)
    return { ok: false }
  }

  // Legacy (pre-schools) anonymous/parent submissions tied to this class's
  // code. classroom_code has ON DELETE CASCADE, so this is best-effort — a
  // failure here does not abort the purge — but it's still logged loudly:
  // a cascade nobody is watching is exactly how the published_books bug
  // this file guards against happened in the first place.
  const codeSubmissionsRes = await sb(
    `/rest/v1/submissions?classroom_code=eq.${encodeURIComponent(classroom.code)}`,
    { method: 'DELETE' }
  )
  if (!codeSubmissionsRes.ok) {
    console.warn(
      '[purgeClassroom] submissions-by-code delete failed (best-effort; FK cascades from classrooms)',
      classroom.id, codeSubmissionsRes.status
    )
  }

  // class_licenses.classroom_id is ON DELETE SET NULL, so this too would
  // happen automatically — done explicitly so the license row is already
  // unlinked (and therefore not archived-looking) the moment this returns.
  // Best-effort like the submissions delete above: the FK covers it either way.
  const licenseUnlinkRes = await sb(`/rest/v1/class_licenses?classroom_id=eq.${classroom.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroom_id: null }),
  })
  if (!licenseUnlinkRes.ok) {
    console.warn(
      '[purgeClassroom] class_licenses unlink failed (best-effort; FK is ON DELETE SET NULL)',
      classroom.id, licenseUnlinkRes.status
    )
  }

  const res = await sb(`/rest/v1/classrooms?id=eq.${classroom.id}`, { method: 'DELETE' })
  return { ok: res.ok }
}

// Irreversible hard-delete of a user and all their data. Called by the purge
// cron after the grace window, by the retention cron (removed students,
// lapsed classes) and by a teacher's explicit "delete now" — never directly
// from a consumer's own request.
//
// ctx: { supabaseUrl, serviceKey, stripeSecretKey?, revenueCatKey?,
//        skipVendors? }. skipVendors is set for class (student) accounts,
//        which never buy anything, so a 35-child class purge doesn't make
//        35 pointless vendor calls.
export async function purgeUser(userId, ctx) {
  const { supabaseUrl, serviceKey, stripeSecretKey, revenueCatKey, skipVendors } = ctx
  const sb = makeSb({ supabaseUrl, serviceKey })

  if (stripeSecretKey && !skipVendors) {
    // The subscriptions row is the only link to the Stripe customer, and it
    // is deleted below. A failed read must not be taken for "no customer":
    // abort, and the purge cron retries tomorrow with the row intact.
    let rows
    try {
      const subsRes = await sb(
        `/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id,stripe_customer_id`
      )
      rows = subsRes.ok ? await subsRes.json().catch(() => null) : null
      if (!Array.isArray(rows)) {
        console.error('[purgeUser] subscriptions lookup failed — aborting so the Stripe customer stays findable', subsRes.status)
        return { ok: false }
      }
    } catch (e) {
      console.error('[purgeUser] subscriptions lookup threw — aborting', e?.message)
      return { ok: false }
    }
    try {
      const stripeSubId = rows?.[0]?.stripe_subscription_id
      if (stripeSubId) {
        const cancelRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        )
        if (!cancelRes.ok) {
          // Status only: Stripe error bodies can echo customer details.
          console.warn('[purgeUser] Stripe cancel failed', cancelRes.status)
        }
      }
      // Schools billing (Stage 4): the teacher's class-license and
      // school-plan customers. Deleting a Customer cancels its
      // subscriptions, so nothing keeps billing a deleted account.
      const schoolCustomers = []
      for (const table of ['class_licenses', 'school_plans']) {
        const r = await sb(`/rest/v1/${table}?owner_user_id=eq.${userId}&stripe_customer_id=not.is.null&select=stripe_customer_id`)
        // Before migration 034 school_plans doesn't exist: nothing to cancel.
        if (r.ok) schoolCustomers.push(...((await r.json().catch(() => [])) ?? []))
      }
      // Then the Customer itself (name, email, card fingerprints). Queued
      // for retry on failure; never blocks the purge.
      const customerIds = [...new Set([...rows, ...schoolCustomers].map((r) => r.stripe_customer_id).filter(Boolean))]
      for (const customerId of customerIds) {
        await deleteAtVendor(sb, 'stripe', customerId, { stripeSecretKey })
      }
    } catch (e) {
      console.warn('[purgeUser] Stripe cleanup threw', e?.message)
    }
  }

  // RevenueCat's app_user_id is the Supabase user id (RC.logIn(userId)).
  // Every consumer account is tried: RevenueCat answers 404 (treated as
  // done) for one that never opened the iOS paywall.
  if (revenueCatKey && !skipVendors) {
    await deleteAtVendor(sb, 'revenuecat', userId, { revenueCatKey })
  }

  await sb(`/rest/v1/user_books?user_id=eq.${userId}`, { method: 'DELETE' })
  await sb(`/rest/v1/subscriptions?user_id=eq.${userId}`, { method: 'DELETE' })

  // Legacy (pre-schools) classroom submissions this user made while signed
  // in (submissions.user_id is nullable and ON DELETE CASCADE — migration
  // 018). Best-effort — the FK cascade covers it regardless — but failures
  // are still surfaced rather than silently swallowed.
  const userSubmissionsRes = await sb(`/rest/v1/submissions?user_id=eq.${userId}`, { method: 'DELETE' })
  if (!userSubmissionsRes.ok) {
    console.warn(
      '[purgeUser] submissions-by-user delete failed (best-effort; FK cascades from auth.users)',
      userSubmissionsRes.status
    )
  }

  // A student's assignment hand-ins (migration 019). class_submissions.user_id
  // is ON DELETE CASCADE, and so is every other 019 FK, so nothing here can
  // block the auth delete. Deleted explicitly anyway (spec §3.1), best-effort
  // like the legacy submissions above; their feedback cascades with them.
  const handInsRes = await sb(`/rest/v1/class_submissions?user_id=eq.${userId}`, { method: 'DELETE' })
  if (!handInsRes.ok) {
    console.warn(
      '[purgeUser] class_submissions delete failed (best-effort; FK cascades from auth.users)',
      handInsRes.status
    )
  }

  // Published gallery books. These MUST be deleted here, before the auth
  // delete below, and the ordering is the whole point: published_books.user_id
  // is ON DELETE SET NULL (supabase-migrations/001_published_books.sql:6), so
  // deleting the auth user first does not remove the row — it orphans it. The
  // row keeps author_name and author_age, which are a child's first name and
  // age, and the book stays publicly readable in the gallery forever. Worse,
  // once user_id is NULL there is no way left to find which rows belonged to
  // the deleted account, so the mistake is unrecoverable rather than merely
  // wrong.
  //
  // Deleting rather than anonymising is deliberate: an erasure request from a
  // parent is about the child's name, age and story together, and stripping
  // the name would still leave the story they asked us to remove.
  const booksRes = await sb(`/rest/v1/published_books?user_id=eq.${userId}`, { method: 'DELETE' })
  if (!booksRes.ok) {
    // Fail the purge rather than deleting the auth user anyway. Continuing
    // would null the user_id and strand these rows permanently; leaving the
    // deletion queued means the cron retries tomorrow with the link intact.
    console.error('[purgeUser] published_books delete failed — aborting so the rows stay findable', booksRes.status)
    return { ok: false }
  }

  // Generated illustrations. api/_imageStore.js namespaces every object as
  // `${userId}/<kind>-<id>.png` in the book-illustrations bucket, which is
  // public — so anything left behind stays world-readable at a stable URL.
  await purgeStoredImages(userId, sb)
  await purgeWritingYearPdfs(userId, sb)

  // Consumer print PDFs: fail closed (see purgePrintOrderPdfs).
  const printPdfs = await purgePrintOrderPdfs(userId, sb)
  if (!printPdfs.ok) return { ok: false }

  // Schools stage 1 (migration 018): classrooms.owner_user_id is now ON
  // DELETE RESTRICT, not SET NULL — the opposite failure mode from
  // published_books above, but the same fix applies. If we deleted the auth
  // user first, the database would simply refuse (RESTRICT), which sounds
  // safe, but it isn't: the caller would see a bare failed auth delete with
  // no record of WHY, and every student in that teacher's classes — whose
  // auth users do not cascade from the classroom at all, only from
  // class_students, and only in the student -> class_students direction —
  // would be left fully intact indefinitely, undiscoverable from here.
  // Purging classes (and through them, every student in them) BEFORE the
  // auth delete, and aborting the whole purge the moment any class fails to
  // purge, keeps the teacher's account (and each half-purged class) visibly
  // undeleted for tomorrow's retry, exactly like the published_books guard.
  const classroomsRes = await sb(`/rest/v1/classrooms?owner_user_id=eq.${userId}&select=id,code`)
  if (!classroomsRes.ok) {
    // Fail closed: a broken list-read must never be read as "no classes" —
    // that would silently skip real classes and their real students.
    console.error(
      '[purgeUser] classrooms list failed — aborting so owned classes stay findable',
      classroomsRes.status
    )
    return { ok: false }
  }
  const classrooms = await classroomsRes.json().catch(() => null)
  if (!Array.isArray(classrooms)) {
    // Fail closed: an unexpected body must never be read as "no classes",
    // for the same reason a failed request must not be — see above.
    console.error('[purgeUser] classrooms list returned a non-array body — aborting')
    return { ok: false }
  }
  // Evidence for every class (and, inside purgeClassroom, every child) a
  // teacher's account deletion takes with it. Fail closed like the rest.
  for (const classroom of classrooms) {
    const logId = await startDeletionLog(sb, {
      actorUserId: userId, actorKind: 'system', action: 'purge_teacher_class',
      classroomId: classroom.id, targetId: classroom.id, counts: await classCounts(sb, classroom.id),
      reason: 'teacher account deleted',
    })
    if (logId == null) {
      console.error('[purgeUser] deletion log unavailable — aborting before a class purge', classroom.id)
      return { ok: false }
    }
    const result = await purgeClassroom(classroom, {
      supabaseUrl, serviceKey,
      deletionLog: { actorKind: 'system', actorUserId: userId, reason: 'teacher account deleted' },
    })
    await finishDeletionLog(sb, logId, result.ok)
    if (!result.ok) {
      console.error('[purgeUser] a class purge failed — aborting', classroom.id)
      return { ok: false }
    }
  }

  // class_licenses.owner_user_id is ALSO ON DELETE RESTRICT, independent of
  // classroom_id (a license can outlive its classroom — SET NULL above). Any
  // license still owned by this teacher (e.g. one whose class was already
  // deleted, orphaning classroom_id but not owner_user_id) would otherwise
  // block the auth delete the same way.
  //
  // Paid licenses' and school plans' Stripe customers were deleted at the
  // top of this function (which cancels their subscriptions), before these
  // rows — the only link to them — go.
  const licensesRes = await sb(`/rest/v1/class_licenses?owner_user_id=eq.${userId}`, { method: 'DELETE' })
  if (!licensesRes.ok) {
    console.error('[purgeUser] class_licenses delete failed — aborting', licensesRes.status)
    return { ok: false }
  }
  // school_plans.owner_user_id is ON DELETE RESTRICT too (migration 034).
  // Colleagues' seat blocks keep their paid term (school_plan_id → NULL)
  // and lapse at its end. 404 = the table doesn't exist yet (pre-034).
  const plansRes = await sb(`/rest/v1/school_plans?owner_user_id=eq.${userId}`, { method: 'DELETE' })
  if (!plansRes.ok && plansRes.status !== 404) {
    console.error('[purgeUser] school_plans delete failed — aborting', plansRes.status)
    return { ok: false }
  }

  const deleteRes = await sb(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
  if (!deleteRes.ok) {
    console.error('[purgeUser] auth delete failed', deleteRes.status)
    return { ok: false }
  }
  // The ON DELETE CASCADE from auth.users already removes this; delete it
  // explicitly too so a non-cascading config can't re-queue the same user.
  await sb(`/rest/v1/account_deletions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {})
  return { ok: true }
}
