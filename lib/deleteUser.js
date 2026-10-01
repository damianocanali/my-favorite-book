// Shared so the schedule endpoint and the purge cron can never disagree.
export const GRACE_DAYS = 7

// Must match BUCKET in api/_imageStore.js, which writes the objects.
const ILLUSTRATION_BUCKET = 'book-illustrations'

/// Remove every stored illustration belonging to one user.
///
/// Storage has no "delete by prefix", so this lists the user's folder and
/// deletes the names it finds. Best-effort by design: a storage failure must
/// not abort the purge, because the database rows — the part that actually
/// carries the child's name and age — are already gone by the time this runs,
/// and leaving the account undeleted over an orphaned PNG is the worse trade.
/// Failures are logged loudly so they can be swept separately.
async function purgeStoredImages(userId, sb) {
  try {
    const listRes = await sb(`/storage/v1/object/list/${ILLUSTRATION_BUCKET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // limit is the API's page size; a child with more illustrations than
      // this keeps the remainder, hence the warning below.
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 }),
    })
    if (!listRes.ok) {
      console.warn('[purgeUser] storage list failed', listRes.status)
      return
    }
    const objects = await listRes.json().catch(() => [])
    if (!Array.isArray(objects) || objects.length === 0) return
    if (objects.length === 1000) {
      console.warn(`[purgeUser] storage list hit the page limit for ${userId} — some objects may remain`)
    }

    const prefixes = objects.map((o) => `${userId}/${o.name}`)
    const delRes = await sb(`/storage/v1/object/${ILLUSTRATION_BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes }),
    })
    if (!delRes.ok) {
      console.warn('[purgeUser] storage delete failed', delRes.status, prefixes.length, 'objects')
    }
  } catch (e) {
    console.warn('[purgeUser] storage purge threw', e?.message)
  }
}

// A child's rendered "My Writing Year" PDFs (migration 024): the admin
// print step stores them in the private print-pdfs bucket as
// writing-year/<child auth user id>/<request id>-{interior,cover}.pdf, flat
// under the user's folder so one list finds them all. Best-effort, like the
// illustrations above: the database rows are gone with the auth user.
const PRINT_BUCKET = 'print-pdfs'
export const writingYearPdfPrefix = (userId) => `writing-year/${userId}/`

async function purgeWritingYearPdfs(userId, sb) {
  try {
    const prefix = writingYearPdfPrefix(userId)
    const listRes = await sb(`/storage/v1/object/list/${PRINT_BUCKET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000 }),
    })
    if (!listRes.ok) {
      console.warn('[purgeUser] writing-year list failed', listRes.status)
      return
    }
    const objects = await listRes.json().catch(() => [])
    if (!Array.isArray(objects) || objects.length === 0) return
    const delRes = await sb(`/storage/v1/object/${PRINT_BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: objects.map((o) => `${prefix}${o.name}`) }),
    })
    if (!delRes.ok) console.warn('[purgeUser] writing-year delete failed', delRes.status)
  } catch (e) {
    console.warn('[purgeUser] writing-year purge threw', e?.message)
  }
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
export async function purgeClassroom(classroom, ctx) {
  const sb = makeSb(ctx)

  // No status filter: a student removed from the class (soft-deleted via
  // class_students.status) still has a row here and still needs their own
  // account purged. Who counts as "in this classroom" is decided by the
  // foreign key alone, never by status.
  const studentsRes = await sb(`/rest/v1/class_students?classroom_id=eq.${classroom.id}&select=auth_user_id`)
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
  for (const { auth_user_id: studentId } of students) {
    const result = await purgeUser(studentId, ctx)
    if (!result.ok) {
      console.error('[purgeClassroom] a student purge failed — aborting', classroom.id, studentId)
      return { ok: false }
    }
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

// Irreversible hard-delete of a user and all their data. Called ONLY by the
// purge cron after the grace window — never directly from a user request.
export async function purgeUser(userId, { supabaseUrl, serviceKey, stripeSecretKey }) {
  const sb = makeSb({ supabaseUrl, serviceKey })

  if (stripeSecretKey) {
    try {
      const subsRes = await sb(
        `/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id`
      )
      const rows = await subsRes.json().catch(() => [])
      const stripeSubId = rows?.[0]?.stripe_subscription_id
      if (stripeSubId) {
        const cancelRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        )
        if (!cancelRes.ok) {
          console.warn('[purgeUser] Stripe cancel failed', cancelRes.status, await cancelRes.text().catch(() => ''))
        }
      }
    } catch (e) {
      console.warn('[purgeUser] Stripe cancel threw', e?.message)
    }
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
    console.error(
      '[purgeUser] published_books delete failed — aborting so the rows stay findable',
      booksRes.status,
      await booksRes.text().catch(() => '')
    )
    return { ok: false }
  }

  // Generated illustrations. api/_imageStore.js namespaces every object as
  // `${userId}/<kind>-<id>.png` in the book-illustrations bucket, which is
  // public — so anything left behind stays world-readable at a stable URL.
  await purgeStoredImages(userId, sb)
  await purgeWritingYearPdfs(userId, sb)

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
  for (const classroom of classrooms) {
    const result = await purgeClassroom(classroom, { supabaseUrl, serviceKey })
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
  // Stage 1 licenses are trial/comped only, so there is no Stripe object to
  // cancel yet. When a later stage adds paid licenses with their own
  // stripe_subscription_id, THAT subscription must be cancelled here, before
  // this delete — the same way the consumer subscription is cancelled at the
  // top of this function — or Stripe keeps billing a license whose row (and
  // class) no longer exist to show for it.
  const licensesRes = await sb(`/rest/v1/class_licenses?owner_user_id=eq.${userId}`, { method: 'DELETE' })
  if (!licensesRes.ok) {
    console.error('[purgeUser] class_licenses delete failed — aborting', licensesRes.status)
    return { ok: false }
  }

  const deleteRes = await sb(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
  if (!deleteRes.ok) {
    console.error('[purgeUser] auth delete failed', deleteRes.status, await deleteRes.text().catch(() => ''))
    return { ok: false }
  }
  // The ON DELETE CASCADE from auth.users already removes this; delete it
  // explicitly too so a non-cascading config can't re-queue the same user.
  await sb(`/rest/v1/account_deletions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {})
  return { ok: true }
}
