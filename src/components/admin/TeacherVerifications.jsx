// Owner-only: the teacher verification queue (Stage 4,
// api/admin/teacher-verifications.js). Approve or decline (a reason is
// required to decline and is shown to the teacher). Every decision is
// written to the admin access log first. English only, like the rest of
// AdminPage. Shows the email DOMAIN and user id only.
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiFetchAuthed } from '../../lib/api'

async function call(path, body) {
  const r = await apiFetchAuthed(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

export default function TeacherVerifications() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reasons, setReasons] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows((await call('/api/admin/teacher-verifications?status=pending')).rows)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(id, decision) {
    setError(null)
    try {
      await call('/api/admin/teacher-verifications', { id, decision, reason: reasons[id] || undefined })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2"><ShieldCheck size={18} /> Teacher verification</h2>
        <button onClick={load} className="text-white/70 hover:text-white" aria-label="Refresh">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!loading && rows.length === 0 && <p className="text-white/60 text-sm">No teachers waiting.</p>}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4 border border-white/10 text-sm text-white/90 space-y-2">
            <p><span className="text-white/60">Domain:</span> {r.email_domain} · <span className="text-white/60">User:</span> <code>{r.user_id}</code></p>
            {r.school_name && <p><span className="text-white/60">School (as typed):</span> {r.school_name}</p>}
            <p className="text-white/60">Asked {new Date(r.created_at).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text" maxLength={500} placeholder="Reason (required to decline; shown to the teacher)"
                value={reasons[r.id] ?? ''} onChange={(e) => setReasons((p) => ({ ...p, [r.id]: e.target.value }))}
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-black/30 border border-white/20 text-white"
              />
              <button onClick={() => decide(r.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">Approve</button>
              <button onClick={() => decide(r.id, 'decline')} disabled={!reasons[r.id]?.trim()} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white font-semibold disabled:opacity-40">Decline</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
