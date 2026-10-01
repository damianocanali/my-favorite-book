// Owner-only: class print requests ("My Writing Year" books, migration 024).
// English only, like the rest of AdminPage (see the note there).
// API: api/admin/class-prints.js — the security boundary; this is chrome.
//
// "Approve & send to printer" runs the three server steps in order and stops
// at the first failure: approve → render each child's PDFs (one call per
// child, so no single call runs long) → submit ONE Lulu order. The submit
// is idempotent server-side (a claimed request can't be sent twice), so a
// double click or a retry after a network blip can't place two orders.
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Printer, X, FileText } from 'lucide-react'
import { apiFetchAuthed } from '../../lib/api'

async function call(path, body) {
  const r = await apiFetchAuthed(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

const STATUS_TONE = {
  requested: 'bg-amber-400/15 text-amber-200',
  approved: 'bg-cyan-400/15 text-cyan-200',
  submitted: 'bg-indigo-400/15 text-indigo-200',
  in_production: 'bg-indigo-400/15 text-indigo-200',
  shipped: 'bg-emerald-400/15 text-emerald-200',
  canceled: 'bg-white/10 text-galaxy-text-muted',
  failed: 'bg-red-400/15 text-red-200',
}

function Detail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try { setData(await call(`/api/admin/class-prints?id=${id}`)) } catch (e) { setError(e.message) }
  }, [id])
  useEffect(() => { load() }, [load])

  async function approveAndSubmit() {
    if (!window.confirm(`Send ${data.children.length} books to Lulu as one order? This spends real money.`)) return
    setError(null)
    try {
      if (data.request.status === 'requested') {
        setBusy('Approving…')
        await call('/api/admin/class-prints', { id, action: 'approve' })
      }
      for (const [i, c] of data.children.entries()) {
        if (c.rendered) continue
        setBusy(`Rendering ${i + 1}/${data.children.length} (${c.display_name})…`)
        await call('/api/admin/class-prints', { id, action: 'render', childId: c.id })
      }
      setBusy('Sending to Lulu…')
      await call('/api/admin/class-prints', { id, action: 'submit' })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
      await load()
      onChanged()
    }
  }

  async function simple(body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setError(null)
    setBusy('Working…')
    try { await call('/api/admin/class-prints', { id, ...body }) } catch (e) { setError(e.message) }
    setBusy(null)
    await load()
    onChanged()
  }

  if (!data) return <div className="py-6 flex justify-center"><Loader2 className="animate-spin" /></div>
  const r = data.request
  const canSend = ['requested', 'approved'].includes(r.status) && !r.submit_claimed_at
  return (
    <div className="glass rounded-xl p-5 border border-galaxy-text-muted/10 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">{r.classrooms?.name} · {r.school_year}</h3>
          <p className="text-sm text-galaxy-text-muted">{r.school_name} — {r.contact_name} &lt;{r.contact_email}&gt; · {r.contact_phone}</p>
          <p className="text-sm text-galaxy-text-muted">
            {r.address_line1}{r.address_line2 ? `, ${r.address_line2}` : ''}, {r.city} {r.state_code ?? ''} {r.postal_code}, {r.country_code}
          </p>
          <p className="text-sm mt-1"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_TONE[r.status]}`}>{r.status}</span>
            {r.lulu_print_job_id && <span className="ml-2 text-xs text-galaxy-text-muted">Lulu job {r.lulu_print_job_id} {r.lulu_status ? `(${r.lulu_status})` : ''}</span>}
          </p>
          {r.error && <p className="text-sm text-red-300 mt-1">{r.error}</p>}
          {r.status === 'approved' && r.submit_claimed_at && (
            <p className="text-sm text-amber-200 mt-1">Claimed for submission at {r.submit_claimed_at} but not marked submitted — check Lulu before doing anything else.</p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 text-galaxy-text-muted hover:text-galaxy-text"><X size={18} /></button>
      </div>

      <ul className="divide-y divide-white/5">
        {data.children.map((c) => (
          <li key={c.id} className="py-2 flex items-center gap-3 text-sm">
            <span className="w-6 text-galaxy-text-muted tabular-nums">{c.position}</span>
            <span className="flex-1">{c.display_name}</span>
            {c.rendered ? (
              <>
                <span className="text-xs text-galaxy-text-muted">{c.page_count} pages</span>
                <a href={c.interior_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-galaxy-secondary text-xs"><FileText size={12} /> Interior</a>
                <a href={c.cover_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-galaxy-secondary text-xs"><FileText size={12} /> Cover</a>
              </>
            ) : <span className="text-xs text-galaxy-text-muted">not rendered</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-galaxy-text-muted">{r.excluded_count} child(ren) excluded (no pieces).</p>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {busy && <p className="text-sm text-galaxy-text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</p>}

      <div className="flex flex-wrap gap-2">
        {canSend && (
          <button disabled={!!busy} onClick={approveAndSubmit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-galaxy-primary/30 hover:bg-galaxy-primary/40 disabled:opacity-50">
            <Printer size={14} /> Approve &amp; send to printer
          </button>
        )}
        {['requested', 'approved', 'failed'].includes(r.status) && !(r.status === 'approved' && r.submit_claimed_at) && (
          <button disabled={!!busy} onClick={() => simple({ action: 'cancel' }, 'Cancel this request? The teacher can ask again.')} className="px-3 py-2 rounded-lg text-sm border border-white/15 disabled:opacity-50">
            Cancel request
          </button>
        )}
        {r.status === 'submitted' && (
          <button disabled={!!busy} onClick={() => simple({ action: 'mark', status: 'in_production' })} className="px-3 py-2 rounded-lg text-sm border border-white/15">Mark in production</button>
        )}
        {['submitted', 'in_production'].includes(r.status) && (
          <button disabled={!!busy} onClick={() => simple({ action: 'mark', status: 'shipped' })} className="px-3 py-2 rounded-lg text-sm border border-white/15">Mark shipped</button>
        )}
      </div>
    </div>
  )
}

export default function ClassPrintRequests() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try { setRows((await call('/api/admin/class-prints')).requests ?? []) } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Class print requests</h2>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {openId && <Detail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
      {rows === null ? <Loader2 className="animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm text-galaxy-text-muted">No requests yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-galaxy-text-muted text-xs">
            <tr><th className="py-2">Created</th><th>Class</th><th>School</th><th>Year</th><th>Books</th><th>Status</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2">{String(r.created_at).slice(0, 10)}</td>
                <td>{r.classrooms?.name ?? '—'}</td>
                <td>{r.school_name}</td>
                <td>{r.school_year}</td>
                <td className="tabular-nums">{r.children_count}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                <td className="text-right"><button onClick={() => setOpenId(r.id)} className="text-galaxy-secondary hover:underline">Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
