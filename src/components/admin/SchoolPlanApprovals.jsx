// Owner-only: invoice-billed school plans waiting for approval (Stage 4
// review I6, api/admin/school-plans.js). Approving creates the Stripe
// invoice (net 30) and makes the plan usable with the reduced unpaid
// allowance; declining needs a reason. Every decision is written to the
// admin access log first. English only, like the rest of AdminPage.
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, School } from 'lucide-react'
import { apiFetchAuthed } from '../../lib/api'

async function call(path, body) {
  const r = await apiFetchAuthed(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

export default function SchoolPlanApprovals() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reasons, setReasons] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows((await call('/api/admin/school-plans')).rows)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(id, decision) {
    setError(null)
    try {
      await call('/api/admin/school-plans', { id, decision, reason: reasons[id] || undefined })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2"><School size={18} /> School plans waiting (invoice)</h2>
        <button onClick={load} className="text-white/70 hover:text-white" aria-label="Refresh">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!loading && rows.length === 0 && <p className="text-white/60 text-sm">No school plans waiting.</p>}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4 border border-white/10 text-sm text-white/90 space-y-2">
            <p><span className="text-white/60">School:</span> {r.school_name} · <span className="text-white/60">Seats:</span> {r.seats} · <span className="text-white/60">Tier:</span> {r.price_tier}</p>
            <p className="text-white/60">Teacher <code>{r.owner_user_id}</code> · asked {new Date(r.created_at).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text" maxLength={500} placeholder="Reason (required to decline; shown to the teacher)"
                value={reasons[r.id] ?? ''} onChange={(e) => setReasons((p) => ({ ...p, [r.id]: e.target.value }))}
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-black/30 border border-white/20 text-white"
              />
              <button onClick={() => decide(r.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">Approve &amp; send invoice</button>
              <button onClick={() => decide(r.id, 'decline')} disabled={!reasons[r.id]?.trim()} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white font-semibold disabled:opacity-40">Decline</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
