// License lifecycle (spec §4.6, privacy review §4.7 / §7.2): a class whose
// license lapsed is purged 90 days later, after emailing the teacher 30 and
// 7 days before. Run nightly by api/cron/retention.js.
//
// When did a license lapse?
//   * lapsed / canceled → status_changed_at (migration 031);
//   * trial / active / pending_payment past expires_at → expires_at
//     (nothing flips the status today; an expired trial is simply unusable);
//   * grace → lapsed from expires_at (= paid term end + 14 days, Stage 4);
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
// A lapse purge that stops part-way is marked 'partial' and retried the
// next night — unless the license was renewed meanwhile: then it stops and
// the owner is alerted with the class id (needs_human).
//
// Fail closed: a warning that can't be emailed (no email provider, or the
// teacher has no address) is NOT stamped, so nothing moves towards a purge;
// the class ids are reported for an owner alert instead.
//
// Dry run (dryRun: true): reads only; returns what each step would do.
import { purgeClassroom } from '../deleteUser.js'
import { sendEmail, emailConfigured } from '../notify/email.js'
import { startDeletionLog, finishDeletionLog, classCounts } from './deletionLog.js'
import { isBillingAdmin } from './billingAdmin.js'

export const LAPSE_PURGE_DAYS = 90
export const WARN_DAYS = [30, 7] // days before the purge
const WARN30_AT = LAPSE_PURGE_DAYS - WARN_DAYS[0] // 60
const WARN7_AT = LAPSE_PURGE_DAYS - WARN_DAYS[1] // 83
const DAY = 86400000
// grace: its expires_at is the end of the 14-day grace (Stage 4), so a
// grace that nobody ended lapses from then (review I9).
const EXPIRING = ['trial', 'active', 'pending_payment', 'grace']
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
  return null // comped: never
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

const SELECT = 'id,owner_user_id,classroom_id,status,expires_at,updated_at,status_changed_at,purge_warning_30_at,purge_warning_7_at,school_plan_id,stripe_customer_id,classrooms(id,code,name,locale)'

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

// Owner feedback round 5: pricing is arranged with the school, so the
// class's teacher is told to ASK their school to renew — unless they can
// renew it themselves (they pay for it, are a school billing admin, or are
// the owner). Whoever pays for the class (a school plan's owner, for a
// seat block) gets their own copy too. No child data in any of them.
//   audience: 'teacher' (ask your school) | 'renewer' (renew it yourself)
//           | 'payer' (pays, isn't the class's teacher)
const COPY = {
  en: {
    subject: (n, name) => `“${name}” will be deleted in ${n} days`,
    intro: (name, audience) => audience === 'payer'
      ? `The My Book Lab license for the class “${name}”, which your school plan pays for, ended, and the class has been resting since.`
      : `The My Book Lab license for your class “${name}” ended, and the class has been resting since.`,
    purge: (n, date) => `In ${n} days (on ${date}) the class will be permanently deleted with everything in it: the children's class accounts, their books, hand-ins, feedback and check-ins. This can't be undone.`,
    keep: (date, audience) => audience === 'teacher'
      ? `To keep it, ask your school to renew it before ${date}. To keep a copy, open the class in My Book Lab and use “Export class data”.`
      : audience === 'payer'
        ? `To keep it, renew the license before then. The class's teacher has been told too.`
        : `To keep it, renew the license before then. To keep a copy, open the class in My Book Lab and use “Export class data”.`,
    hello: 'Hello,',
  },
  it: {
    subject: (n, name) => `“${name}” sarà eliminata tra ${n} giorni`,
    intro: (name, audience) => audience === 'payer'
      ? `La licenza My Book Lab della classe “${name}”, pagata dal piano della tua scuola, è scaduta e da allora la classe è in pausa.`
      : `La licenza My Book Lab della classe “${name}” è scaduta e da allora la classe è in pausa.`,
    purge: (n, date) => `Tra ${n} giorni (il ${date}) la classe verrà eliminata definitivamente con tutto il suo contenuto: gli account di classe di bambine e bambini, i loro libri, le consegne, i commenti e i check-in. L'operazione non si può annullare.`,
    keep: (date, audience) => audience === 'teacher'
      ? `Per conservarla, chiedi alla tua scuola di rinnovarla entro il ${date}. Per tenerne una copia, apri la classe in My Book Lab e usa “Esporta i dati della classe”.`
      : audience === 'payer'
        ? `Per conservarla, rinnova la licenza prima di quella data. Anche l'insegnante della classe è stato avvisato.`
        : `Per conservarla, rinnova la licenza prima di quella data. Per tenerne una copia, apri la classe in My Book Lab e usa “Esporta i dati della classe”.`,
    hello: 'Buongiorno,',
  },
}

