// Owner-only: the admin access log (migration 032, api/admin/access-log.js)
// and the bulk picture reset for pepper rotation (api/admin/picture-reset.js).
// English only, like the rest of AdminPage (see the note there).
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { apiFetchAuthed } from '../../lib/api'

async function call(path, body) {
  const r = await apiFetchAuthed(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { data })
  return data
}

function AccessLog() {
  const [rows, setRows] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (before = null) => {
    setLoading(true)
    setError(null)
    try {
      const d = await call(`/api/admin/access-log?limit=50${before ? `&before=${before}` : ''}`)
      setRows((prev) => (before ? [...prev, ...d.rows] : d.rows))
      setNext(d.next_before)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-xl font-semibold text-white">Admin access log</h2>
        <button onClick={() => load()} className="text-galaxy-text-muted hover:text-white" aria-label="Reload access log">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p className="text-red-300 text-sm mb-2">{error}</p>}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-galaxy-text-muted">
            <tr>
              <th className="p-2">When</th><th className="p-2">Action</th><th className="p-2">Target</th>
              <th className="p-2">Reason</th><th className="p-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-white/90 align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString('en-US')}</td>
                <td className="p-2 font-mono">{r.action}</td>
                <td className="p-2 font-mono break-all">{[r.target_table, r.target_id].filter(Boolean).join(' / ') || '—'}</td>
                <td className="p-2">{r.reason || '—'}</td>
                <td className="p-2 font-mono break-all text-galaxy-text-muted">{JSON.stringify(r.detail)}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={5} className="p-3 text-galaxy-text-muted">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {next && (
        <button onClick={() => load(next)} disabled={loading} className="mt-2 text-sm text-cyan-300 hover:underline">
          Load older
        </button>
      )}
    </section>
  )
}

function PictureReset() {
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { processed, failed }
  // The cursor survives a failed batch: "Reset" again resumes after the
  // last student done instead of starting over.
  const [cursor, setCursor] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  async function check() {
    setError(null)
    try { setPreview(await call('/api/admin/picture-reset')) } catch (e) { setError(e.message) }
  }

  async function run() {
    setBusy(true)
    setError(null)
    let after = cursor
    let processed = progress?.processed ?? 0
    let failed = progress?.failed ?? 0
    try {
      for (;;) {
        const d = await call('/api/admin/picture-reset', {
          confirm, reason, expectedCount: preview.active_students, after,
        })
        processed += d.processed
        failed += d.failed.length
        setProgress({ processed, failed })
        after = d.next_after
        setCursor(after)
        if (d.done) { setDone(true); break }
      }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const ready = preview && confirm === preview.confirm_phrase && reason.trim().length > 0 && !busy && !done

  return (
    <section className="mb-8 rounded-2xl border border-red-400/30 bg-red-500/5 p-4">
      <h2 className="font-heading text-xl font-semibold text-white flex items-center gap-2 mb-2">
        <ShieldAlert className="w-5 h-5 text-red-300" /> Bulk picture reset (pepper rotation)
      </h2>
      <p className="text-sm text-galaxy-text-muted mb-3">
        Only after rotating <code>STUDENT_SECRET_PEPPER</code>. Every active student&apos;s pictures stop working, their
        password is rotated and they are signed out. Teachers then hand out new cards with &ldquo;New pictures&rdquo;.
        This is written to the access log.
      </p>
      {!preview ? (
        <button onClick={check} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm">Count active students</button>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-white">{preview.active_students} active students will be reset.</p>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)"
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-1.5 text-white"
          />
          <input
            value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type ${preview.confirm_phrase}`}
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-1.5 text-white font-mono"
          />
          <button
            onClick={run} disabled={!ready}
            className="px-3 py-1.5 rounded-lg bg-red-500/80 text-white disabled:opacity-40 flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {cursor && !done ? 'Resume reset' : 'Reset all pictures'}
          </button>
        </div>
      )}
      {progress && <p className="text-sm text-white mt-2">Reset {progress.processed}; failed {progress.failed}.</p>}
      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
    </section>
  )
}

export default function AdminAccessLog() {
  return (
    <>
      <AccessLog />
      <PictureReset />
    </>
  )
}
