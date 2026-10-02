// "Plan & billing" on a class page (Stage 4, web only): status, seats used,
// renewal date, buying seats (Stripe Checkout), changing seats, the Stripe
// Customer Portal, invoices, and seat blocks offered by a school plan.
//
// Prices are DISPLAYED from lib/school/pricing.js (the server's copy); the
// server charges the Stripe Price for the same tier, never an amount from
// here. The iPad shows status and seats only, never a price (App Store 3.1.3).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, ExternalLink, Receipt } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { formatDate, formatMoneyCents } from '../../i18n/formats'
import {
  quoteClass, isFoundingEligible, MIN_CLASS_SEATS, MIN_SCHOOL_SEATS, MAX_CLASS_SEATS, FOUNDING_LAST_DAY
} from '../../../lib/school/pricing.js'
import { NDPA_PATH } from '../../../lib/school/billingApi.js'

const BUYABLE = ['trial', 'lapsed', 'canceled']
const foundingDate = () => formatDate(`${FOUNDING_LAST_DAY}T12:00:00Z`, 'long')

function StatusLine({ license, t }) {
  if (!license) return <p className="font-body text-galaxy-text">{t('school:teacher.billing.status.none')}</p>
  const date = formatDate(license.expires_at, 'long')
  let when = null
  if (license.status === 'trial') when = t('school:teacher.billing.trial_ends', { date })
  else if (license.status === 'pending_payment') when = t('school:teacher.billing.due', { date })
  else if (license.cancel_at_period_end) when = t('school:teacher.billing.cancel_at_end', { date })
  else if (license.status === 'active') when = t('school:teacher.billing.renews', { date })
  else if (license.status === 'grace') when = t('school:teacher.billing.grace_note')
  return (
    <div className="space-y-1">
      <p className="font-body font-semibold text-galaxy-text">{t(`school:teacher.billing.status.${license.status}`, { defaultValue: license.status })}</p>
      {when && <p className="text-sm font-body text-galaxy-text-muted">{when}</p>}
    </div>
  )
}

