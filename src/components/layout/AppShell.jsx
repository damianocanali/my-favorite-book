import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Library, LogOut, GraduationCap, Sparkles, Star, Volume2, VolumeX } from 'lucide-react'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName, selectRole } from '../../stores/useAuthStore'
import { toggleMute, isMuted } from '../../services/audioService'
import AvatarDisplay from '../avatar/AvatarDisplay'
import AppLogo from '../ui/AppLogo'
import CosmicBackground from './CosmicBackground'

export default function AppShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const bookCount = useBookshelfStore((state) => state.books.length)

  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)
  const role = useAuthStore(selectRole)

  const [muted, setMuted] = useState(isMuted())

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleToggleMute = () => {
    const nowMuted = toggleMute()
    setMuted(nowMuted)
  }

  return (
    <div className="min-h-screen relative">
      <CosmicBackground />

      {/* Navigation */}
        <nav className="relative z-20 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-galaxy-primary/20 bg-galaxy-bg/50 backdrop-blur-md gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 text-galaxy-text hover:text-galaxy-primary transition-colors"
          >
            <AppLogo size={28} />
            <span className="font-heading font-bold text-lg hidden sm:inline">My Book Lab</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <Link
              to="/"
              className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full transition-all ${
                location.pathname === '/'
                  ? 'bg-galaxy-primary/20 text-galaxy-primary'
                  : 'text-galaxy-text-muted hover:text-galaxy-text'
              }`}
            >
              <Home size={18} />
              <span className="hidden sm:inline text-sm font-body font-semibold">Home</span>
            </Link>

            {user && (
              <Link
                to="/bookshelf"
                className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full transition-all ${
                  location.pathname === '/bookshelf'
                    ? 'bg-galaxy-primary/20 text-galaxy-primary'
                    : 'text-galaxy-text-muted hover:text-galaxy-text'
                }`}
              >
                <Library size={18} />
                <span className="hidden sm:inline text-sm font-body font-semibold">
                  Bookshelf{bookCount > 0 && ` (${bookCount})`}
                </span>
              </Link>
            )}

            <Link
              to="/pricing"
              className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full transition-all ${
                location.pathname === '/pricing'
                  ? 'bg-galaxy-primary/20 text-galaxy-primary'
                  : 'text-galaxy-text-muted hover:text-galaxy-text'
              }`}
            >
              <Sparkles size={18} />
              <span className="hidden sm:inline text-sm font-body font-semibold">Pricing</span>
            </Link>

            <Link
              to="/gallery"
              className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full transition-all ${
                location.pathname === '/gallery'
                  ? 'bg-yellow-400/20 text-yellow-400'
                  : 'text-galaxy-text-muted hover:text-galaxy-text'
              }`}
            >
              <Star size={18} />
              <span className="hidden sm:inline text-sm font-body font-semibold">Gallery</span>
            </Link>

            {/* Teacher dashboard link — only for teachers */}
            {role === 'teacher' && (
              <Link
                to="/teacher"
                className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full transition-all ${
                  location.pathname === '/teacher'
                    ? 'bg-galaxy-secondary/20 text-galaxy-secondary'
                    : 'text-galaxy-text-muted hover:text-galaxy-text'
                }`}
              >
                <GraduationCap size={18} />
                <span className="hidden sm:inline text-sm font-body font-semibold">Classroom</span>
              </Link>
            )}

            {/* Music mute toggle */}
            <button
              onClick={handleToggleMute}
              title={muted ? 'Unmute music' : 'Mute music'}
              className="flex items-center px-2 py-2 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Auth section */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-galaxy-text-muted/20">
                <Link
                  to="/avatar"
                  title="My Avatar"
                  className="hover:opacity-80 transition-opacity"
                >
                  <AvatarDisplay size={32} mini />
                </Link>
                <span className="text-galaxy-text-muted text-xs font-body hidden sm:block max-w-[100px] truncate">
                  {displayName}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex items-center gap-1 px-2 py-2 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors text-sm font-body font-semibold border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-galaxy-primary text-white hover:bg-galaxy-primary/80 transition-colors text-sm font-body font-semibold"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </nav>

      {/* Main content */}
      <main className="relative z-10">{children}</main>
    </div>
  )
}
