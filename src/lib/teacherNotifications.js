// Pure helpers for the teacher bell (NotificationBell), the "turn on alerts"
// button (PushAlertsButton) and public/sw.js. No DOM, no fetch: tested in
// tests/teacher-notifications-web.test.js.

// One explicit t() call per kind, so tests/i18n-keys.test.js can see every
// key. The bell only ever says who, which class and which assignment.
export function notificationText(t, n) {
  const vars = {
    // Names are resolved at read time; a student no longer on the roster
    // comes back null.
    student: n?.payload?.student_name || t('school:notifications.unknown_student'),
    className: n?.payload?.class_name ?? '',
    assignment: n?.payload?.assignment_title ?? '',
  }
  switch (n?.kind) {
    case 'hand_in': return t('school:notifications.kinds.hand_in', vars)
    case 'hand_in_late': return t('school:notifications.kinds.hand_in_late', vars)
    case 'resubmit': return t('school:notifications.kinds.resubmit', vars)
    case 'all_handed_in': return t('school:notifications.kinds.all_handed_in', vars)
    case 'help_book': return t('school:notifications.kinds.help_book', vars)
    case 'help_grownup': return t('school:notifications.kinds.help_grownup', vars)
    default: return t('school:notifications.kinds.generic', vars)
  }
}

const SAFE_ID = /^[0-9a-zA-Z-]{1,64}$/
const REVIEW_KINDS = new Set(['hand_in', 'hand_in_late', 'resubmit', 'all_handed_in'])

// Help asks → the dashboard ("Needs you now"); hand-ins → that assignment's
// review drawer (TeacherClassPage reads ?review=).
export function notificationHref(n) {
  const cid = n?.classroom_id
  const aid = n?.payload?.assignment_id
  if (REVIEW_KINDS.has(n?.kind) && SAFE_ID.test(cid ?? '') && SAFE_ID.test(aid ?? '')) {
    return `/teacher/class/${cid}?review=${aid}`
  }
  return '/teacher'
}

export function unreadBadge(count) {
  if (!count || count < 1) return null
  return count > 9 ? '9+' : String(count)
}

// PushManager.subscribe wants the VAPID key as raw bytes.
export function urlBase64ToUint8Array(s) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/**
 * 'unsupported' | 'default' | 'granted' | 'denied'. Inside the native app
 * the web view can't receive web push (iOS gets APNs instead), so the
 * button hides there too.
 */
export function pushSupport({ isNative, hasServiceWorker, hasPushManager, permission }) {
  if (isNative || !hasServiceWorker || !hasPushManager || !permission) return 'unsupported'
  return permission
}

export function browserPushEnv(isNative) {
  const hasWindow = typeof window !== 'undefined'
  return {
    isNative,
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: hasWindow && 'PushManager' in window,
    permission: hasWindow && 'Notification' in window ? window.Notification.permission : undefined,
  }
}

// Why a bell remove / clear-all failed, for the bell's error banner (iPad:
// the TeacherBellList banner). `res` is schoolFetch's { ok, status, code };
// null when it worked. A code the teacher can act on keeps its own wording;
// anything else (network, upstream, 5xx) says which action failed.
const ACTIONABLE_CODES = new Set(['rate_limited', 'student_forbidden', 'not_configured'])

export function bellActionError(t, action, res) {
  if (!res || res.ok) return null
  if (res.status === 401) return t('school:notifications.session_ended')
  if (ACTIONABLE_CODES.has(res.code)) return t(`school:teacher.errors.${res.code}`)
  return action === 'clear'
    ? t('school:notifications.clear_failed')
    : t('school:notifications.remove_failed')
}
