// "Email me the worksheets" form for the public worksheet library and the
// landing page. Posts to /api/lead-signup, which starts the Resend welcome
// series. For parents and teachers only: the 18+ checkbox is required and
// the endpoint refuses without it.
//
// Shown to signed-out web visitors only. It renders nothing for a signed-in
// account (a class account is a child), and nothing inside the native apps.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/useAuthStore'
import { isNative } from '../../capacitor'

export default function LeadSignupForm({ className = '' }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('parent')
  const [adult, setAdult] = useState(false)
  const [website, setWebsite] = useState('') // honeypot, hidden from people
  const [state, setState] = useState('idle') // idle | sending | done | error

  if (isNative || authLoading || user) return null

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/lead-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, adult, website }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  const box = `rounded-2xl border border-galaxy-text-muted/25 p-4 font-body text-galaxy-text ${className}`
  const field = 'min-h-[44px] rounded-xl border border-galaxy-text-muted/25 bg-white px-3 text-black'

  if (state === 'done') {
    return (
      <p className={box} role="status">
        {t('marketing:lead_form.done')}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className={box}>
      <p className="font-heading text-lg font-bold">{t('marketing:lead_form.title')}</p>
      <p className="text-sm text-galaxy-text-muted">{t('marketing:lead_form.note')}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="lead-email">{t('marketing:lead_form.email_label')}</label>
        <input
          id="lead-email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('marketing:lead_form.email_placeholder')}
          className={`${field} flex-1 min-w-0`}
        />
        <label className="sr-only" htmlFor="lead-role">{t('marketing:lead_form.role_label')}</label>
        <select id="lead-role" value={role} onChange={(e) => setRole(e.target.value)} className={field}>
          <option value="parent">{t('marketing:lead_form.role_parent')}</option>
          <option value="teacher">{t('marketing:lead_form.role_teacher')}</option>
        </select>
        <button
          type="submit"
          disabled={state === 'sending'}
          className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-white btn-fill-primary transition-colors"
        >
          {state === 'sending' ? t('marketing:lead_form.sending') : t('marketing:lead_form.submit')}
        </button>
      </div>

      {/* Honeypot: off-screen, skipped by keyboard and screen readers. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
        <span>{t('marketing:lead_form.consent')}</span>
      </label>

      {state === 'error' && (
        <p className="mt-2 text-sm" role="alert">
          {t('marketing:lead_form.error')}
        </p>
      )}
    </form>
  )
}
