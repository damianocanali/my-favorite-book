import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import PreviewPage from './pages/PreviewPage'
import BookshelfPage from './pages/BookshelfPage'
import TeacherPage from './pages/TeacherPage'
import ClassroomPage from './pages/ClassroomPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import PricingPage from './pages/PricingPage'
import SuccessPage from './pages/SuccessPage'
import AvatarPage from './pages/AvatarPage'
import PrivacyPage from './pages/PrivacyPage'
import GalleryPage from './pages/GalleryPage'
import ViewBookPage from './pages/ViewBookPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BadgePopup from './components/ui/BadgePopup'
import { initCapacitor } from './capacitor'
import { useAuthStore } from './stores/useAuthStore'
import { resumeOnGesture } from './services/audioService'

export default function App() {
  const navigate = useNavigate()
  const initializeAuth = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initCapacitor(navigate)
    initializeAuth()

    // iOS requires a user gesture before audio can play
    const handleFirstGesture = () => {
      resumeOnGesture()
      document.removeEventListener('click', handleFirstGesture)
      document.removeEventListener('touchstart', handleFirstGesture)
    }
    document.addEventListener('click', handleFirstGesture)
    document.addEventListener('touchstart', handleFirstGesture, { passive: true })

    return () => {
      document.removeEventListener('click', handleFirstGesture)
      document.removeEventListener('touchstart', handleFirstGesture)
    }
  }, [navigate, initializeAuth])

  return (
    <AppShell>
      <BadgePopup />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/preview/:bookId" element={<PreviewPage />} />
        <Route path="/bookshelf" element={<BookshelfPage />} />
        <Route path="/classroom/:code" element={<ClassroomPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/avatar" element={<AvatarPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/view/:slug" element={<ViewBookPage />} />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <TeacherPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppShell>
  )
}
