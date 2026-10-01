// Owner-only: class print requests ("My Writing Year" books, migration 024).
// English only, like the rest of AdminPage (see the note there).
// API: api/admin/class-prints.js — the security boundary; this is chrome.
//
// Two separate steps, never one click to the printer:
//   1. "Approve & render": pick Lulu's shipping option for this address,
//      approve, then render each child's PDFs (one call per child).
//   2. The owner opens every child's interior/cover (links last one hour),
//      sees the estimate (books × pages), then "Send to printer" — ONE Lulu
//      order. Idempotent server-side: a claimed request is never sent twice.
// A request whose submit crashed stays claimed: it can't be canceled until
// the owner reconciles (records Lulu's job id, or confirms no order).
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
  const [shipping, setShipping] = useState(null) // { options, default, quantity }
  const [level, setLevel] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [jobId, setJobId] = useState('')

  const load = useCallback(async () => {
    try { setData(await call(`/api/admin/class-prints?id=${id}`)) } catch (e) { setError(e.message) }
  }, [id])
  useEffect(() => { load() }, [load])

  async function run(label, fn) {
    setError(null)
    setBusy(label)
    try { await fn() } catch (e) { setError(e.message) }
    setBusy(null)
    await load()
    onChanged()
  }

  async function loadShipping() {
    await run('Asking Lulu for shipping options…', async () => {
      const s = await call('/api/admin/class-prints', { id, action: 'shipping_options' })
      setShipping(s)
      setLevel(data.request.shipping_level || s.default)
    })
  }

  async function approveAndRender() {
    await run('Approving…', async () => {
      if (data.request.status === 'requested') await call('/api/admin/class-prints', { id, action: 'approve', shippingLevel: level || undefined })
      const todo = data.children.filter((c) => !c.removed && !c.rendered)
      const problems = []
      for (const [i, c] of todo.entries()) {
        setBusy(`Rendering ${i + 1}/${todo.length} (${c.display_name})…`)
        // A page that doesn't fit is reported per child; the others still render.
        try { await call('/api/admin/class-prints', { id, action: 'render', childId: c.id }) } catch (e) { problems.push(`${c.display_name}: ${e.message}`) }
      }
      if (problems.length) throw new Error(problems.join(' · '))
      setEstimate(await call('/api/admin/class-prints', { id, action: 'estimate' }))
    })
  }

  async function rerender(c) {
    if (!window.confirm(`Re-render ${c.display_name}'s book?`)) return
    await run(`Re-rendering ${c.display_name}…`, () => call('/api/admin/class-prints', { id, action: 'render', childId: c.id, rerender: true }))
  }

  async function send() {
    const est = estimate ?? await call('/api/admin/class-prints', { id, action: 'estimate' })
    if (!window.confirm(`Send ${est.books} books (${est.pages_total} pages, ${est.shipping_level}) to Lulu as ONE order? This spends real money.`)) return
    await run('Sending to Lulu…', () => call('/api/admin/class-prints', { id, action: 'submit' }))
  }

  if (!data) return <div className="py-6 flex justify-center"><Loader2 className="animate-spin" /></div>
  const r = data.request
  const active = data.children.filter((c) => !c.removed)
  const allRendered = active.length > 0 && active.every((c) => c.rendered)
  const claimed = !!r.submit_claimed_at
  const canStep1 = (r.status === 'requested' || (r.status === 'approved' && !allRendered)) && !claimed
  const canSend = r.status === 'approved' && allRendered && !claimed
  const stuck = claimed && ['approved', 'failed'].includes(r.status)
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
            {r.shipping_level && <span className="ml-2 text-xs text-galaxy-text-muted">Shipping {r.shipping_level}</span>}
            {r.lulu_print_job_id && <span className="ml-2 text-xs text-galaxy-text-muted">Lulu job {r.lulu_print_job_id} {r.lulu_status ? `(${r.lulu_status})` : ''}</span>}
          </p>
          {!r.books_frozen_at && r.status === 'requested' && <p className="text-sm text-amber-200 mt-1">The books were not saved — this request can't be approved.</p>}
          {r.error && <p className="text-sm text-red-300 mt-1">{r.error}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 text-galaxy-text-muted hover:text-galaxy-text"><X size={18} /></button>
      </div>

      {stuck && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 space-y-2 text-sm">
          <p className="text-amber-100">Sending started at {r.submit_claimed_at} and did not finish. Lulu may have the order. Check the Lulu dashboard for external id <code>{r.id}</code>.</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={jobId} onChange={(e) => setJobId(e.target.value.trim())} placeholder="Lulu job id" className="glass border border-white/15 rounded-lg px-2 py-1 text-sm" />
            <button disabled={!jobId || !!busy} onClick={() => run('Recording…', () => call('/api/admin/class-prints', { id, action: 'reconcile', luluPrintJobId: jobId }))} className="px-3 py-1.5 rounded-lg border border-white/15 disabled:opacity-50">Record Lulu job</button>
            <button disabled={!!busy} onClick={() => window.confirm('You checked Lulu and there is NO order for this request?') && run('Releasing…', () => call('/api/admin/class-prints', { id, action: 'reconcile', confirmNoOrder: true }))} className="px-3 py-1.5 rounded-lg border border-white/15 disabled:opacity-50">Checked Lulu — no order exists</button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-white/5">
        {data.children.map((c) => (
          <li key={c.id} className={`py-2 flex items-center gap-3 text-sm ${c.removed ? 'opacity-50' : ''}`}>
            <span className="w-6 text-galaxy-text-muted tabular-nums">{c.position}</span>
            <span className="flex-1">{c.display_name}{c.removed && <span className="ml-2 text-xs text-amber-200">left the class — not printed</span>}
              {c.problem && <span className="block text-xs text-red-300">{c.problem} — the teacher must shorten it; then re-render</span>}</span>
            {c.rendered ? (
              <>
                <span className="text-xs text-galaxy-text-muted">{c.page_count} pages</span>
                <a href={c.interior_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-galaxy-secondary text-xs"><FileText size={12} /> Interior</a>
                <a href={c.cover_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-galaxy-secondary text-xs"><FileText size={12} /> Cover</a>
                {r.status === 'approved' && !claimed && <button onClick={() => rerender(c)} className="text-xs text-galaxy-text-muted hover:underline">Re-render</button>}
              </>
            ) : <span className="text-xs text-galaxy-text-muted">{c.removed ? '' : 'not rendered'}</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-galaxy-text-muted">{r.excluded_count} child(ren) excluded at request time (no pieces). PDF links last one hour — reload to refresh.</p>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {busy && <p className="text-sm text-galaxy-text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</p>}

      {canStep1 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-galaxy-text-muted">Step 1 — approve &amp; render</p>
          {r.status === 'requested' && (
            shipping ? (
              <label className="flex items-center gap-2 text-sm">Shipping
                <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass border border-white/15 rounded-lg px-2 py-1">
                  {shipping.options.length === 0 && <option value={shipping.default}>{shipping.default} (default)</option>}
                  {shipping.options.map((o) => (
                    <option key={o.level} value={o.level}>{o.level}{o.cost ? ` — ${o.cost} ${o.currency ?? ''}` : ''}{o.max_days ? ` · ${o.min_days ?? '?'}–${o.max_days} days` : ''}</option>
                  ))}
                </select>
                <span className="text-xs text-galaxy-text-muted">for {shipping.quantity} books</span>
                {shipping.error && <span className="text-xs text-amber-200">Lulu's options failed ({shipping.error}) — the default will be used</span>}
              </label>
            ) : (
              <button disabled={!!busy} onClick={loadShipping} className="px-3 py-2 rounded-lg text-sm border border-white/15 disabled:opacity-50">Get shipping options</button>
            )
          )}
          <button disabled={!!busy || (r.status === 'requested' && (!shipping || !r.books_frozen_at))} onClick={approveAndRender} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-galaxy-primary/30 hover:bg-galaxy-primary/40 disabled:opacity-50">
            <FileText size={14} /> {r.status === 'requested' ? 'Approve & render' : 'Render the rest'}
          </button>
        </div>
      )}

      {canSend && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-galaxy-text-muted">Step 2 — check every PDF above, then send</p>
          {estimate ? (
            <p className="text-sm">Estimate: {estimate.books} books · {estimate.pages_total} pages · shipping {estimate.shipping_level}. (Lulu's price is not calculated here.)</p>
          ) : (
            <button disabled={!!busy} onClick={() => run('Estimating…', async () => setEstimate(await call('/api/admin/class-prints', { id, action: 'estimate' })))} className="px-3 py-2 rounded-lg text-sm border border-white/15">Show estimate</button>
          )}
          <button disabled={!!busy} onClick={send} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-galaxy-primary/30 hover:bg-galaxy-primary/40 disabled:opacity-50">
            <Printer size={14} /> Send to printer
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['requested', 'approved', 'failed'].includes(r.status) && !claimed && (
          <button disabled={!!busy} onClick={() => window.confirm('Cancel this request? The teacher can ask again.') && run('Canceling…', () => call('/api/admin/class-prints', { id, action: 'cancel' }))} className="px-3 py-2 rounded-lg text-sm border border-white/15 disabled:opacity-50">
            Cancel request
          </button>
        )}
        {r.status === 'submitted' && (
          <button disabled={!!busy} onClick={() => run('Working…', () => call('/api/admin/class-prints', { id, action: 'mark', status: 'in_production' }))} className="px-3 py-2 rounded-lg text-sm border border-white/15">Mark in production</button>
        )}
        {['submitted', 'in_production'].includes(r.status) && (
          <button disabled={!!busy} onClick={() => run('Working…', () => call('/api/admin/class-prints', { id, action: 'mark', status: 'shipped' }))} className="px-3 py-2 rounded-lg text-sm border border-white/15">Mark shipped</button>
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
                <td><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_TONE[r.status]}`}>{r.status}</span>{r.submit_claimed_at && ['approved', 'failed'].includes(r.status) && <span className="ml-1 text-xs text-amber-200">needs reconcile</span>}</td>
                <td className="text-right"><button onClick={() => setOpenId(r.id)} className="text-galaxy-secondary hover:underline">Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
