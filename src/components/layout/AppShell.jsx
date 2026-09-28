import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, GraduationCap, Sparkles, Volume2, VolumeX, ArrowLeft, LayoutDashboard, Users } from 'lucide-react'
import { useAuthStore, selectDisplayName, selectIsTeacher } from '../../stores/useAuthStore'
import { useIsStudent } from '../../hooks/useIsStudent'
import { useTeacherMode } from '../../hooks/useTeacherMode'
import { isPreviewingKids, exitKidsPreview } from '../../lib/viewMode'
import { toggleMute, isMuted } from '../../services/audioService'
import PlayMenu from './PlayMenu'
import AvatarDisplay from '../avatar/AvatarDisplay'
import AppLogo from '../ui/AppLogo'
import CosmicBackground from './CosmicBackground'
import TabBar from './TabBar'
import LanguageToggle from '../ui/LanguageToggle'
import NotificationBell from '../school/NotificationBell'
import { PAGE_ACTIONS_ID } from './PageActions'
import { isFocusedAuthRoute } from '../../lib/focusedAuthRoutes'

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
  const authLoading = useAuthStore((s) => s.loading)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)
  const isTeacher = useAuthStore(selectIsTeacher)
  const isStudent = useIsStudent()
  const teacherMode = useTeacherMode()
  const previewingKids = isPreviewingKids()

  const [muted, setMuted] = useState(isMuted())

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleToggleMute = () => setMuted(toggleMute())

  // "Preview the kids' app" (TeacherDashboardPage) sets the sessionStorage
  // flag this reads and lands on /bookshelf; this is the way back —
  // clearing it and returning to the dashboard is the only thing this
  // button does, so the very next render already has the teacher chrome
  // back (computeTeacherMode reads previewingKids fresh every render).
  const handleExitPreview = () => {
    exitKidsPreview()
    navigate('/teacher')
  }

  const headerLink = (active) =>
    `flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
      active ? 'bg-white/[0.12] text-white' : 'text-white/60 hover:text-white'
    }`

  // /login, /signup, /class, /reset-password and /auth/callback are all
  // reachable signed-out, mid auth flow — the full app chrome is either
  // irrelevant there (Pricing on a sign-in screen) or actively unsafe (a
  // child on /class tapping through to Pricing, per the schools global
  // constraint that a class account never sees prices or purchase links).
  // On phones the tab bar also physically covered the bottom of these
  // forms. isFocusedAuthRoute is the one place that route list lives.
  const focused = isFocusedAuthRoute(location.pathname)

  if (focused) {
    return (
      <div className="min-h-screen relative">
        <a href="#main-content" className="skip-to-content">{t('nav:a11y.skip_to_content')}</a>

        <CosmicBackground />

        <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
          >
            <AppLogo size={28} />
            <span className="hidden bg-gradient-to-br from-word-from via-word-via to-word-to bg-clip-text font-heading text-lg font-bold text-transparent sm:inline">
              My Book Lab
            </span>
          </Link>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 font-body text-sm font-semibold text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {t('common:actions.back')}
            </button>
          </div>
        </header>

        <main id="main-content" className="relative z-10">{children}</main>
      </div>
    )
  }

  // The chrome decision below (teacher nav vs. consumer nav) must not
  // flash the wrong one while auth is still hydrating: `user` starts null
  // on every load, so useTeacherMode() reads as false for a moment even
  // for an account that turns out to be a signed-in teacher. Same neutral
  // spinner and same `loading` flag ProtectedRoute already gates on —
  // this is that same wait, one level up, for the chrome itself rather
  // than a single protected page.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Task D2: a teacher who hasn't switched to family view (useTeacherMode)
  // gets a nav built around their three destinations — Dashboard, Classes,
  // Account — with none of the consumer surfaces (Create/Bookshelf/Gallery/
  // Play/Pricing) linked. Those routes still work if navigated to directly
  // (a teacher previewing the kids' app via the dashboard's link), so this
  // is a chrome decision, not a route guard — same division of labour as
  // ConsumerOnlyRoute for students. A teacher who switches to family view
  // (Account page) falls through to the unchanged consumer layout below.
  if (teacherMode) {
    return (
      <div className="min-h-screen relative">
        <a href="#main-content" className="skip-to-content">{t('nav:a11y.skip_to_content')}</a>

        <CosmicBackground />

        <header className="relative z-20 flex items-center justify-between gap-2 px-3 sm:px-6 py-3">
          <Link
            to="/teacher"
            className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
          >
            <AppLogo size={28} />
            <span className="hidden bg-gradient-to-br from-word-from via-word-via to-word-to bg-clip-text font-heading text-lg font-bold text-transparent sm:inline">
              My Book Lab
            </span>
          </Link>

          <div
            id={PAGE_ACTIONS_ID}
            className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {/* aria-label: the text label is `hidden` below `sm`, which
                would otherwise leave these as icon-only links with no
                accessible name on a phone. */}
            <Link
              to="/teacher"
              aria-label={t('nav:header.dashboard')}
              className={headerLink(location.pathname === '/teacher')}
            >
              <LayoutDashboard size={18} />
              <span className="hidden font-body text-sm font-semibold sm:inline" aria-hidden="true">{t('nav:header.dashboard')}</span>
            </Link>
            <Link
              to="/teacher/classes"
              aria-label={t('nav:header.classes')}
              className={headerLink(location.pathname === '/teacher/classes' || location.pathname.startsWith('/teacher/class/'))}
            >
              <Users size={18} />
              <span className="hidden font-body text-sm font-semibold sm:inline" aria-hidden="true">{t('nav:header.classes')}</span>
            </Link>

            <NotificationBell />

            <LanguageToggle />

            <button
              onClick={handleToggleMute}
              title={muted ? t('nav:header.unmute') : t('nav:header.mute')}
              aria-label={muted ? t('nav:header.unmute') : t('nav:header.mute')}
              className="flex items-center rounded-full p-2 text-white/60 transition-colors hover:text-white"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

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
          </div>
        </header>

        <main id="main-content" className="relative z-10 pb-[calc(72px+var(--sab,0px))]">{children}</main>

        {/* Reconfigured (not hidden) — same three destinations as the
            header, so a teacher who prefers thumb reach on a phone doesn't
            lose Dashboard/Classes/Account. */}
        <TabBar teacherMode />
      </div>
    )
  }

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

          {/* Children see no prices, no purchase links (global constraint):
              a class (student) account never gets this destination. */}
          {!isStudent && (
            <Link to="/pricing" className={headerLink(location.pathname === '/pricing')}>
              <Sparkles size={18} />
              <span className="hidden font-body text-sm font-semibold sm:inline">{t('nav:header.pricing')}</span>
            </Link>
          )}

          {isTeacher && (
            <Link to="/teacher" className={headerLink(location.pathname === '/teacher')}>
              <GraduationCap size={18} />
              <span className="hidden font-body text-sm font-semibold sm:inline">{t('nav:header.classroom')}</span>
            </Link>
          )}

          {/* Sits with the mute button: both are small global preferences
              rather than destinations, and both stay reachable signed-out. */}
          <LanguageToggle />

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

      {/* A teacher who followed "Preview the kids' app" from the dashboard
          gets the ordinary consumer chrome above (computeTeacherMode reads
          this same flag and reports false), but needs an obvious way back —
          without this they'd have to know to type /teacher again. */}
      {previewingKids && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-galaxy-secondary/30 bg-galaxy-secondary/15 px-3 py-2 text-center backdrop-blur-sm">
          <span className="font-body text-sm text-galaxy-text">{t('nav:preview_kids.banner')}</span>
          <button
            type="button"
            onClick={handleExitPreview}
            className="font-body text-sm font-semibold text-galaxy-secondary hover:underline"
          >
            {t('nav:preview_kids.back_to_dashboard')}
          </button>
        </div>
      )}

      {/* pb clears the fixed tab bar (56px bar + label) plus the home indicator */}
      <main id="main-content" className="relative z-10 pb-[calc(72px+var(--sab,0px))]">{children}</main>

      <TabBar />
    </div>
  )
}
