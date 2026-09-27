import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import PreviewPage from './pages/PreviewPage'
import BookshelfPage from './pages/BookshelfPage'
import TeacherDashboardPage from './pages/TeacherDashboardPage'
import TeacherPage from './pages/TeacherPage'
import TeacherClassPage from './pages/TeacherClassPage'
import ClassroomPage from './pages/ClassroomPage'
import ClassSignInPage from './pages/ClassSignInPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import PricingPage from './pages/PricingPage'
import SuccessPage from './pages/SuccessPage'
import AvatarPage from './pages/AvatarPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import SupportPage from './pages/SupportPage'
import GalleryPage from './pages/GalleryPage'
import ViewBookPage from './pages/ViewBookPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import AccountPage from './pages/AccountPage'
import AdminPage from './pages/AdminPage'
import PrintOrderPage from './pages/PrintOrderPage'
import OrderConfirmPage from './pages/OrderConfirmPage'
import OrdersListPage from './pages/OrdersListPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ExampleBookPage from './pages/ExampleBookPage'
import NotFoundPage from './pages/NotFoundPage'
import StoryBlanksPage from './pages/StoryBlanksPage'
import StoryBuilderPage from './pages/StoryBuilderPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ConsumerOnlyRoute from './components/auth/ConsumerOnlyRoute'
import BadgePopup from './components/ui/BadgePopup'
import WelcomeBackMoment from './components/ui/WelcomeBackMoment'
import MilestoneHost from './components/ui/MilestoneHost'
import CheckInHost from './components/ui/CheckInHost'
import { initCapacitor } from './capacitor'
import { useAuthStore } from './stores/useAuthStore'
import { useTeacherMode } from './hooks/useTeacherMode'
import { resumeOnGesture } from './services/audioService'

// "/" is the consumer "Create a book" home for everyone except a teacher in
// teacher mode (Task D2 owner decision): they land on their dashboard
// instead. AppShell's teacher-mode header/TabBar already assume this — its
// Dashboard link always points at "/teacher", never "/" — so this redirect
// is what keeps the logo link and any other "/" reference consistent with
// that. A teacher who switches to family view (useTeacherMode false) sees
// the ordinary landing page here, same as any consumer.
//
// `user` (and therefore useTeacherMode's selectIsTeacher) is a false
// negative for a moment on every load, while auth is still hydrating —
// waiting on the same `loading` flag ProtectedRoute already gates on, with
// its same neutral spinner, means a signed-in teacher never flashes the
// consumer LandingPage before this redirects them.
function HomeRoute() {
  const authLoading = useAuthStore((s) => s.loading)
  const teacherMode = useTeacherMode()
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (teacherMode) return <Navigate to="/teacher" replace />
  return <LandingPage />
}

// Reset scroll on every route change. Without this, navigating from a long
// page (e.g. scrolled-down /login) to another page leaves the new page
// positioned wherever the previous scroll was, which on iOS/Capacitor
// makes it look like the screen "opens in the middle."
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const navigate = useNavigate()
  const initializeAuth = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initCapacitor(navigate)
    initializeAuth()

    // Mobile browsers block autoplay until a user gesture — keep trying on every
    // interaction until audio is confirmed playing
    const handleGesture = () => {
      resumeOnGesture()
    }
    document.addEventListener('click', handleGesture)
    document.addEventListener('touchstart', handleGesture, { passive: true })

    return () => {
      document.removeEventListener('click', handleGesture)
      document.removeEventListener('touchstart', handleGesture)
    }
  }, [navigate, initializeAuth])

  return (
    <AppShell>
      <ScrollToTop />
      <BadgePopup />
      <WelcomeBackMoment />
      <MilestoneHost />
      <CheckInHost />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/preview/:bookId" element={<PreviewPage />} />
        <Route path="/bookshelf" element={<BookshelfPage />} />
        <Route path="/classroom/:code" element={<ClassroomPage />} />
        {/* Deliberately NOT inside ProtectedRoute: a child signing in here
            has no session yet — that's the entire point of this route. */}
        <Route path="/class" element={<ClassSignInPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<ConsumerOnlyRoute><PricingPage /></ConsumerOnlyRoute>} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/avatar" element={<ConsumerOnlyRoute><AvatarPage /></ConsumerOnlyRoute>} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/view/:slug" element={<ViewBookPage />} />
        <Route path="/order/:bookId" element={<ConsumerOnlyRoute><PrintOrderPage /></ConsumerOnlyRoute>} />
        <Route path="/orders" element={<ConsumerOnlyRoute><OrdersListPage /></ConsumerOnlyRoute>} />
        <Route path="/orders/:id" element={<ConsumerOnlyRoute><OrderDetailPage /></ConsumerOnlyRoute>} />
        <Route path="/orders/:id/confirm" element={<ConsumerOnlyRoute><OrderConfirmPage /></ConsumerOnlyRoute>} />
        <Route path="/example" element={<ExampleBookPage />} />
        {/* Story Blanks writes a real book to the shelf and claims
            badges, both of which need an account — an anonymous player
            would finish a story and watch it vanish. */}
        <Route
          path="/blanks"
          element={
            <ProtectedRoute>
              <StoryBlanksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/build"
          element={
            <ProtectedRoute>
              <StoryBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <ConsumerOnlyRoute>
                <TeacherDashboardPage />
              </ConsumerOnlyRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/classes"
          element={
            <ProtectedRoute>
              <ConsumerOnlyRoute>
                <TeacherPage />
              </ConsumerOnlyRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/class/:id"
          element={
            <ProtectedRoute>
              <ConsumerOnlyRoute>
                <TeacherClassPage />
              </ConsumerOnlyRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
