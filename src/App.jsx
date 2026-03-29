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
import ProtectedRoute from './components/auth/ProtectedRoute'
import { initCapacitor } from './capacitor'
import { useAuthStore } from './stores/useAuthStore'

export default function App() {
  const navigate = useNavigate()
  const initializeAuth = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initCapacitor(navigate)
    initializeAuth()
  }, [navigate, initializeAuth])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/preview/:bookId" element={<PreviewPage />} />
        <Route path="/bookshelf" element={<BookshelfPage />} />
        <Route path="/classroom/:code" element={<ClassroomPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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