export default function PlanBillingSection({ classId, onChanged }) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(() => {
    const b = searchParams.get('billing')
    return b === 'success' ? 'success' : b === 'canceled' ? 'canceled_checkout' : null
  })
  const [invoices, setInvoices] = useState(null)

  // Buy form
  const [seats, setSeats] = useState(20)
  const [schoolName, setSchoolName] = useState('')
  const [dpa, setDpa] = useState(false)
  // Seat change form
  const [newSeats, setNewSeats] = useState(null)

  const load = useCallback(async () => {
    const res = await schoolFetch(`/api/school/billing?classId=${encodeURIComponent(classId)}`)
    if (!res.ok) { setError(res.code || 'generic'); return }
    setError(null)
    setData(res.data)
    if (res.data?.students > 20) setSeats(Math.min(MAX_CLASS_SEATS, res.data.students))
    if (res.data?.can_manage_billing) {
      const inv = await schoolFetch(`/api/school/billing?classId=${encodeURIComponent(classId)}&invoices=1`)
      if (inv.ok) setInvoices(inv.data?.invoices ?? [])
    }
  }, [classId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('billing')) {
      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const quote = useMemo(() => quoteClass(Number(seats)), [seats])
  const license = data?.license ?? null
  const canBuy = !license || BUYABLE.includes(license.status)
  const canChangeSeats = license && !license.school_plan && ['active', 'grace'].includes(license.status) && data?.can_manage_billing

  async function post(body, key) {
    setBusy(key)
    setError(null)
    const res = await schoolFetch('/api/school/billing', { method: 'POST', body: JSON.stringify({ classId, ...body }) })
    setBusy(null)
    if (!res.ok) { setError(res.code || 'generic'); return null }
    return res.data
  }

  async function buy() {
    if (!quote.ok || !schoolName.trim() || !dpa) return
    setBusy('buy')
    setError(null)
    const res = await schoolFetch('/api/school/checkout', {
      method: 'POST',
      body: JSON.stringify({ kind: 'class', classId, seats: Number(seats), school_name: schoolName.trim(), dpa_accept: true }),
    })
    setBusy(null)
    if (!res.ok) { setError(res.code || 'generic'); return }
    window.location.assign(res.data.url)
  }

  async function portal() {
    const out = await post({ action: 'portal' }, 'portal')
    if (out?.url) window.location.assign(out.url)
  }

  async function changeSeats() {
    const n = Number(newSeats)
    const out = await post({ action: 'seats', seats: n }, 'seats')
    if (!out) return
    setNotice(out.mode === 'increase' ? 'seats.done_increase' : out.mode === 'decrease' ? 'seats.done_decrease' : 'seats.done_cancel')
    setNewSeats(null)
    await load()
    onChanged?.()
  }

  async function answerOffer(offerId, accept) {
    const out = await post({ action: accept ? 'offer_accept' : 'offer_decline', offerId }, `offer-${offerId}`)
    if (out) { await load(); onChanged?.() }
  }

  const input = 'w-full px-3 py-2 rounded-xl bg-galaxy-bg/60 border border-galaxy-text-muted/20 text-galaxy-text font-body text-sm focus:outline-none focus:border-galaxy-primary'
  const primary = 'px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-50'
  const secondary = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-body text-sm text-galaxy-text border border-galaxy-text-muted/20 hover:border-galaxy-text-muted/40 transition-colors disabled:opacity-50'

  return (
    <section className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-5" aria-labelledby="plan-billing-heading">
      <h2 id="plan-billing-heading" className="font-heading text-lg font-bold text-galaxy-text flex items-center gap-2">
        <CreditCard size={18} /> {t('school:teacher.billing.heading')}
      </h2>

      {notice && (
        <p role="status" className="text-sm font-body text-emerald-300">
          {t(`school:teacher.billing.${notice}`, { count: license?.pending_seats ?? undefined })}
        </p>
      )}
      {error && <p role="alert" className="text-sm font-body text-red-400">{teacherErrorText(t, error)}</p>}
      {!data && !error && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.billing.loading')}</p>}

      {data && (
        <>
          <StatusLine license={license} t={t} />
          {license && (
            <div className="text-sm font-body text-galaxy-text-muted space-y-1">
              <p>{t('school:teacher.billing.seats_used', { used: data.students, total: license.seats })}</p>
              {license.pending_seats != null && <p>{t('school:teacher.billing.pending_seats', { count: license.pending_seats })}</p>}
              {license.status !== 'trial' && license.image_allowance > 0 && (
                <p>{t('school:teacher.billing.pictures', { used: license.images_used, total: license.image_allowance })}</p>
              )}
              {data.plan && <p>{t('school:teacher.billing.school_plan', { school: data.plan.school_name })}</p>}
            </div>
          )}

          {data.offers?.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-heading font-semibold text-galaxy-text">{t('school:teacher.billing.offers.heading')}</h3>
              {data.offers.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-body text-galaxy-text">{t('school:teacher.billing.offers.line', { school: o.school_name, count: o.seats })}</p>
                  <button className={primary} disabled={!!busy} onClick={() => answerOffer(o.id, true)}>{t('school:teacher.billing.offers.accept')}</button>
                  <button className={secondary} disabled={!!busy} onClick={() => answerOffer(o.id, false)}>{t('school:teacher.billing.offers.decline')}</button>
                </div>
              ))}
            </div>
          )}

          {canBuy && (
            <div className="space-y-3 border-t border-galaxy-text-muted/10 pt-4">
              <h3 className="font-heading font-semibold text-galaxy-text">{t('school:teacher.billing.buy.heading')}</h3>
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.billing.buy.seats')}</span>
                <input type="number" inputMode="numeric" min={MIN_CLASS_SEATS} max={MAX_CLASS_SEATS} value={seats}
                  onChange={(e) => setSeats(e.target.value)} className={`${input} max-w-[8rem]`} />
                <span className="block text-xs font-body text-galaxy-text-muted">
                  {t('school:teacher.billing.buy.seats_hint', { min: MIN_CLASS_SEATS, max: MAX_CLASS_SEATS })}
                </span>
              </label>
              {quote.ok && (
                <div className="text-sm font-body text-galaxy-text">
                  <p>{t('school:teacher.billing.buy.price_line', { price: formatMoneyCents(quote.unit_cents) })}</p>
                  {isFoundingEligible() && <p className="text-galaxy-text-muted">{t('school:teacher.billing.buy.founding', { date: foundingDate() })}</p>}
                  <p className="font-semibold">{t('school:teacher.billing.buy.total', { total: formatMoneyCents(quote.total_cents) })}</p>
                </div>
              )}
              {!quote.ok && <p className="text-sm font-body text-amber-300">{teacherErrorText(t, quote.code)}</p>}
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.billing.buy.school_name')}</span>
                <input type="text" maxLength={120} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={input} />
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={dpa} onChange={(e) => setDpa(e.target.checked)} className="mt-1" />
                <span className="text-sm font-body text-galaxy-text">
                  {t('school:teacher.billing.buy.ndpa')}{' '}
                  <Link to={NDPA_PATH} target="_blank" className="underline text-galaxy-secondary">{t('school:teacher.billing.buy.ndpa_link')}</Link>
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className={primary} disabled={!quote.ok || !schoolName.trim() || !dpa || !!busy} onClick={buy}>
                  {t('school:teacher.billing.buy.pay')}
                </button>
                <span className="text-xs font-body text-galaxy-text-muted">
                  {t('school:teacher.billing.buy.school_plan_hint', { min: MIN_SCHOOL_SEATS })}{' '}
                  <Link to="/teacher/school" className="underline">{t('school:teacher.billing.buy.school_plan_link')}</Link>
                </span>
              </div>
            </div>
          )}

          {canChangeSeats && (
            <div className="space-y-2 border-t border-galaxy-text-muted/10 pt-4">
              <h3 className="font-heading font-semibold text-galaxy-text">{t('school:teacher.billing.seats.heading')}</h3>
              <p className="text-xs font-body text-galaxy-text-muted">{t('school:teacher.billing.seats.more_now')} {t('school:teacher.billing.seats.fewer_later')}</p>
              <div className="flex items-center gap-3">
                <input type="number" inputMode="numeric" min={Math.max(MIN_CLASS_SEATS, data.students)} max={MAX_CLASS_SEATS}
                  value={newSeats ?? license.pending_seats ?? license.seats} onChange={(e) => setNewSeats(e.target.value)}
                  className={`${input} max-w-[8rem]`} aria-label={t('school:teacher.billing.seats.heading')} />
                <button className={primary} disabled={newSeats == null || !!busy} onClick={changeSeats}>{t('school:teacher.billing.seats.save')}</button>
              </div>
            </div>
          )}

          {data.can_manage_billing && (
            <div className="space-y-3 border-t border-galaxy-text-muted/10 pt-4">
              <button className={secondary} disabled={!!busy} onClick={portal}>
                <ExternalLink size={14} /> {t('school:teacher.billing.manage')}
              </button>
              <div className="space-y-2">
                <h3 className="font-heading font-semibold text-galaxy-text flex items-center gap-2"><Receipt size={16} /> {t('school:teacher.billing.invoices.heading')}</h3>
                {invoices && invoices.length === 0 && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.billing.invoices.none')}</p>}
                {invoices?.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 text-sm font-body text-galaxy-text">
                    <span>{formatDate(i.created)}</span>
                    <span>{i.number}</span>
                    <span>{formatMoneyCents(i.status === 'paid' ? i.amount_paid : i.amount_due, (i.currency || 'usd').toUpperCase())}</span>
                    <span className="text-galaxy-text-muted">{t(`school:teacher.billing.invoices.status.${i.status}`, { defaultValue: i.status })}</span>
                    {i.hosted_invoice_url && (
                      <a href={i.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline">{t('school:teacher.billing.invoices.view')}</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
