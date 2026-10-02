import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { verifiedTotps, startEnroll, verifyCode, cancelEnroll, disable } from '../../lib/mfa'

// Account page, teachers: optional "2-step sign-in" with an authenticator
// app (TOTP, Supabase Auth MFA). Teachers see a class's check-ins and
// writing, so a stolen password alone shouldn't be enough.
export default function TwoStepSettings() {
  const { t } = useTranslation()
  const [factors, setFactors] = useState(undefined) // undefined = loading, [] = off
  const [setup, setSetup] = useState(null) // { factorId, qr, secret }
  const [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // 'on' | 'off'

  async function refresh() {
    try { setFactors(await verifiedTotps(supabase)) } catch { setFactors([]); setError('load') }
  }
  useEffect(() => { if (supabase) refresh() }, [])

  if (!supabase) return null

  async function begin() {
    setError(null); setDone(null); setBusy(true)
    try { setSetup(await startEnroll(supabase)) } catch { setError('generic') }
    setBusy(false)
  }

  async function confirm(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      if (setup) {
        const adding = factors.length > 0
        await verifyCode(supabase, setup.factorId, code)
        setSetup(null); setDone(adding ? 'backup' : 'on')
      } else if (disabling && factors.length) {
        await disable(supabase, factors, code)
        setDisabling(false); setDone('off')
      }
      setCode('')
      await refresh()
    } catch (err) {
      setError(err?.code === 'bad_code' ? 'bad_code' : err?.code === 'wrong_code' ? 'wrong_code' : 'generic')
    }
    setBusy(false)
  }

  async function cancel() {
    if (setup) await cancelEnroll(supabase, setup.factorId)
    setSetup(null); setDisabling(false); setCode(''); setError(null)
  }

  const codeForm = (
    <form onSubmit={confirm} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="two-step-code">{t('account:two_step.code_label')}</label>
      <input
        id="two-step-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={9}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('account:two_step.code_placeholder')}
        className="w-36 px-3 py-2 rounded-xl bg-galaxy-bg/60 border border-galaxy-text-muted/20 text-galaxy-text font-body tracking-widest"
      />
      <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-galaxy-primary text-white font-body text-sm disabled:opacity-50">
        {t('account:two_step.confirm')}
      </button>
      <button type="button" onClick={cancel} className="px-3 py-2 text-galaxy-text-muted hover:text-galaxy-text font-body text-sm">
        {t('account:two_step.cancel')}
      </button>
    </form>
  )

  return (
    <div className="mt-4 glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-3">
      <h3 className="font-heading text-base font-semibold text-galaxy-text flex items-center gap-2">
        <ShieldCheck size={18} /> {t('account:two_step.title')}
      </h3>
      <p className="text-galaxy-text-muted font-body text-sm">{t('account:two_step.body')}</p>
      <p className="text-galaxy-text-muted font-body text-xs">{t('account:two_step.backup_hint')}</p>

      {factors === undefined ? null : setup ? (
        <div className="space-y-3">
          <p className="text-galaxy-text font-body text-sm">{t('account:two_step.scan')}</p>
          <img src={setup.qr} alt={t('account:two_step.qr_alt')} className="w-44 h-44 bg-white rounded-xl p-2" />
          <p className="text-galaxy-text-muted font-body text-xs">
            {t('account:two_step.manual')} <code className="break-all select-all">{setup.secret}</code>
          </p>
          <p className="text-galaxy-text font-body text-sm">{t('account:two_step.enter_code')}</p>
          {codeForm}
        </div>
      ) : factors.length ? (
        <div className="space-y-3">
          <p className="text-emerald-300 font-body text-sm">{t('account:two_step.status_on')}</p>
          <p className="text-galaxy-text-muted font-body text-sm">
            {t('account:two_step.devices', { count: factors.length })}
          </p>
          {disabling ? (
            <>
              <p className="text-galaxy-text font-body text-sm">{t('account:two_step.disable_prompt')}</p>
              {codeForm}
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={begin} disabled={busy} className="px-4 py-2 rounded-xl bg-galaxy-primary/80 text-white font-body text-sm disabled:opacity-50">
                {t('account:two_step.add_backup')}
              </button>
              <button type="button" onClick={() => { setDone(null); setDisabling(true) }} className="px-4 py-2 rounded-xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text font-body text-sm">
                {t('account:two_step.turn_off')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-galaxy-text-muted font-body text-sm">{t('account:two_step.status_off')}</p>
          <button type="button" onClick={begin} disabled={busy} className="px-4 py-2 rounded-xl bg-galaxy-primary text-white font-body text-sm disabled:opacity-50">
            {t('account:two_step.turn_on')}
          </button>
        </div>
      )}

      {done && <p className="text-emerald-300 font-body text-sm" role="status">{t(`account:two_step.done_${done}`)}</p>}
      {error && <p className="text-red-400 font-body text-sm" role="alert">{t(`account:two_step.errors.${error}`)}</p>}
    </div>
  )
}
