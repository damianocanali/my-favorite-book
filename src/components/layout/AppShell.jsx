import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, GraduationCap, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { useAuthStore, selectDisplayName, selectRole } from '../../stores/useAuthStore'
import { toggleMute, isMuted } from '../../services/audioService'
import PlayMenu from './PlayMenu'
import AvatarDisplay from '../avatar/AvatarDisplay'
import AppLogo from '../ui/AppLogo'
import CosmicBackground from './CosmicBackground'
import TabBar from './TabBar'
import { PAGE_ACTIONS_ID } from './PageActions'

// Shell mirrors the native app: a translucent bottom tab bar for the five
// primary destinations (see TabBar.jsx), and a slim, mostly-transparent
// header. On iOS almost every screen calls
// `.toolbarBackground(.hidden, for: .navigationBar)`, so the bar floats
// over the cosmic gradient with only its title visible — hence the very
// light chrome here.
//
// The header keeps the destinations iOS doesn't have a tab for (Pricing,
// the teacher dashboard) plus the mute toggle and signed-out auth CTAs.
export default function AppShell({ children }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)
  const role = useAuthStore(selectRole)

  const [muted, setMuted] = useState(isMuted())

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleToggleMute = () => setMuted(toggleMute())

  const headerLink = (active) =>
    `flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
      active ? 'bg-white/[0.12] text-white' : 'text-white/60 hover:text-white'
    }`

  return (
    <div className="min-h-screen relative">
      {/* First tab stop on every page. Invisible until focused, so it
          costs the kid-facing design nothing but saves a keyboard user
          from tabbing the whole header and tab bar to reach content. */}
      <a href="#main-content" className="skip-to-content">{t('nav:a11y.skip_to_content')}</a>

      <CosmicBackground />

      <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
        >
          <AppLogo size={28} />
          {/* Gradient wordmark, matching HeroLanding's treatment */}
          <span className="hidden bg-gradient-to-br from-word-from via-word-via to-word-to bg-clip-text font-heading text-lg font-bold text-transparent sm:inline">
            My Book Lab
          </span>
        </Link>

        {/* Per-page actions (back / publish / print / edit …) live here
            rather than in a row inside the page — see PageActions. */}
        <div
          id={PAGE_ACTIONS_ID}
          className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <PlayMenu linkClass={headerLink} />

          <Link to="/pricing" className={headerLink(location.pathname === '/pricing')}>
            <Sparkles size={18} />
            <span className="hidden font-body text-sm font-semibold sm:inline">{t('nav:header.pricing')}</span>
          </Link>

          {role === 'teacher' && (
            <Link to="/teacher" className={headerLink(location.pathname === '/teacher')}>
              <GraduationCap size={18} />
              <span className="hidden font-body text-sm font-semibold sm:inline">{t('nav:header.classroom')}</span>
            </Link>
          )}

          <button
            onClick={handleToggleMute}
            title={muted ? t('nav:header.unmute') : t('nav:header.mute')}
            aria-label={muted ? t('nav:header.unmute') : t('nav:header.mute')}
            className="flex items-center rounded-full p-2 text-white/60 transition-colors hover:text-white"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 border-l border-white/15 pl-2">
              <Link to="/account" title={t('nav:header.account')} className="transition-opacity hover:opacity-80">
                <AvatarDisplay size={32} mini />
              </Link>
              <Link
                to="/account"
                title={t('nav:header.account')}
                className="hidden max-w-[100px] truncate font-body text-xs text-white/60 transition-colors hover:text-white sm:block"
              >
                {displayName}
              </Link>
              <button
                onClick={handleSignOut}
                title={t('common:actions.sign_out')}
                aria-label={t('common:actions.sign_out')}
                className="flex items-center rounded-full p-2 text-white/60 transition-colors hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full border border-white/30 px-3 py-2 font-body text-sm font-semibold text-white/70 transition-colors hover:border-white/60 hover:text-white"
              >
                {t('nav:header.sign_in')}
              </Link>
              <Link
                to="/signup"
                className="rounded-full border-[1.5px] border-white/30 bg-gradient-to-b from-btn-primary-from to-btn-primary-to px-3 py-2 font-body text-sm font-semibold text-white shadow-glow-purple transition-shadow hover:shadow-[0_8px_34px_rgba(191,90,242,0.7)]"
              >
                {t('nav:header.sign_up')}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* pb clears the fixed tab bar (56px bar + label) plus the home indicator */}
      <main id="main-content" className="relative z-10 pb-[calc(72px+var(--sab,0px))]">{children}</main>

      <TabBar />
    </div>
  )
}
