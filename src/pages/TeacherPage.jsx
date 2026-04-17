import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { GraduationCap, Plus, ExternalLink, Copy, Check, LogOut } from 'lucide-react'
import SparkleButton from '../components/ui/SparkleButton'
import { apiFetchAuthed } from '../lib/api'
import { useAuthStore } from '../stores/useAuthStore'

const STORAGE_KEY = 'my-favorite-book-teacher-classes'

function loadSavedClasses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveClass(entry) {
  const existing = loadSavedClasses()
  const updated = [entry, ...existing.filter((c) => c.code !== entry.code)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export default function TeacherPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedClasses, setSavedClasses] = useState(loadSavedClasses)
  const [copiedCode, setCopiedCode] = useState(null)

  const handleCreate = async () => {
    if (!className.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await apiFetchAuthed('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: className.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create class')
      const entry = { code: data.code, name: data.name, createdAt: new Date().toISOString() }
      saveClass(entry)
      setSavedClasses(loadSavedClasses())
      setClassName('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
          <GraduationCap size={40} className="text-galaxy-secondary" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">Teacher Dashboard</h1>
        <p className="text-galaxy-text-muted font-body">
          Create a class code and share it with your students. When they finish a book, they'll submit it here.
        </p>
        {user && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-galaxy-text-muted text-sm font-body">{user.email}</span>
            <button
              onClick={async () => { await signOut(); navigate('/') }}
              className="flex items-center gap-1 text-galaxy-text-muted hover:text-galaxy-text text-sm font-body transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        )}
      </motion.div>

      {/* Create class form */}
      <motion.div
        className="bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-secondary/20 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-heading text-lg font-bold text-galaxy-text mb-4">Create a New Class</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Mrs. Rivera's 3rd Grade"
            maxLength={60}
            className="flex-1 px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
          />
          <SparkleButton onClick={handleCreate} disabled={!className.trim() || loading} size="small">
            <span className="flex items-center gap-1">
              <Plus size={16} />
              {loading ? 'Creating…' : 'Create'}
            </span>
          </SparkleButton>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p className="text-red-400 text-sm font-body mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Saved classes */}
      {savedClasses.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className="font-heading text-lg font-bold text-galaxy-text mb-3">Your Classes</h2>
          <div className="space-y-3">
            {savedClasses.map((cls) => (
              <div
                key={cls.code}
                className="bg-galaxy-bg-light rounded-xl p-4 border border-galaxy-text-muted/10 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-heading font-semibold text-galaxy-text">{cls.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-galaxy-secondary text-lg font-bold tracking-widest">
                      {cls.code}
                    </span>
                    <button
                      onClick={() => handleCopy(cls.code)}
                      className="text-galaxy-text-muted hover:text-galaxy-secondary transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === cls.code ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/classroom/${cls.code}`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-body font-semibold text-sm text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10 transition-colors"
                >
                  View Books <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {savedClasses.length === 0 && (
        <p className="text-center text-galaxy-text-muted font-body text-sm mt-4">
          No classes yet — create one above to get started.
        </p>
      )}
    </div>
  )
}
