// The pre-schools classroom hand-in form (api/classroom-submit.js) accepted
// anonymous books with no owner, so no account deletion can ever find them
// (privacy review §4.1 gap 6 / §7.22). After the sunset date:
//   * an ANONYMOUS submit is refused (410); a signed-in parent's still works
//     (it carries user_id, so purgeUser finds it);
//   * the nightly retention job deletes every ownerless submission made
//     before the sunset.
// LEGACY_SUBMIT_SUNSET (ISO date) overrides the default; owner decision.
export const DEFAULT_LEGACY_SUNSET = '2027-01-01T00:00:00Z'

export function legacySunset() {
  const raw = process.env.LEGACY_SUBMIT_SUNSET
  const t = raw ? Date.parse(raw) : NaN
  return new Date(Number.isFinite(t) ? t : Date.parse(DEFAULT_LEGACY_SUNSET))
}

export const legacySunsetPassed = (now = new Date()) => now >= legacySunset()
