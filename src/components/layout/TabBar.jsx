import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Library, Star, PlusCircle, Package, UserCircle, LayoutDashboard, Users, GraduationCap } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClassBadgeStore } from '../../stores/useClassBadgeStore'
import { useIsStudent } from '../../hooks/useIsStudent'

const BADGE_POLL_MS = 60 * 1000

// Web port of the native MainTabView tab bar. Same five destinations, in
// the same order, with the closest Lucide equivalents of the SF Symbols:
//
//   Books    books.vertical.fill    → Library
//   Gallery  star.fill              → Star
//   Create   plus.circle.fill       → PlusCircle
//   Orders   shippingbox.fill       → Package
//   Account  person.crop.circle.fill→ UserCircle
//
// iOS tints the selected tab white and dims the rest; the bar itself is
// UIBlurEffect(.systemUltraThinMaterialDark), approximated by .ios-material.

// `labelKey` rather than a literal: the array is module-level, so the label
// has to be resolved at render time to follow a locale switch.
const TABS = [
  { to: '/bookshelf', labelKey: 'nav:tabs.books', Icon: Library },
  { to: '/gallery', labelKey: 'nav:tabs.gallery', Icon: Star },
  { to: '/create', labelKey: 'nav:tabs.create', Icon: PlusCircle },
  { to: '/orders', labelKey: 'nav:tabs.orders', Icon: Package },
  { to: '/account', labelKey: 'nav:tabs.account', Icon: UserCircle },
]

// Teacher mode's three destinations (Task D2 — see AppShell). `match`
// overrides the generic startsWith check below: '/teacher' is a *prefix* of
// both '/teacher/classes' and '/teacher/class/:id', so the generic rule
// would light up Dashboard on every teacher route instead of just its own.
const TEACHER_TABS = [
  { to: '/teacher', labelKey: 'nav:tabs.dashboard', Icon: LayoutDashboard, match: (p) => p === '/teacher' },
  {
    to: '/teacher/classes',
    labelKey: 'nav:tabs.classes',
    Icon: Users,
    match: (p) => p === '/teacher/classes' || p.startsWith('/teacher/class/'),
  },
  { to: '/account', labelKey: 'nav:tabs.account', Icon: UserCircle, match: (p) => p === '/account' },
]

// A class account's home (/bookshelf, "From your teacher" on top) reads as
// its "Class" tab, and carries the new-assignments badge (iPad: the same
// tab, graduationcap.fill).
const STUDENT_HOME_TAB = { to: '/bookshelf', labelKey: 'nav:tabs.class', Icon: GraduationCap, badge: 'class' }

// Pure and exported so the student/consumer split is unit-testable without
// rendering the tab bar (no jsdom in this project's test environment — see
// vitest.config.js). Print orders are a consumer-only, paid feature a class
// (student) account never has one to check on; the Gallery is the public
// showcase of *other families'* published books, which a class account must
// never see (owner decision, schools Stage 1). Both filtered out rather than
// branching per tab: the remaining three still spread evenly via
// justify-around.
export function getTabs({ teacherMode = false, isStudent = false } = {}) {
  if (teacherMode) return TEACHER_TABS
  if (!isStudent) return TABS
  return TABS
    .filter((tab) => tab.to !== '/orders' && tab.to !== '/gallery')
    .map((tab) => (tab.to === '/bookshelf' ? STUDENT_HOME_TAB : tab))
}

// What the badge bubble shows: nothing at 0, "9+" past nine.
export function badgeText(count) {
  if (!Number.isFinite(count) || count <= 0) return null
  return count > 9 ? '9+' : String(count)
}

export default function TabBar({ teacherMode = false }) {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isStudent = useIsStudent()

  const tabs = getTabs({ teacherMode, isStudent })
  const classBadge = useClassBadgeStore((s) => s.count)
  const onClassHome = location.pathname === '/bookshelf'

  // A new child on a shared device starts from zero, not the last one's count.
  useEffect(() => { useClassBadgeStore.getState().reset() }, [user?.id])

  // Off the Class tab, MyAssignments isn't mounted to keep the badge fresh:
  // poll on the same minute rhythm while the page is visible.
  useEffect(() => {
    if (!isStudent || teacherMode || !user || onClassHome) return undefined
    const refresh = () => {
      if (document.visibilityState === 'visible') useClassBadgeStore.getState().refresh()
    }
    refresh()
    const timer = setInterval(refresh, BADGE_POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [isStudent, teacherMode, user, onClassHome])

  const isActive = (tab) =>
    tab.match
      ? tab.match(location.pathname)
      : tab.to === '/create'
        ? location.pathname === '/create'
        : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 ios-material border-t border-white/[0.08]"
      style={{ paddingBottom: 'var(--sab, 0px)' }}
      aria-label={t('nav:tabs.aria_label')}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const { to, labelKey, Icon } = tab
          // Account sends signed-out visitors to sign-in instead of a
          // page that would only show them a sign-in prompt.
          const href = to === '/account' && !user ? '/login' : to
          const active = isActive(tab) || (to === '/account' && location.pathname === '/login')
          const bubble = tab.badge === 'class' ? badgeText(classBadge) : null
          return (
            <li key={to} className="flex-1">
              <Link
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2 transition-colors ${
                  active ? 'text-white' : 'text-white/55 hover:text-white/80'
                }`}
              >
                <span className="relative">
                  <Icon
                    size={24}
                    strokeWidth={active ? 2.4 : 2}
                    fill={active ? 'currentColor' : 'none'}
                    fillOpacity={active ? 0.18 : 0}
                    aria-hidden="true"
                  />
                  {bubble && (
                    <span
                      className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white font-body text-[11px] font-bold leading-[18px] text-center ring-2 ring-galaxy-bg"
                      aria-hidden="true"
                    >
                      {bubble}
                    </span>
                  )}
                </span>
                <span className="font-body text-[10px] font-semibold leading-none">
                  {t(labelKey)}
                </span>
                {bubble && (
                  <span className="sr-only">{t('nav:tabs.class_badge', { count: classBadge })}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
