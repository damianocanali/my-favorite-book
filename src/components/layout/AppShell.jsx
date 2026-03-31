import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Home, Library, LogIn, LogOut, GraduationCap, Sparkles } from 'lucide-react'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName, selectRole } from '../../stores/useAuthStore'
import AvatarDisplay from '../avatar/AvatarDisplay'
import CosmicBackground from './CosmicBackground'

export default function AppShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const bookCount = useBookshelfStore((state) => state.books.length)
  const isLanding = location.pathname === '/'

  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)
  const role = useAuthStore(selectRole)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen relative">
      <CosmicBackground />

      {/* Navigation */}
      {!isLanding && (
        <nav className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-galaxy-primary/20 bg-galaxy-bg/50 backdrop-blur-md">
          <Link
            to="/"
            className="flex items-center gap-2 text-galaxy-text hover:text-galaxy-primary transition-colors"
          >
            <BookOpen size={24} className="text-galaxy-primary" />
            <span className="font-heading font-bold text-lg hidden sm:inline">My Favorite Book</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                location.pathname === '/'
                  ? 'bg-galaxy-primary/20 text-galaxy-primary'
                  : 'text-galaxy-text-muted hover:text-galaxy-text'
              }`}
            >
              <Home size={18} />
              <span className="hidden sm:inline text-sm font-body font-semibold">Home</span>
            </Link>

            <Link
              to="/bookshelf"
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
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

            <Link
              to="/pricing"
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                location.pathname === '/pricing'
                  ? 'bg-galaxy-primary/20 text-galaxy-primary'
                  : 'text-galaxy-text-muted hover:text-galaxy-text'
              }`}
            >
              <Sparkles size={18} />
              <span className="hidden sm:inline text-sm font-body font-semibold">Pricing</span>
            </Link>

            {/* Teacher dashboard link — only for teachers */}
            {role === 'teacher' && (
              <Link
                to="/teacher"
                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                  location.pathname === '/teacher'
                    ? 'bg-galaxy-secondary/20 text-galaxy-secondary'
                    : 'text-galaxy-text-muted hover:text-galaxy-text'
                }`}
              >
                <GraduationCap size={18} />
                <span className="hidden sm:inline text-sm font-body font-semibold">Classroom</span>
              </Link>
            )}

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
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-galaxy-text-muted hover:text-galaxy-text transition-colors text-sm font-body font-semibold"
                >
                  <LogIn size={16} />
                  <span className="hidden sm:inline">Sign In</span>
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
      )}

      {/* Main content */}
      <main className="relative z-10">{children}</main>
    </div>
  )
}
