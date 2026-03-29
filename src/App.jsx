import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import PreviewPage from './pages/PreviewPage'
import BookshelfPage from './pages/BookshelfPage'
import TeacherPage from './pages/TeacherPage'
import ClassroomPage from './pages/ClassroomPage'
import { initCapacitor } from './capacitor'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    initCapacitor(navigate)
  }, [navigate])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/preview/:bookId" element={<PreviewPage />} />
        <Route path="/bookshelf" element={<BookshelfPage />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/classroom/:code" element={<ClassroomPage />} />
      </Routes>
    </AppShell>
  )
}
