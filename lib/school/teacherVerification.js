// Teacher verification (Stage 4, owner option b).
//
// A teacher is VERIFIED when app_metadata.teacher_verified_at is set. That
// happens either
//   (a) automatically, the first time a teacher with a CONFIRMED email on a
//       recognised school domain reaches a gated action (by = 'domain'), or
//   (b) when the owner approves their request in the admin queue
//       (by = the owner's user id).
// Migration 034 marked every existing class owner verified
// (by = 'grandfathered') so no current class stops working.
//
// app_metadata is writable only with the service role, which is why it is
// the one place this can be trusted (user_metadata is user-editable).
//
// Unverified teachers can sign in and see the teacher area, but cannot
// create classes, start trials, add students or buy.

/// Domains that are schools by construction. Matching is on whole DNS
/// labels from the right, so a lookalike such as `edu.evil.com` or
/// `myschool.edu.attacker.com` never matches.
///   *.edu                    — US educational institutions (registry-restricted)
///   *.k12.<state>.us         — US K-12 districts and schools (e.g. lausd.k12.ca.us)
///   *.<x>.k12.<state>.us     — deeper k12 names
///   *.sch.<cc>               — school second-level under a 2-letter ccTLD
///                              (sch.uk, sch.ae, sch.id, sch.ng…)
/// plus SCHOOL_EMAIL_DOMAINS (comma-separated, suffix match on labels).
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function emailDomain(email) {
  if (typeof email !== 'string') return null
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return DOMAIN_RE.test(domain) ? domain : null
}

/// SCHOOL_EMAIL_DOMAINS → ['district.org', 'school.it'] (lower-cased,
/// leading dots/@ dropped, invalid entries ignored).
export function allowlistFromEnv(raw = process.env.SCHOOL_EMAIL_DOMAINS) {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^[@.]+/, ''))
    .filter((s) => DOMAIN_RE.test(s))
}

const endsWithLabels = (domain, suffix) => domain === suffix || domain.endsWith(`.${suffix}`)

export function isSchoolDomain(domain, allowlist = allowlistFromEnv()) {
  if (typeof domain !== 'string' || !DOMAIN_RE.test(domain)) return false
  const labels = domain.split('.')
  const n = labels.length
  // *.edu — at least one label before "edu".
  if (labels[n - 1] === 'edu' && n >= 2) return true
  // *.k12.<state>.us — at least one label before "k12".
  if (n >= 4 && labels[n - 1] === 'us' && /^[a-z]{2}$/.test(labels[n - 2]) && labels[n - 3] === 'k12') return true
  // *.sch.<cc> — at least one label before "sch".
  if (n >= 3 && labels[n - 2] === 'sch' && /^[a-z]{2}$/.test(labels[n - 1])) return true
  return allowlist.some((suffix) => endsWithLabels(domain, suffix))
}

export function isSchoolEmail(email, allowlist) {
  const d = emailDomain(email)
  return !!d && isSchoolDomain(d, allowlist)
}

/// The verification state carried on a verified JWT (api/_auth.js).
///   { verified: true, by: 'domain'|'grandfathered'|<owner id>|'owner', at }
///   { verified: false, domainEligible: bool }
/// `domainEligible`: the email is confirmed AND on a school domain, so the
/// caller should record it (recordDomainVerification) and treat it as
/// verified.
export function verificationState(auth, { ownerId = process.env.OWNER_USER_ID, allowlist } = {}) {
  const md = auth?.appMetadata ?? {}
  if (md.teacher_verified_at) {
    return { verified: true, by: md.teacher_verified_by ?? null, at: md.teacher_verified_at }
  }
  if (ownerId && auth?.userId === ownerId) return { verified: true, by: 'owner', at: null }
  const domainEligible = !!auth?.emailConfirmed && isSchoolEmail(auth?.email, allowlist)
  return { verified: false, domainEligible }
}

/// Writes app_metadata.teacher_verified_{at,by} with the service role.
/// GoTrue merges app_metadata keys on an admin update, so only these two
/// keys are sent (never a stale copy of the whole object).
export async function writeVerification(sb, userId, by, at = new Date().toISOString()) {
  const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ app_metadata: { teacher_verified_at: at, teacher_verified_by: by } }),
  })
  return res.ok
}
