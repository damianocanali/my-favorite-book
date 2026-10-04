// Owner-only: school billing admins (owner feedback round 5,
// api/admin/billing-admins.js). Pricing is negotiated with principals, so
// only these users (and the owner) see Plan & billing, prices and purchases
// in the teacher area. Lists the approved teachers from the verification
// queue with a toggle each, plus "by user id" for anyone else (a teacher
// verified by school email domain never enters the queue — copy their id
// from Supabase → Authentication). Every change is audit-logged first.
// English only, like the rest of AdminPage.
import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Loader2, RefreshCw } from 'lucide-react'
import { apiFetchAuthed } from '../../lib/api'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function call(path, body) {
  const r = await apiFetchAuthed(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

export default function BillingAdmins() {
  const [rows, setRows] = useState([])
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [reason, setReason] = useState('')
  const [manualId, setManualId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const approved = (await call('/api/admin/teacher-verifications?status=approved')).rows ?? []
      setRows(approved)
      const ids = [...new Set(approved.map((r) => r.user_id))].slice(0, 50)
      setFlags(ids.length ? (await call(`/api/admin/billing-admins?ids=${ids.join(',')}`)).flags ?? {} : {})
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function setFlag(userId, value) {
    setBusy(userId)
    setError(null)
    try {
      const out = await call('/api/admin/billing-admins', { userId, billing_admin: value, reason: reason.trim() || undefined })
      setFlags((f) => ({ ...f, [userId]: out.billing_admin }))
    } catch (e) {
      setError(e.message)
    }
    setBusy(null)
  }

  const toggle = (userId) => (
    <button
      type="button"
      role="switch"
      aria-checked={!!flags[userId]}
      disabled={busy === userId}
      onClick={() => setFlag(userId, !flags[userId])}
      className={`px-3 py-1.5 rounded-lg font-semibold text-sm disabled:opacity-40 ${flags[userId] ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/80 border border-white/20'}`}
    >
      {flags[userId] ? 'Billing admin: on' : 'Billing admin: off'}
    </button>
  )

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2"><CreditCard size={18} /> School billing admins</h2>
        <button onClick={load} className="text-white/70 hover:text-white" aria-label="Refresh">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      <p className="text-white/60 text-sm mb-3">
        Only billing admins (and you) see plans, prices and purchases in the teacher area. Everyone else sees a neutral status line.
      </p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <input
        type="text" maxLength={500} placeholder="Reason (logged with every change)"
        value={reason} onChange={(e) => setReason(e.target.value)}
        className="w-full mb-3 px-3 py-1.5 rounded-lg bg-black/30 border border-white/20 text-white text-sm"
      />
      <div className="space-y-2 mb-4">
        {!loading && rows.length === 0 && <p className="text-white/60 text-sm">No approved teachers in the queue.</p>}
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-xl p-3 border border-white/10 text-sm text-white/90 flex flex-wrap items-center justify-between gap-2">
            <p>
              {r.school_name || '—'} · <span className="text-white/60">{r.email_domain}</span> · <code className="text-white/60">{r.user_id}</code>
            </p>
            {toggle(r.user_id)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text" placeholder="Any user id (UUID)"
          value={manualId} onChange={(e) => setManualId(e.target.value.trim())}
          className="flex-1 min-w-[260px] px-3 py-1.5 rounded-lg bg-black/30 border border-white/20 text-white text-sm font-mono"
        />
        <button
          type="button" disabled={!UUID.test(manualId) || !!busy} onClick={() => setFlag(manualId, true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40"
        >Make billing admin</button>
        <button
          type="button" disabled={!UUID.test(manualId) || !!busy} onClick={() => setFlag(manualId, false)}
          className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white font-semibold text-sm disabled:opacity-40"
        >Remove</button>
      </div>
    </section>
  )
}
