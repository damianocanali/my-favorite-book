import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, X } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { notificationText, notificationHref, unreadBadge } from '../../lib/teacherNotifications'
import { relativeTime } from './relativeTime'

const POLL_MS = 60 * 1000

// The teacher's bell (spec §12.4): unread count in the header, a list of
// the latest 50 on click. Polls every 60 s, only while the tab is visible.
export default function NotificationBell() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const rootRef = useRef(null)

  const load = useCallback(async () => {
    const res = await schoolFetch('/api/school/notifications')
    if (!res.ok) {
      setError(true)
      return
    }
    setError(false)
    setItems(res.data?.notifications ?? [])
    setUnread(res.data?.unread ?? 0)
  }, [])

  useEffect(() => {
    load()
    const tick = () => {
      if (document.visibilityState === 'visible') load()
    }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  useEffect(() => {
    if (!open) setConfirmingClear(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markAllRead() {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    const res = await schoolFetch('/api/school/notifications', { method: 'POST', body: JSON.stringify({ action: 'read' }) })
    if (!res.ok) load()
  }

  // Optimistic, like mark-read; a failed delete reloads the truth.
  async function dismiss(n) {
    setItems((prev) => prev.filter((x) => x.id !== n.id))
    if (!n.read_at) setUnread((c) => Math.max(0, c - 1))
    const res = await schoolFetch(`/api/school/notifications?id=${encodeURIComponent(n.id)}`, { method: 'DELETE' })
    if (!res.ok) load()
  }

  async function clearAll() {
    setConfirmingClear(false)
    setItems([])
    setUnread(0)
    const res = await schoolFetch('/api/school/notifications', { method: 'DELETE' })
    if (!res.ok) load()
  }

  function openItem(n) {
    setOpen(false)
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((c) => Math.max(0, c - 1))
      schoolFetch('/api/school/notifications', { method: 'POST', body: JSON.stringify({ action: 'read', ids: [n.id] }) })
    }
    navigate(notificationHref(n))
  }

  const badge = unreadBadge(unread)
  const label = badge ? t('school:notifications.bell_label_unread', { count: unread }) : t('school:notifications.bell_label')

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex items-center rounded-full p-2 text-white/60 transition-colors hover:text-white"
      >
        <Bell size={18} />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center font-body text-[10px] font-bold leading-[18px] text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('school:notifications.title')}
          className="glass absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-galaxy-bg/95 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <h2 className="font-heading text-sm font-bold text-galaxy-text">{t('school:notifications.title')}</h2>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="font-body text-xs font-semibold text-galaxy-secondary hover:underline"
                >
                  {t('school:notifications.mark_all_read')}
                </button>
              )}
              {items.length > 0 && !confirmingClear && (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="font-body text-xs font-semibold text-galaxy-text-muted hover:text-galaxy-text hover:underline"
                >
                  {t('school:notifications.clear_all')}
                </button>
              )}
            </div>
          </div>

          {confirmingClear && (
            <div role="alertdialog" aria-label={t('school:notifications.clear_confirm')} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-red-500/10 px-4 py-2">
              <span className="font-body text-xs text-galaxy-text">{t('school:notifications.clear_confirm')}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="rounded-lg px-2 py-1 font-body text-xs font-semibold text-galaxy-text-muted hover:text-galaxy-text"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-lg bg-red-500/80 px-2 py-1 font-body text-xs font-bold text-white hover:bg-red-500"
                >
                  {t('school:notifications.clear_confirm_action')}
                </button>
              </span>
            </div>
          )}

          <ul className="max-h-[60vh] overflow-y-auto">
            {error && items.length === 0 && (
              <li className="px-4 py-6 text-center font-body text-sm text-red-400">{t('school:notifications.error')}</li>
            )}
            {!error && items.length === 0 && (
              <li className="px-4 py-6 text-center font-body text-sm text-galaxy-text-muted">{t('school:notifications.empty')}</li>
            )}
            {items.map((n) => (
              <li key={n.id} className="group flex items-start">
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-4 pr-1 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : n.kind === 'help_grownup' ? 'bg-red-400' : 'bg-galaxy-secondary'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-body text-sm ${n.read_at ? 'text-galaxy-text-muted' : 'text-galaxy-text'}`}>
                      {notificationText(t, n)}
                    </span>
                    <span className="block font-body text-xs text-galaxy-text-muted">
                      {[relativeTime(n.created_at, i18n.language), n.payload?.class_name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(n)}
                  aria-label={t('school:notifications.dismiss')}
                  title={t('school:notifications.dismiss')}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-galaxy-text-muted/60 transition-colors hover:text-galaxy-text"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <p className="border-t border-white/10 px-4 py-2 font-body text-[11px] text-galaxy-text-muted">
            {t('school:notifications.disclaimer')}
          </p>
        </div>
      )}
    </div>
  )
}