export function warningEmail({ days, className, purgeOn, locale, audience = 'renewer' }) {
  const c = COPY[locale === 'it' ? 'it' : 'en']
  const date = purgeOn.toISOString().slice(0, 10)
  const text = [c.hello, '', c.intro(className, audience), c.purge(days, date), '', c.keep(date, audience), '', '— My Book Lab'].join('\n')
  return { subject: c.subject(days, className), text }
}

/// { email, billingAdmin } for a user id, or null.
async function userInfo(sb, userId) {
  if (!userId) return null
  try {
    const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
    if (!res.ok) return null
    const u = await res.json()
    if (!u) return null
    return { email: u.email ?? null, billingAdmin: isBillingAdmin({ userId: u.id ?? userId, appMetadata: u.app_metadata }, process.env.OWNER_USER_ID) }
  } catch {
    return null
  }
}

/// Who pays for this license, when we can tell: the class owner for their
/// own card license (a Stripe customer on a non-block license), the school
/// plan's owner for a seat block. null when unknown.
async function payerId(sb, lic) {
  if (lic.school_plan_id) {
    try {
      const r = await sb(`/rest/v1/school_plans?id=eq.${lic.school_plan_id}&select=owner_user_id`)
      if (!r.ok) return null
      return (await r.json())?.[0]?.owner_user_id ?? null
    } catch {
      return null
    }
  }
  return lic.stripe_customer_id ? lic.owner_user_id : null
}

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null

