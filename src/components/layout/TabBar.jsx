import { Link, useLocation } from 'react-router-dom'
import { Library, Star, PlusCircle, Package, UserCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'

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

const TABS = [
  { to: '/bookshelf', label: 'Books', Icon: Library },
  { to: '/gallery', label: 'Gallery', Icon: Star },
  { to: '/create', label: 'Create', Icon: PlusCircle },
  { to: '/orders', label: 'Orders', Icon: Package },
  { to: '/account', label: 'Account', Icon: UserCircle },
]

export default function TabBar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const isActive = (to) =>
    to === '/create'
      ? location.pathname === '/create'
      : location.pathname === to || location.pathname.startsWith(`${to}/`)

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 ios-material border-t border-white/[0.08]"
      style={{ paddingBottom: 'var(--sab, 0px)' }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {TABS.map(({ to, label, Icon }) => {
          // Account sends signed-out visitors to sign-in instead of a
          // page that would only show them a sign-in prompt.
          const href = to === '/account' && !user ? '/login' : to
          const active = isActive(to) || (to === '/account' && location.pathname === '/login')
          return (
            <li key={to} className="flex-1">
              <Link
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2 transition-colors ${
                  active ? 'text-white' : 'text-white/55 hover:text-white/80'
                }`}
              >
                <Icon
                  size={24}
                  strokeWidth={active ? 2.4 : 2}
                  fill={active ? 'currentColor' : 'none'}
                  fillOpacity={active ? 0.18 : 0}
                />
                <span className="font-body text-[10px] font-semibold leading-none">
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
