// "2-step sign-in" (TOTP) on web, via Supabase Auth MFA (review §7 item 15).
// Optional and per account: offered to teachers in Account settings. Every
// helper takes the supabase client so it is unit-testable with a fake.
//
// Owner prerequisite: TOTP must be enabled under Supabase Dashboard →
// Authentication → Multi-Factor (it is on by default for new projects).

/// Every verified TOTP factor (a teacher may add a backup authenticator).
export async function verifiedTotps(sb) {
  const { data, error } = await sb.auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp ?? []).filter((f) => f.status === 'verified')
}

/// The account's first verified TOTP factor, or null.
export async function verifiedTotp(sb) {
  return (await verifiedTotps(sb))[0] ?? null
}

/// True when this session signed in with a password only but the account
/// has 2-step sign-in on: the code must be entered before anything else.
export async function needsSecondStep(sb) {
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return false
  return data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2'
}

/// Accepts "123 456", "123-456" etc.; returns 6 digits or null.
export function cleanCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/// Step 1 of turning it on: a fresh, unverified factor with its QR code.
/// Any earlier unverified factor (an abandoned setup) is removed first, so
/// setup can always be restarted.
export async function startEnroll(sb, friendlyName = 'My Book Lab') {
  const { data: list } = await sb.auth.mfa.listFactors()
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${friendlyName} ${Date.now().toString(36)}` })
  if (error) throw error
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

/// Verifies a code against a factor (step 2 of enrolment, and the
/// sign-in step-up). Raises the session to aal2 on success.
export async function verifyCode(sb, factorId, raw) {
  const code = cleanCode(raw)
  if (!code) throw Object.assign(new Error('bad_code'), { code: 'bad_code' })
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw Object.assign(new Error(error.message), { code: 'wrong_code' })
}

/// Tries a code against each verified factor (main phone, backup), so
/// whichever authenticator is at hand works. Raises the session to aal2.
export async function verifyAnyCode(sb, factors, raw) {
  const code = cleanCode(raw)
  if (!code) throw Object.assign(new Error('bad_code'), { code: 'bad_code' })
  for (const f of factors) {
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code })
    if (!error) return f
  }
  throw Object.assign(new Error('wrong_code'), { code: 'wrong_code' })
}

/// Abandons a setup that was never verified.
export async function cancelEnroll(sb, factorId) {
  await sb.auth.mfa.unenroll({ factorId }).catch(() => {})
}

/// Turning it off needs a current code from any of the authenticators
/// (Supabase requires an aal2 session to remove a verified factor), so a
/// stolen password alone can't. Removes every authenticator.
export async function disable(sb, factors, raw) {
  const list = Array.isArray(factors) ? factors : [{ id: factors }]
  await verifyAnyCode(sb, list, raw)
  for (const f of list) {
    const { error } = await sb.auth.mfa.unenroll({ factorId: f.id })
    if (error) throw error
  }
}

/// Where a teacher who lost their phone asks for a reset (build-time
/// SUPPORT_EMAIL, else PRINT_OPS_EMAIL — see vite.config.js).
export function supportEmail() {
  // eslint-disable-next-line no-undef
  return typeof __SUPPORT_EMAIL__ === 'string' && __SUPPORT_EMAIL__ ? __SUPPORT_EMAIL__ : 'support@mybooklab.app'
}