/// classroom id → open log row ids of lapse purges that never finished, for
/// classes that still exist. Throws on a failed read (the caller then does
/// nothing at all tonight).
async function halfPurged(sb) {
  const res = await sb('/rest/v1/deletion_log?action=eq.purge_lapsed_class&status=in.(started,partial)&select=id,classroom_id&limit=1000')
  if (!res.ok) throw new Error(`deletion_log ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('deletion_log not a list')
  const map = new Map()
  for (const r of rows) if (r.classroom_id) map.set(r.classroom_id, [...(map.get(r.classroom_id) ?? []), r.id])
  if (!map.size) return map
  const c = await sb(`/rest/v1/classrooms?id=in.(${[...map.keys()].join(',')})&select=id`)
  if (!c.ok) throw new Error(`classrooms ${c.status}`)
  const alive = new Set((await c.json()).map((x) => x.id))
  for (const [id, logIds] of map) {
    if (alive.has(id)) continue
    // Fully gone after all: close the stale rows.
    for (const logId of logIds) await finishDeletionLog(sb, logId, true)
    map.delete(id)
  }
  return map
}

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

  // Classes whose lapse purge stopped part-way (deletion_log 'partial', or
  // 'started' by a run that died). If the license is still due a purge,
  // tonight's run finishes it. If not — renewed (031 cleared the stamps),
  // or anything else — STOP: a half-deleted class whose school now pays
  // needs a human, so it is reported to the owner and left untouched.
  let half
  try {
    half = await halfPurged(sb)
  } catch (e) {
    console.error('[lifecycle] could not read unfinished purges — doing nothing tonight', e?.message)
    out.failed++
    return out
  }
  out.needs_human = []
  const dueToPurge = new Set(rows.filter((l) => nextStep(l, now) === 'purge').map((l) => one(l.classrooms)?.id ?? l.classroom_id))
  for (const classroomId of half.keys()) {
    if (!dueToPurge.has(classroomId)) out.needs_human.push(classroomId)
  }

  let purges = 0
  for (const lic of rows) {
    const step = nextStep(lic, now)
    const classroom = one(lic.classrooms)
    if (!step || !classroom) continue
    if (half.has(classroom.id) && step !== 'purge') continue // reported above
    if (dryRun) {
      out.planned.push({ step, license_id: lic.id, classroom_id: classroom.id })
      continue
    }
    try {
      if (step === 'warn30' || step === 'warn7') {
        const days = step === 'warn30' ? WARN_DAYS[0] : WARN_DAYS[1]
        const teacher = emailConfigured() ? await userInfo(sb, lic.owner_user_id) : null
        const to = teacher?.email
        if (!to) {
          // Fail closed: no notice, no stamp — so no purge either.
          out.unsendable.push(classroom.id)
          continue
        }
        const purgeOn = new Date(now.getTime() + days * DAY)
        const payer = await payerId(sb, lic)
        const canRenew = teacher.billingAdmin || payer === lic.owner_user_id
        const msg = warningEmail({ days, className: classroom.name ?? '', purgeOn, locale: classroom.locale, audience: canRenew ? 'renewer' : 'teacher' })
        const lapsed = lapseDate(lic)
        const key = `lapse-warn-${days}-${lic.id}-${lapsed.toISOString().slice(0, 10)}`
        const sent = await sendEmail({ to, ...msg, idempotencyKey: key })
        if (!sent.ok) throw new Error(`warning email ${sent.status}`)
        // The payer, when it's someone else (a school plan's owner): best
        // effort — the teacher's notice is the one the purge depends on.
        if (payer && payer !== lic.owner_user_id) {
          const p = await userInfo(sb, payer)
          if (p?.email && p.email !== to) {
            const pm = warningEmail({ days, className: classroom.name ?? '', purgeOn, locale: classroom.locale, audience: 'payer' })
            const ps = await sendEmail({ to: p.email, ...pm, idempotencyKey: `${key}-payer` })
            if (!ps.ok) console.error('[lifecycle] payer warning not sent for a license', lic.id)
          }
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
      const r = await purgeClassroom({ id: classroom.id, code: classroom.code }, {
        ...ctx, deletionLog: { actorKind: 'system', reason: 'license lapsed' },
      })
      await finishDeletionLog(sb, logId, r.ok ? true : 'partial')
      if (!r.ok) throw new Error('class purge failed')
      // An earlier, stopped attempt at this same class is now complete too.
      for (const oldId of half.get(classroom.id) ?? []) await finishDeletionLog(sb, oldId, true)
      out.purged++
    } catch (e) {
      out.failed++
      console.error('[lifecycle] step failed for a license', lic.id, step, e?.message)
    }
  }
  return out
}

/// Stage 4: a license (or school plan) in `grace` whose grace ended
/// (expires_at = end of the paid term + 14 days, lib/school/billingState.js)
/// becomes `lapsed`, which starts the retention schedule above. Stripe's own
/// dunning normally ends it first (subscription unpaid/canceled → webhook);
/// this is the backstop. Status only: starts_at and everything else stay.
/// Dry run: counts only.
export async function endExpiredGrace(sb, { now = new Date(), dryRun = true } = {}) {
  const out = { licenses: 0, plans: 0, failed: 0 }
  const at = encodeURIComponent(new Date(now).toISOString())
  for (const [table, key] of [['school_plans', 'plans'], ['class_licenses', 'licenses']]) {
    const path = `/rest/v1/${table}?status=eq.grace&expires_at=lt.${at}`
    const res = dryRun
      ? await sb(`${path}&select=id`)
      : await sb(path, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'lapsed', updated_at: new Date(now).toISOString() }) })
    // 404: school_plans doesn't exist before migration 034.
    if (!res.ok) { if (res.status !== 404) out.failed++; continue }
    const rows = await res.json().catch(() => [])
    out[key] = Array.isArray(rows) ? rows.length : 0
  }
  return out
}
