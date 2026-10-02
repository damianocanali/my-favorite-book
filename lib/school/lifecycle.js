// License lifecycle (spec §4.6, privacy review §4.7 / §7.2): a class whose
// license lapsed is purged 90 days later, after emailing the teacher 30 and
// 7 days before. Run nightly by api/cron/retention.js.
//
// When did a license lapse?
//   * lapsed / canceled → status_changed_at (migration 031);
//   * trial / active / pending_payment past expires_at → expires_at
//     (nothing flips the status today; an expired trial is simply unusable);
//   * grace → not lapsed (everything still works);
//   * comped → NEVER purged automatically (owner ruling): the owner deletes
//     a comped class by hand if it has to go.
// A class with no license at all (a 4th class after the trials ran out)
// is never touched here: it never held a license to lapse.
//
// The schedule, with the guarantee that a teacher always gets at least 30
// days' notice, however late the job first sees a lapse:
//   1. lapsed 60+ days, no 30-day warning      → email "in 30 days", stamp
//   2. 30-day warning 23+ days old, lapsed 83+ → email "in 7 days", stamp
//   3. 30-day warning 30+ days old, 7-day warning 7+ days old, lapsed 90+
//                                               → purge the class
// A lapse first seen long after the fact starts at step 1 today.
// Migration 031 clears both stamps whenever the status or expiry changes,
// so a renewal (or a fresh lapse) restarts the schedule; the checks below
// also ignore any stamp older than the lapse, as a second guard.
//
// Fail closed: a warning that can't be emailed (no email provider, or the
// teacher has no address) is NOT stamped, so nothing moves towards a purge;
// the class ids are reported for an owner alert instead.
//
// Dry run (dryRun: true): reads only; returns what each step would do.
import { purgeClassroom } from '../deleteUser.js'
import { sendEmail, emailConfigured } from '../notify/email.js'
import { startDeletionLog, finishDeletionLog, classCounts } from './deletionLog.js'

export const LAPSE_PURGE_DAYS = 90
export const WARN_DAYS = [30, 7] // days before the purge
const WARN30_AT = LAPSE_PURGE_DAYS - WARN_DAYS[0] // 60
const WARN7_AT = LAPSE_PURGE_DAYS - WARN_DAYS[1] // 83
const DAY = 86400000
const EXPIRING = ['trial', 'active', 'pending_payment']
const ENDED = ['lapsed', 'canceled']
const PAGE = 1000
const MAX_PURGES_PER_RUN = 3 // a class purge is up to ~35 account purges

export function lapseDate(license) {
  if (!license) return null
  if (ENDED.includes(license.status)) {
    const at = license.status_changed_at ?? license.updated_at
    return at ? new Date(at) : null
  }
  if (EXPIRING.includes(license.status)) return license.expires_at ? new Date(license.expires_at) : null
  return null // grace, comped: never
}

const validStamp = (stamp, lapsed) => (stamp && new Date(stamp) > lapsed ? new Date(stamp) : null)

/// What tonight's run should do for one license.
/// → 'purge' | 'warn7' | 'warn30' | null
export function nextStep(license, now = new Date()) {
  const lapsed = lapseDate(license)
  if (!lapsed || lapsed > now) return null
  const days = (now - lapsed) / DAY
  const w30 = validStamp(license.purge_warning_30_at, lapsed)
  const w7 = validStamp(license.purge_warning_7_at, lapsed)
  if (!w30) return days >= WARN30_AT ? 'warn30' : null
  if (!w7) return days >= WARN7_AT && now - w30 >= (WARN_DAYS[0] - WARN_DAYS[1]) * DAY ? 'warn7' : null
  if (days >= LAPSE_PURGE_DAYS && now - w30 >= WARN_DAYS[0] * DAY && now - w7 >= WARN_DAYS[1] * DAY) return 'purge'
  return null
}

/// PostgREST filter for the licenses that need something today, for one
/// lapse-date column. Stamps are NULL until sent (031 clears them).
function dueFilter(col, now) {
  const ago = (d) => encodeURIComponent(new Date(now - d * DAY).toISOString())
  return `or=(` +
    `and(purge_warning_30_at.is.null,${col}.lt.${ago(WARN30_AT)}),` +
    `and(purge_warning_7_at.is.null,purge_warning_30_at.lt.${ago(WARN_DAYS[0] - WARN_DAYS[1])},${col}.lt.${ago(WARN7_AT)}),` +
    `and(purge_warning_30_at.lt.${ago(WARN_DAYS[0])},purge_warning_7_at.lt.${ago(WARN_DAYS[1])},${col}.lt.${ago(LAPSE_PURGE_DAYS)})` +
    `)`
}

const SELECT = 'id,owner_user_id,classroom_id,status,expires_at,updated_at,status_changed_at,purge_warning_30_at,purge_warning_7_at,classrooms(id,code,name,locale)'

