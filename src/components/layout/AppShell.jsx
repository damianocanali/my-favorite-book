import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Library } from 'lucide-react'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import CosmicBackground from './CosmicBackground'

export default function AppShell({ children }) {
  const location = useLocation()
  const bookCount = useBookshelfStore((state) => state.books.length)
  const isLanding = location.pathname === '/'

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

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
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
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
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
          </div>
        </nav>
      )}

      {/* Main content */}
      <main className="relative z-10">{children}</main>
    </div>
  )
}
