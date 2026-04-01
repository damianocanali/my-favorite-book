import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { GraduationCap, ArrowLeft, BookOpen, X, RefreshCw } from 'lucide-react'
import BookPreview from '../components/book/BookPreview'
import SparkleButton from '../components/ui/SparkleButton'

function BookCard({ submission, onClick }) {
  const { book } = submission
  const cover = book?.colors?.cover ?? '#8B5CF6'
  const accent = book?.colors?.accent ?? '#06B6D4'

  return (
    <motion.button
      onClick={onClick}
      className="text-left bg-galaxy-bg-light rounded-2xl border border-galaxy-text-muted/10 overflow-hidden hover:border-galaxy-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Mini cover */}
      <div
        className="h-28 flex items-center justify-center text-4xl"
        style={{ background: `linear-gradient(135deg, ${cover}60, ${accent}60)` }}
      >
        {book?.characters?.[0]?.emoji ?? '📖'}
      </div>
      <div className="p-3">
        <p className="font-heading font-bold text-galaxy-text text-sm line-clamp-1">{book?.title}</p>
        <p className="text-galaxy-text-muted text-xs font-body mt-0.5">
          by {book?.authorName} · {book?.pages?.length ?? 0} pages
        </p>
        <p className="text-galaxy-text-muted text-xs font-body mt-0.5 opacity-60">
          {new Date(submission.submitted_at).toLocaleDateString()}
        </p>
      </div>
    </motion.button>
  )
}

function BookModal({ submission, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-galaxy-bg overflow-y-auto" style={{ paddingTop: 'var(--sat, 0px)', paddingBottom: 'var(--sab, 0px)' }}>
      <div className="flex items-center justify-between p-4 max-w-3xl mx-auto w-full gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-galaxy-text">{submission.book?.title}</h2>
          <p className="text-galaxy-text-muted text-sm font-body">by {submission.book?.authorName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-galaxy-text-muted hover:text-galaxy-text hover:bg-galaxy-bg-light transition-colors"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <BookPreview book={submission.book} />
      </div>
    </div>
  )
}

export default function ClassroomPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState(null)

  const fetchClassroom = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/classroom?code=${code}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load classroom')
      setClassroom(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClassroom() }, [code])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-galaxy-text-muted font-body text-xl">{error}</p>
        <SparkleButton onClick={() => navigate('/teacher')} variant="secondary">
          Back to Teacher Dashboard
        </SparkleButton>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => navigate('/teacher')}
            className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm mb-4"
          >
            <ArrowLeft size={16} /> Teacher Dashboard
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
                <GraduationCap size={24} className="text-galaxy-secondary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold text-galaxy-text">{classroom.name}</h1>
                <p className="text-galaxy-text-muted font-body text-sm">
                  Code: <span className="font-mono text-galaxy-secondary font-bold tracking-widest">{classroom.code}</span>
                  {' · '}{classroom.submissions?.length ?? 0} book{classroom.submissions?.length !== 1 ? 's' : ''} submitted
                </p>
              </div>
            </div>
            <button
              onClick={fetchClassroom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text hover:border-galaxy-text-muted/40 transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </motion.div>

        {/* Book grid */}
        {classroom.submissions?.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={48} className="text-galaxy-text-muted mx-auto mb-4 opacity-40" />
            <p className="text-galaxy-text-muted font-body text-lg">No books yet.</p>
            <p className="text-galaxy-text-muted font-body text-sm mt-1">
              Share the code <span className="font-mono text-galaxy-secondary font-bold">{classroom.code}</span> with your students.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {classroom.submissions.map((sub) => (
              <BookCard key={sub.id} submission={sub} onClick={() => setSelectedSubmission(sub)} />
            ))}
          </div>
        )}
      </div>

      {/* Book preview modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <BookModal submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
