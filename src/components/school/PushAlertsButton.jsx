import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, BellOff, Loader2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { schoolFetch } from '../../lib/schoolApi'
import { pushSupport, browserPushEnv, urlBase64ToUint8Array } from '../../lib/teacherNotifications'

const SW_URL = '/sw.js'

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  return reg ? reg.pushManager.getSubscription() : null
}

// "Turn on alerts on this computer" (spec §12.4): registers public/sw.js and
// a web push subscription for urgent asks. Hidden when the browser can't do
// web push, inside the native app (iOS uses APNs), or before the server has
// VAPID keys.
export default function PushAlertsButton() {
  const { t } = useTranslation()
  const [support, setSupport] = useState(() => pushSupport(browserPushEnv(Capacitor.isNativePlatform())))
  const [vapidKey, setVapidKey] = useState(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (support === 'unsupported') return
    let live = true
    ;(async () => {
      const res = await schoolFetch('/api/school/push-subscribe')
      if (!live || !res.ok) return
      setVapidKey(res.data?.vapidPublicKey ?? null)
      try {
        const sub = await currentSubscription()
        if (live) setSubscribed(Boolean(sub))
      } catch {
        // No registration yet: stays "off".
      }
    })()
    return () => {
      live = false
    }
  }, [support])

  async function turnOn() {
    setBusy(true)
    setError(false)
    try {
      const permission = await window.Notification.requestPermission()
      setSupport(permission)
      if (permission !== 'granted') return
      const reg = await navigator.serviceWorker.register(SW_URL)
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }))
      const res = await schoolFetch('/api/school/push-subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) })
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {})
        setError(true)
        return
      }
      setSubscribed(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setError(false)
    try {
      const sub = await currentSubscription()
      if (sub) {
        await schoolFetch('/api/school/push-subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (support === 'unsupported' || !vapidKey) return null

  if (support === 'denied') {
    return (
      <p className="flex items-center gap-2 font-body text-sm text-galaxy-text-muted">
        <BellOff size={16} /> {t('school:notifications.push.blocked')}
      </p>
    )
  }

  if (subscribed && support === 'granted') {
    return (
      <div className="flex flex-wrap items-center gap-3 font-body text-sm">
        <span className="flex items-center gap-2 text-emerald-400">
          <BellRing size={16} /> {t('school:notifications.push.on')}
        </span>
        <button
          type="button"
          onClick={turnOff}
          disabled={busy}
          className="text-galaxy-text-muted underline-offset-2 hover:text-galaxy-text hover:underline disabled:opacity-60"
        >
          {t('school:notifications.push.turn_off')}
        </button>
        {error && <span className="text-red-400">{t('school:notifications.push.error')}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={turnOn}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-galaxy-secondary/40 px-4 py-2 font-body text-sm font-semibold text-galaxy-text transition-colors hover:border-galaxy-secondary disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
        {t('school:notifications.push.turn_on')}
      </button>
      <span className="font-body text-xs text-galaxy-text-muted">{t('school:notifications.push.hint')}</span>
      {error && <span className="font-body text-sm text-red-400">{t('school:notifications.push.error')}</span>}
    </div>
  )
}
