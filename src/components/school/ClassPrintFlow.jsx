import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Check, ExternalLink } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { schoolFetch } from '../../lib/schoolApi'
import { ADDRESS_FIELD_NAMES, REQUIRED_ADDRESS, STATUS_STEPS, emptyAddress, statusStep, wyErrorText } from './writingYearUi'

// "Print the class books" (spec §3, controller rulings R1–R3): the school
// address → a summary (N books, who isn't included yet) → the request.
// Nothing is printed until the owner reviews it; the status timeline below
// follows it. A paid (or comped) license only — a trial class sees why
// (web only; the iPad says "not available yet" with no pricing words).
// iPad: ClassPrintView.swift.
//
// Inside the native shell (Capacitor) no licensing/pricing words either —
// same neutral line as the iPad app (App Store 3.1.3).
const inNativeShell = Capacitor.isNativePlatform()

export default function ClassPrintFlow({ classId, canPrint, request, schoolYear, locale, onRequested }) {
  const { t } = useTranslation()
  const [step, setStep] = useState('idle') // idle | address | summary
  const [address, setAddress] = useState(() => emptyAddress(locale === 'it' ? 'IT' : 'US'))
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [badField, setBadField] = useState(null)
  // Stage 4 review I4: one book per paid seat. With more children than
  // seats, the teacher unticks children until the count fits.
  const [leftOut, setLeftOut] = useState(() => new Set())

  const set = (f) => (e) => { setAddress((a) => ({ ...a, [f]: e.target.value })); setBadField(null) }
  const complete = REQUIRED_ADDRESS.every((f) => address[f].trim())

  async function toSummary() {
    setBusy(true)
    setError(null)
    const res = await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, action: 'print_summary' }) })
    setBusy(false)
    if (!res.ok) return setError(wyErrorText(t, res.code))
    setSummary(res.data)
    setLeftOut(new Set())
    setStep('summary')
  }

  async function send() {
    setBusy(true)
    setError(null)
    const res = await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, action: 'print', address, left_out: [...leftOut] }) })
    setBusy(false)
    if (!res.ok) {
      if (res.code === 'bad_address') { setBadField(res.data?.field ?? null); setStep('address') }
      if (res.code === 'print_book_too_big' && res.data?.names?.length) {
        return setError(t('school:writing_year.errors.print_book_too_big', { names: res.data.names.join(', ') }))
      }
      if (res.code === 'too_many_children') {
        return setError(t('school:writing_year.errors.too_many_children', { seats: res.data?.seats, count: res.data?.count }))
      }
      return setError(wyErrorText(t, res.code))
    }
    setStep('idle')
    onRequested?.()
  }

  async function cancelRequest() {
    if (!window.confirm(t('school:writing_year.teacher.cancel_confirm'))) return
    setBusy(true)
    const res = await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, action: 'cancel_print', requestId: request.id }) })
    setBusy(false)
    if (!res.ok) return setError(wyErrorText(t, res.code))
    onRequested?.()
  }

  if (request) {
    const at = statusStep(request.status)
    return (
      <div className="space-y-3">
        <h3 className="font-heading text-sm font-bold text-galaxy-text">
          {t('school:writing_year.teacher.requests_heading', { year: String(schoolYear).replace('-', '–') })}
        </h3>
        {request.books_missing ? (
          <p role="alert" className="text-sm font-body text-amber-200">{t('school:writing_year.teacher.books_missing')}</p>
        ) : request.status === 'requested' && <p className="text-xs font-body text-galaxy-text-muted">{t('school:writing_year.teacher.print_sent')}</p>}
        {request.status === 'failed' ? (
          <p className="text-sm font-body text-amber-200">{t('school:writing_year.teacher.status.failed')} — {t('school:writing_year.teacher.failed_hint')}</p>
        ) : (
          <ol className="flex flex-wrap gap-2" aria-label={t('school:writing_year.teacher.print_heading')}>
            {STATUS_STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === at ? 'step' : undefined}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-body font-semibold border ${
                  i <= at ? 'bg-galaxy-secondary/15 border-galaxy-secondary/40 text-galaxy-text' : 'border-galaxy-text-muted/15 text-galaxy-text-muted'
                }`}
              >
                {i < at && <Check size={12} aria-hidden="true" />}
                {t(`school:writing_year.teacher.status.${s}`)}
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs font-body text-galaxy-text-muted">
          {t('school:writing_year.teacher.summary_included', { count: request.children_count })}
        </p>
        {request.tracking?.url && (
          <a href={request.tracking.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-body font-semibold text-galaxy-secondary hover:underline">
            {t('school:writing_year.teacher.track')} <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
        {request.status === 'requested' && (
          <button type="button" disabled={busy} onClick={cancelRequest} className="px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text">
            {t('school:writing_year.teacher.cancel_request')}
          </button>
        )}
        {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}
      </div>
    )
  }

  if (!canPrint) {
    return (
      <div className="space-y-1">
        <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:writing_year.teacher.print_heading')}</h3>
        <p className="text-sm font-body text-galaxy-text-muted">
          {inNativeShell ? t('school:writing_year.errors.print_not_available') : t('school:writing_year.teacher.print_needs_license')}
        </p>
      </div>
    )
  }

  if (step === 'idle') {
    return (
      <div className="space-y-2">
        <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:writing_year.teacher.print_heading')}</h3>
        <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.teacher.print_intro')}</p>
        <button type="button" onClick={() => setStep('address')} className="flex items-center gap-2 px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary">
          <Printer size={15} aria-hidden="true" /> {t('school:writing_year.teacher.print_start')}
        </button>
      </div>
    )
  }

  if (step === 'address') {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (complete) toSummary() }}>
        <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:writing_year.teacher.address_heading')}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {ADDRESS_FIELD_NAMES.map((f) => (
            <label key={f} className={`block space-y-1 ${f === 'school_name' || f === 'address_line1' || f === 'address_line2' ? 'sm:col-span-2' : ''}`}>
              <span className="text-xs font-body font-semibold text-galaxy-text-muted">{t(`school:writing_year.teacher.field.${f}`)}</span>
              <input
                value={address[f]}
                onChange={set(f)}
                aria-invalid={badField === f || undefined}
                maxLength={f === 'country_code' ? 2 : 120}
                type={f === 'contact_email' ? 'email' : f === 'contact_phone' ? 'tel' : 'text'}
                autoComplete={{ contact_email: 'email', contact_phone: 'tel', address_line1: 'address-line1', address_line2: 'address-line2', city: 'address-level2', state_code: 'address-level1', postal_code: 'postal-code', country_code: 'country', contact_name: 'name', school_name: 'organization' }[f]}
                className={`w-full px-3 py-2 glass border rounded-xl text-sm text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body ${badField === f ? 'border-red-400' : 'border-white/15'}`}
              />
            </label>
          ))}
        </div>
        {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setStep('idle'); setError(null) }} className="px-4 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/20">
            {t('school:writing_year.teacher.cancel')}
          </button>
          <button type="submit" disabled={!complete || busy} className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-50">
            {t('school:writing_year.teacher.next')}
          </button>
        </div>
      </form>
    )
  }

  // summary
  const printing = summary.included.filter((c) => !leftOut.has(c.student_id)).length
  const seatsCap = Number.isInteger(summary.seats) ? summary.seats : null
  const overSeats = seatsCap != null && summary.included.length > seatsCap
  const fits = seatsCap == null || printing <= seatsCap
  function toggle(id) {
    setLeftOut((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return (
    <div className="space-y-3">
      <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:writing_year.teacher.summary_heading')}</h3>
      <p className="text-sm font-body text-galaxy-text">{t('school:writing_year.teacher.summary_included', { count: printing })}</p>
      {overSeats && (
        <div className="space-y-2">
          <p className="text-sm font-body text-amber-200">{t('school:writing_year.teacher.over_seats', { seats: summary.seats, count: printing })}</p>
          <ul className="grid grid-cols-2 gap-1">
            {summary.included.map((c) => (
              <li key={c.student_id}>
                <label className="flex items-center gap-2 text-sm font-body text-galaxy-text">
                  <input type="checkbox" checked={!leftOut.has(c.student_id)} onChange={() => toggle(c.student_id)} />
                  {c.display_name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.excluded.length > 0 && (
        <p className="text-sm font-body text-amber-200">
          {t('school:writing_year.teacher.summary_excluded', { names: summary.excluded.map((c) => c.display_name).join(', ') })}
        </p>
      )}
      <p className="text-xs font-body text-galaxy-text-muted">{t('school:writing_year.teacher.summary_ship_to', { school: address.school_name, city: address.city })}</p>
      <p className="text-xs font-body text-galaxy-text-muted">{t('school:writing_year.teacher.summary_review')}</p>
      {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep('address')} className="px-4 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/20">
          {t('school:writing_year.teacher.back')}
        </button>
        <button type="button" disabled={busy || !printing || !fits} onClick={send} className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-50">
          {busy ? t('school:writing_year.teacher.sending') : t('school:writing_year.teacher.print_submit')}
        </button>
      </div>
    </div>
  )
}
