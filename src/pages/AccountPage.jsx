import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Trash2, LogOut, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

export default function AccountPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)

  const [confirmStep, setConfirmStep] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('No active session')

      const res = await apiFetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      })
      const data = await res.json()
      if (!data.deleted) throw new Error(data.error || 'Deletion failed')

      await signOut()
      navigate('/')
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-galaxy-bg-light border border-galaxy-text-muted/20 rounded-3xl p-8"
        >
          <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-1">Account</h1>
          <p className="text-galaxy-text-muted font-body text-sm mb-8">{user.email}</p>

          {/* Sign out */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">Session</h2>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          {/* Delete account */}
          <div>
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-1">Danger Zone</h2>
            <p className="text-galaxy-text-muted font-body text-sm mb-4">
              Permanently delete your account and all your books. This cannot be undone.
            </p>

            {!confirmStep ? (
              <button
                onClick={() => setConfirmStep(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 transition-colors font-body text-sm"
              >
                <Trash2 size={16} />
                Delete my account
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body font-semibold text-red-300 text-sm mb-1">
                      Are you sure?
                    </p>
                    <p className="font-body text-galaxy-text-muted text-sm">
                      This will permanently delete your account, all your books, and cancel any active subscription. This action cannot be reversed.
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 font-body text-sm mb-3">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setConfirmStep(false); setError(null) }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors font-body text-sm font-semibold disabled:opacity-60"
                  >
                    {deleting ? (
                      <><Loader2 size={15} className="animate-spin" /> Deleting...</>
                    ) : (
                      <><Trash2 size={15} /> Yes, delete everything</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