async function readAllDue(sb, statuses, col, now) {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await sb(
      `/rest/v1/class_licenses?classroom_id=not.is.null&status=in.(${statuses.join(',')})&${dueFilter(col, now)}` +
        `&select=${SELECT}&order=${col}.asc,id.asc&limit=${PAGE}&offset=${offset}`
    )
    if (!res.ok) throw new Error(`class_licenses ${res.status}`)
    const rows = await res.json()
    if (!Array.isArray(rows)) throw new Error('class_licenses not a list')
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

const COPY = {
  en: {
    subject: (n, name) => `“${name}” will be deleted in ${n} days`,
    body: (n, name, date) => [
      `Hello,`,
      ``,
      `The My Book Lab license for your class “${name}” ended, and the class has been resting since.`,
      `In ${n} days (on ${date}) the class will be permanently deleted with everything in it: the children's class accounts, their books, hand-ins, feedback and check-ins. This can't be undone.`,
      ``,
      `To keep it, renew the license before then. To keep a copy, open the class in My Book Lab and use “Export class data”.`,
      ``,
      `— My Book Lab`,
    ].join('\n'),
  },
  it: {
    subject: (n, name) => `“${name}” sarà eliminata tra ${n} giorni`,
    body: (n, name, date) => [
      `Buongiorno,`,
      ``,
      `La licenza My Book Lab della classe “${name}” è scaduta e da allora la classe è in pausa.`,
      `Tra ${n} giorni (il ${date}) la classe verrà eliminata definitivamente con tutto il suo contenuto: gli account di classe di bambine e bambini, i loro libri, le consegne, i commenti e i check-in. L'operazione non si può annullare.`,
      ``,
      `Per conservarla, rinnova la licenza prima di quella data. Per tenerne una copia, apri la classe in My Book Lab e usa “Esporta i dati della classe”.`,
      ``,
      `— My Book Lab`,
    ].join('\n'),
  },
}

export function warningEmail({ days, className, purgeOn, locale }) {
  const c = COPY[locale === 'it' ? 'it' : 'en']
  const date = purgeOn.toISOString().slice(0, 10)
  return { subject: c.subject(days, className), text: c.body(days, className, date) }
}

async function teacherEmail(sb, userId) {
  try {
    const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
    if (!res.ok) return null
    const u = await res.json()
    return u?.email ?? null
  } catch {
    return null
  }
}

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null

export async function runLicenseLifecycle(sb, ctx, { now = new Date(), dryRun = false } = {}) {
  const out = { warned30: 0, warned7: 0, purged: 0, failed: 0, deferred: 0, unsendable: [], planned: [] }
  let rows
  try {
    const [ended, expiring] = await Promise.all([
      readAllDue(sb, ENDED, 'status_changed_at', now),
      readAllDue(sb, EXPIRING, 'expires_at', now),
    ])
    // Oldest lapse first, across both groups.
    rows = [...ended, ...expiring].sort((a, b) => lapseDate(a) - lapseDate(b))
  } catch (e) {
    console.error('[lifecycle] could not list licenses due today', e?.message)
    out.failed++
    return out
  }

  let purges = 0
  for (const lic of rows) {
    const step = nextStep(lic, now)
    const classroom = one(lic.classrooms)
    if (!step || !classroom) continue
    if (dryRun) {
      out.planned.push({ step, license_id: lic.id, classroom_id: classroom.id })
      continue
    }
    try {
      if (step === 'warn30' || step === 'warn7') {
        const days = step === 'warn30' ? WARN_DAYS[0] : WARN_DAYS[1]
        const to = emailConfigured() ? await teacherEmail(sb, lic.owner_user_id) : null
        if (!to) {
          // Fail closed: no notice, no stamp — so no purge either.
          out.unsendable.push(classroom.id)
          continue
        }
        const purgeOn = new Date(now.getTime() + days * DAY)
        const msg = warningEmail({ days, className: classroom.name ?? '', purgeOn, locale: classroom.locale })
        const lapsed = lapseDate(lic)
        const sent = await sendEmail({ to, ...msg, idempotencyKey: `lapse-warn-${days}-${lic.id}-${lapsed.toISOString().slice(0, 10)}` })
        if (!sent.ok) throw new Error(`warning email ${sent.status}`)
        const col = step === 'warn30' ? 'purge_warning_30_at' : 'purge_warning_7_at'
        const stamp = await sb(`/rest/v1/class_licenses?id=eq.${lic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ [col]: now.toISOString() }),
        })
        if (!stamp.ok) throw new Error(`warning stamp ${stamp.status}`)
        out[step === 'warn30' ? 'warned30' : 'warned7']++
        continue
      }
      // step === 'purge'
      if (purges >= MAX_PURGES_PER_RUN) { out.deferred++; continue }
      purges++
      const logId = await startDeletionLog(sb, {
        actorKind: 'system', action: 'purge_lapsed_class', classroomId: classroom.id,
        targetId: classroom.id, counts: await classCounts(sb, classroom.id), reason: `license ${lic.status}, lapsed ${LAPSE_PURGE_DAYS}+ days`,
      })
      if (logId == null) throw new Error('deletion log unavailable')
      const r = await purgeClassroom({ id: classroom.id, code: classroom.code }, {
        ...ctx, deletionLog: { actorKind: 'system', reason: 'license lapsed' },
      })
      await finishDeletionLog(sb, logId, r.ok)
      if (!r.ok) throw new Error('class purge failed')
      out.purged++
    } catch (e) {
      out.failed++
      console.error('[lifecycle] step failed for a license', lic.id, step, e?.message)
    }
  }
  return out
}
