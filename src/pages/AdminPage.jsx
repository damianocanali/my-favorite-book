// Owner-only cost dashboard. Hidden from non-owner users via a UUID check
// against VITE_OWNER_USER_ID. Server-side gating in /api/admin/usage is
// the actual security boundary; this client-side check just avoids
// rendering chrome the user can't read anyway.
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { apiFetchAuthed } from '../lib/api'

const OWNER_ID = import.meta.env.VITE_OWNER_USER_ID

const FEATURE_LABELS = {
  story_buddy: 'StoryBuddy (Claude)',
  generate_image: 'Page illustrations',
  generate_avatar: 'Avatars',
  pdf_upscale: 'Print upscale',
}

const SERVICE_LABELS = {
  anthropic: 'Anthropic',
  together: 'Together AI',
}

function fmt(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const [windowDays, setWindowDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isOwner = !!user && OWNER_ID && user.id === OWNER_ID

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await apiFetchAuthed(`/api/admin/usage?days=${windowDays}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${r.status}`)
      }
      setData(await r.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOwner) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, windowDays])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-galaxy-text-muted" />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-galaxy-text-muted font-body">Not found.</p>
      </div>
    )
  }

  const days = Object.keys(data?.byDay ?? {}).sort()
  const maxDailyCents = days.reduce((m, d) => {
    const sum = (data.byDay[d].anthropic ?? 0) + (data.byDay[d].together ?? 0)
    return Math.max(m, sum)
  }, 0)

  return (
    <div className="min-h-screen text-galaxy-text font-body">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Cost Dashboard</h1>
            <p className="text-galaxy-text-muted text-sm mt-1">Last {windowDays} days · Owner view only</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="glass border border-galaxy-text-muted/20 rounded-lg px-3 py-2 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!data && loading && (
          <div className="text-center py-20 text-galaxy-text-muted">
            <Loader2 className="animate-spin mx-auto mb-2" />
            Loading…
          </div>
        )}

        {data && (
          <>
            {/* ── Totals ───────────────── */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="glass rounded-xl p-5 border border-galaxy-text-muted/10">
                <p className="text-xs uppercase tracking-wide text-galaxy-text-muted mb-1">Total ({windowDays}d)</p>
                <p className="font-heading text-3xl font-bold">{fmt(data.totals.all)}</p>
                <p className="text-xs text-galaxy-text-muted mt-1">{data.total_rows} API calls</p>
              </div>
              <div className="glass rounded-xl p-5 border border-galaxy-text-muted/10">
                <p className="text-xs uppercase tracking-wide text-galaxy-text-muted mb-1">Anthropic</p>
                <p className="font-heading text-3xl font-bold">{fmt(data.totals.anthropic ?? 0)}</p>
                <p className="text-xs text-galaxy-text-muted mt-1">Claude API</p>
              </div>
              <div className="glass rounded-xl p-5 border border-galaxy-text-muted/10">
                <p className="text-xs uppercase tracking-wide text-galaxy-text-muted mb-1">Together AI</p>
                <p className="font-heading text-3xl font-bold">{fmt(data.totals.together ?? 0)}</p>
                <p className="text-xs text-galaxy-text-muted mt-1">FLUX images</p>
              </div>
            </section>

            {/* ── By feature ───────────── */}
            <section className="mb-8">
              <h2 className="font-heading text-xl font-semibold mb-3">By feature</h2>
              <div className="glass rounded-xl border border-galaxy-text-muted/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-galaxy-text-muted text-xs uppercase">
                      <th className="text-left px-4 py-2">Feature</th>
                      <th className="text-right px-4 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byFeature)
                      .sort(([, a], [, b]) => b - a)
                      .map(([feat, c]) => (
                        <tr key={feat} className="border-t border-galaxy-text-muted/10">
                          <td className="px-4 py-2">{FEATURE_LABELS[feat] ?? feat}</td>
                          <td className="text-right px-4 py-2 font-mono">{fmt(c)}</td>
                        </tr>
                      ))}
                    {Object.keys(data.byFeature).length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center py-6 text-galaxy-text-muted">
                          No usage in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Daily trend ──────────── */}
            <section className="mb-8">
              <h2 className="font-heading text-xl font-semibold mb-3">Daily</h2>
              <div className="glass rounded-xl border border-galaxy-text-muted/10 p-4">
                {days.length === 0 ? (
                  <p className="text-center py-6 text-galaxy-text-muted text-sm">No usage in this window.</p>
                ) : (
                  <div className="space-y-1.5">
                    {days.slice().reverse().map((d) => {
                      const a = data.byDay[d].anthropic ?? 0
                      const t = data.byDay[d].together ?? 0
                      const sum = a + t
                      const widthPct = maxDailyCents > 0 ? (sum / maxDailyCents) * 100 : 0
                      const aPct = sum > 0 ? (a / sum) * 100 : 0
                      return (
                        <div key={d} className="flex items-center gap-3 text-xs">
                          <span className="w-20 text-galaxy-text-muted font-mono">{d}</span>
                          <div className="flex-1 h-5 bg-galaxy-bg rounded overflow-hidden flex">
                            <div
                              className="h-full bg-purple-500/60"
                              style={{ width: `${widthPct * (aPct / 100)}%` }}
                              title={`Anthropic ${fmt(a)}`}
                            />
                            <div
                              className="h-full bg-cyan-500/60"
                              style={{ width: `${widthPct * ((100 - aPct) / 100)}%` }}
                              title={`Together ${fmt(t)}`}
                            />
                          </div>
                          <span className="w-16 text-right font-mono">{fmt(sum)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex gap-4 mt-4 text-xs text-galaxy-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-purple-500/60"></span>
                    Anthropic
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-cyan-500/60"></span>
                    Together
                  </span>
                </div>
              </div>
            </section>

            <p className="text-xs text-galaxy-text-muted">
              Costs are estimates based on hardcoded rates in <code>api/_usage.js</code>. Update when providers change pricing.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
