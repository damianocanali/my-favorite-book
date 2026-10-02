// License lifecycle (spec §4.6, privacy review §4.7 / §7.2): a class whose
// license lapsed is purged 90 days later, after warning the teacher by
// email 30 and 7 days before. Run nightly by api/cron/retention.js.
//
// When did a license lapse?
//   * status lapsed / canceled → its updated_at (the change to that status);
//   * trial / active / comped / pending_payment past expires_at → expires_at
//     (nothing flips the status today; an expired trial is simply unusable);
//   * grace → not lapsed (everything still works).
// A class with no license at all (a 4th class after the trials ran out)
// is never touched here: it never held a license to lapse.
//
// Safety rails, because this deletes children's work:
//   * nothing is purged unless the 7-day warning went out (or email is not
//     configured — logged) at least 6 days earlier, so a deploy, a clock
//     error or a failed email can never cause a surprise purge;
//   * a renewal before the purge moves the lapse date, which invalidates
//     the old warnings and stops the clock.
import { purgeClassroom } from '../deleteUser.js'
import { sendEmail, emailConfigured } from '../notify/email.js'
import { startDeletionLog, finishDeletionLog, classCounts } from './deletionLog.js'

export const LAPSE_PURGE_DAYS = 90
export const WARN_DAYS = [30, 7] // days before the purge
const DAY = 86400000
const EXPIRING = ['trial', 'active', 'comped', 'pending_payment']
const ENDED = ['lapsed', 'canceled']
const BATCH = 50
const MAX_PURGES_PER_RUN = 3 // a class purge is up to ~35 account purges

export function lapseDate(license) {
  if (!license) return null
  if (ENDED.includes(license.status)) return license.updated_at ? new Date(license.updated_at) : null
  if (EXPIRING.includes(license.status)) {
    const exp = license.expires_at ? new Date(license.expires_at) : null
    return exp
  }
  return null
}

/// What tonight's run should do for one license.
/// → 'purge' | 'warn7' | 'warn30' | null
export function nextStep(license, now = new Date()) {
  const lapsed = lapseDate(license)
  if (!lapsed || lapsed > now) return null
  const days = (now - lapsed) / DAY
  const warned = (col) => license[col] && new Date(license[col]) > lapsed ? new Date(license[col]) : null
  const w7 = warned('purge_warning_7_at')
  const w30 = warned('purge_warning_30_at')
  if (days >= LAPSE_PURGE_DAYS - WARN_DAYS[1]) {
    if (!w7) return 'warn7'
    if (days >= LAPSE_PURGE_DAYS && now - w7 >= 6 * DAY) return 'purge'
    return null
  }
  if (days >= LAPSE_PURGE_DAYS - WARN_DAYS[0] && !w30) return 'warn30'
  return null
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

export async function runLicenseLifecycle(sb, ctx, { now = new Date() } = {}) {
  const out = { warned30: 0, warned7: 0, purged: 0, failed: 0, deferred: 0 }
  const cutoff = encodeURIComponent(new Date(now - (LAPSE_PURGE_DAYS - WARN_DAYS[0]) * DAY).toISOString())
  const res = await sb(
    `/rest/v1/class_licenses?classroom_id=not.is.null` +
      `&or=(and(status.in.(${ENDED.join(',')}),updated_at.lt.${cutoff}),and(status.in.(${EXPIRING.join(',')}),expires_at.lt.${cutoff}))` +
      `&select=id,owner_user_id,classroom_id,status,expires_at,updated_at,purge_warning_30_at,purge_warning_7_at,classrooms(id,code,name,locale)` +
      `&order=expires_at.asc&limit=${BATCH}`
  )
  if (!res.ok) {
    console.error('[lifecycle] could not list lapsed licenses', res.status)
    out.failed++
    return out
  }
  const rows = await res.json().catch(() => null)
  let purges = 0
  for (const lic of Array.isArray(rows) ? rows : []) {
    const step = nextStep(lic, now)
    const classroom = one(lic.classrooms)
    if (!step || !classroom) continue
    try {
      if (step === 'warn30' || step === 'warn7') {
        const days = step === 'warn30' ? WARN_DAYS[0] : WARN_DAYS[1]
        const lapsed = lapseDate(lic)
        // The purge date as the teacher will experience it: never earlier
        // than 7 days after this (possibly late) warning.
        const purgeOn = new Date(Math.max(lapsed.getTime() + LAPSE_PURGE_DAYS * DAY, now.getTime() + days * DAY))
        const to = await teacherEmail(sb, lic.owner_user_id)
        if (to && emailConfigured()) {
          const msg = warningEmail({ days, className: classroom.name ?? '', purgeOn, locale: classroom.locale })
          const sent = await sendEmail({ to, ...msg, idempotencyKey: `lapse-warn-${days}-${lic.id}-${lapsed.toISOString().slice(0, 10)}` })
          if (!sent.ok) throw new Error(`warning email ${sent.status}`)
        } else {
          // No address / no email provider: proceed, loudly. The purge
          // still waits 6+ days after this stamp.
          console.warn('[lifecycle] lapse warning could not be emailed (no address or email not configured)', lic.id, days)
        }
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
      const r = await purgeClassroom({ id: classroom.id, code: classroom.code }, ctx)
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
