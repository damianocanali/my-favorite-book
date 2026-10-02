// "We're confirming you're a teacher" (Stage 4). Shown to a signed-in
// teacher who isn't verified yet: they can look around but can't create
// classes, start trials, add students or buy. A confirmed school-domain
// email is verified on the server automatically; anyone else asks here and
// the owner approves (api/school/verification.js).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'

export default function TeacherVerificationNotice({ onVerified }) {
  const { t } = useTranslation()
  const [state, setState] = useState(null)
  const [schoolName, setSchoolName] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    schoolFetch('/api/school/verification').then((res) => {
      if (!live || !res.ok) return
      setState(res.data)
      if (res.data?.verified) onVerified?.()
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ask() {
    setSending(true)
    setError(false)
    const res = await schoolFetch('/api/school/verification', {
      method: 'POST',
      body: JSON.stringify({ school_name: schoolName.trim() || undefined }),
    })
    setSending(false)
    if (!res.ok) { setError(true); return }
    setState(res.data)
    if (res.data?.verified) onVerified?.()
  }

  if (state?.verified) return null
  const req = state?.request
  const pending = req?.status === 'pending'
  const declined = req?.status === 'declined'

  return (
    <section role="status" className="glass rounded-2xl p-6 border border-amber-500/30 space-y-3 mb-8">
      <h2 className="font-heading text-lg font-bold text-galaxy-text flex items-center gap-2">
        <ShieldCheck size={18} className="text-amber-300" /> {t('school:teacher.verify.title')}
      </h2>
      <p className="text-sm font-body text-galaxy-text">{t('school:teacher.verify.body')}</p>
      {state && !state.email_confirmed && state.school_domain && (
        <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.verify.unconfirmed_hint')}</p>
      )}
      {state && !state.school_domain && !pending && (
        <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.verify.school_email_hint')}</p>
      )}
      {pending && <p className="text-sm font-body text-emerald-300">{t('school:teacher.verify.requested')}</p>}
      {declined && <p className="text-sm font-body text-amber-300">{t('school:teacher.verify.declined', { reason: req.decline_reason ?? '' })}</p>}
      {state && !pending && !state.school_domain && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-body text-galaxy-text">{t('school:teacher.verify.school_name')}</span>
            <input type="text" maxLength={120} value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-galaxy-bg/60 border border-galaxy-text-muted/20 text-galaxy-text font-body text-sm" />
          </label>
          <button onClick={ask} disabled={sending}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-50">
            {declined ? t('school:teacher.verify.request_again') : t('school:teacher.verify.request')}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-body text-red-400">{t('school:teacher.verify.error')}</p>}
    </section>
  )
}
