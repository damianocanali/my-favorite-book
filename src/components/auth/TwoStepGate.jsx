import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/useAuthStore'
import { needsSecondStep, verifiedTotps, verifyAnyCode, supportEmail } from '../../lib/mfa'

// When an account has 2-step sign-in on, a password (or Google/Apple)
// sign-in only reaches the first level. This covers the whole app until the
// authenticator code is entered — whichever way the person signed in, and
// on a restored session too. (The server can also refuse teacher endpoints
// below aal2: TEACHER_MFA_ENFORCE in api/_school.js.)
export default function TwoStepGate() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const [factors, setFactors] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    setFactors(null)
    if (!supabase || !user) return undefined
    ;(async () => {
      if (!(await needsSecondStep(supabase))) return
      const fs = await verifiedTotps(supabase).catch(() => [])
      if (live && fs.length) setFactors(fs)
    })()
    return () => { live = false }
  }, [user])

  if (!factors) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await verifyAnyCode(supabase, factors, code)
      setFactors(null); setCode('')
    } catch (err) {
      setError(err?.code === 'bad_code' ? 'bad_code' : 'wrong_code')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-galaxy-bg/95 px-4" role="dialog" aria-modal="true" aria-labelledby="two-step-gate-title">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
        <h2 id="two-step-gate-title" className="font-heading text-xl font-semibold text-galaxy-text flex items-center gap-2">
          <ShieldCheck size={20} /> {t('account:two_step.gate_title')}
        </h2>
        <p className="text-galaxy-text-muted font-body text-sm">{t('account:two_step.gate_body')}</p>
        <label className="sr-only" htmlFor="two-step-gate-code">{t('account:two_step.code_label')}</label>
        <input
          id="two-step-gate-code"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={9}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('account:two_step.code_placeholder')}
          className="w-full px-3 py-2 rounded-xl bg-galaxy-bg/60 border border-galaxy-text-muted/20 text-galaxy-text font-body tracking-widest text-center text-lg"
        />
        {error && <p className="text-red-400 font-body text-sm" role="alert">{t(`account:two_step.errors.${error}`)}</p>}
        <button type="submit" disabled={busy} className="w-full px-4 py-2.5 rounded-xl bg-galaxy-primary text-white font-body disabled:opacity-50">
          {t('account:two_step.confirm')}
        </button>
        <p className="text-galaxy-text-muted font-body text-xs">
          {t('account:two_step.lost_phone', { email: supportEmail() })}{' '}
          <a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a>
        </p>
        <button type="button" onClick={() => signOut()} className="w-full text-galaxy-text-muted hover:text-galaxy-text font-body text-sm">
          {t('account:two_step.gate_sign_out')}
        </button>
      </form>
    </div>
  )
}
