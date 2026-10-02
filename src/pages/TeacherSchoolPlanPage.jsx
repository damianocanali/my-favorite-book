// The school plan (Stage 4, web only): one plan and one invoice for many
// classes, bought by a verified teacher who becomes the school admin.
// Buy (card or invoice), give seat blocks to their own classes, offer seats
// to a colleague's class by class code, change the plan's seats, manage
// payment, invoices. Prices are displayed from lib/school/pricing.js.
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink, School } from 'lucide-react'
import { schoolFetch } from '../lib/schoolApi'
import { teacherErrorText } from '../components/school/teacherErrors'
import TeacherVerificationNotice from '../components/school/TeacherVerificationNotice'
import { formatDate, formatMoneyCents } from '../i18n/formats'
import { quoteSchool, MIN_SCHOOL_SEATS, MAX_CLASS_SEATS } from '../../lib/school/pricing.js'
import { NDPA_PATH } from '../../lib/school/billingApi.js'

const input = 'px-3 py-2 rounded-xl bg-galaxy-bg/60 border border-galaxy-text-muted/20 text-galaxy-text font-body text-sm focus:outline-none focus:border-galaxy-primary'
const primary = 'px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-50'
const secondary = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-body text-sm text-galaxy-text border border-galaxy-text-muted/20 hover:border-galaxy-text-muted/40 transition-colors disabled:opacity-50'
const card = 'glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4'

export default function TeacherSchoolPlanPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [plans, setPlans] = useState(null)
  const [classes, setClasses] = useState([])
  const [verified, setVerified] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(() => (searchParams.get('billing') === 'success' ? 'school:teacher.billing.success' : searchParams.get('billing') === 'canceled' ? 'school:teacher.billing.canceled_checkout' : null))
  const [busy, setBusy] = useState(false)
  const [invoices, setInvoices] = useState(null)

  // Buy form
  const [seats, setSeats] = useState(MIN_SCHOOL_SEATS)
  const [billing, setBilling] = useState('invoice')
  const [schoolName, setSchoolName] = useState('')
  const [dpa, setDpa] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  // Admin forms
  const [assignClass, setAssignClass] = useState('')
  const [assignSeats, setAssignSeats] = useState(25)
  const [offerCode, setOfferCode] = useState('')
  const [offerSeats, setOfferSeats] = useState(25)
  const [planSeats, setPlanSeats] = useState(null)

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([schoolFetch('/api/school/plan'), schoolFetch('/api/school/classes')])
    if (!p.ok) { setError(p.code || 'generic'); return }
    setPlans(p.data?.plans ?? [])
    if (c.ok) {
      setClasses(c.data?.classes ?? [])
      if (c.data?.verification) setVerified(!!c.data.verification.verified)
    }
    const live = (p.data?.plans ?? []).find((x) => ['pending_payment', 'active', 'grace'].includes(x.status))
    if (live) {
      const inv = await schoolFetch(`/api/school/plan?planId=${live.id}&invoices=1`)
      if (inv.ok) setInvoices(inv.data?.invoices ?? [])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const plan = plans?.find((x) => ['pending_payment', 'active', 'grace'].includes(x.status)) ?? null
  const quote = quoteSchool(Number(seats))

  async function act(body, after) {
    setBusy(true)
    setError(null)
    const res = await schoolFetch('/api/school/plan', { method: 'POST', body: JSON.stringify({ planId: plan?.id, ...body }) })
    setBusy(false)
    if (!res.ok) { setError(res.code || 'generic'); return null }
    if (after) setNotice(after)
    await load()
    return res.data
  }

  async function buy() {
    setBusy(true)
    setError(null)
    const res = await schoolFetch('/api/school/checkout', {
      method: 'POST',
      body: JSON.stringify({ kind: 'school', seats: Number(seats), billing, school_name: schoolName.trim(), dpa_accept: dpa, request_id: requestId }),
    })
    setBusy(false)
    if (!res.ok) { setError(res.code || 'generic'); return }
    if (res.data?.url) { window.location.assign(res.data.url); return }
    setNotice('school:teacher.school_plan.invoice_sent')
    await load()
  }

  async function portal() {
    const out = await act({ action: 'portal' })
    if (out?.url) window.location.assign(out.url)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <Link to="/teacher/classes" className="inline-flex items-center gap-1 text-galaxy-text-muted hover:text-galaxy-text text-sm font-body">
        <ArrowLeft size={14} /> {t('school:teacher.title')}
      </Link>
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-galaxy-text flex items-center gap-2"><School size={26} /> {t('school:teacher.school_plan.title')}</h1>
        <p className="font-body text-galaxy-text-muted">{t('school:teacher.school_plan.subtitle')}</p>
      </header>

      {!verified && <TeacherVerificationNotice onVerified={() => setVerified(true)} />}
      {notice && <p role="status" className="text-sm font-body text-emerald-300">{t(notice)}</p>}
      {error && <p role="alert" className="text-sm font-body text-red-400">{teacherErrorText(t, error)}</p>}
      {plans === null && !error && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.school_plan.loading')}</p>}

      {plans && !plan && verified && (
        <section className={card} aria-labelledby="buy-plan">
          <h2 id="buy-plan" className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.school_plan.buy.heading')}</h2>
          <label className="block space-y-1">
            <span className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.buy.seats')}</span>
            <input type="number" inputMode="numeric" min={MIN_SCHOOL_SEATS} value={seats} onChange={(e) => setSeats(e.target.value)} className={`${input} max-w-[10rem] block`} />
            <span className="block text-xs font-body text-galaxy-text-muted">{t('school:teacher.school_plan.buy.seats_hint', { min: MIN_SCHOOL_SEATS })}</span>
          </label>
          {quote.ok ? (
            <div className="text-sm font-body text-galaxy-text">
              <p>{t('school:teacher.billing.buy.price_line', { price: formatMoneyCents(quote.unit_cents) })}</p>
              <p className="font-semibold">{t('school:teacher.billing.buy.total', { total: formatMoneyCents(quote.total_cents) })}</p>
            </div>
          ) : <p className="text-sm font-body text-amber-300">{teacherErrorText(t, quote.code)}</p>}
          <fieldset className="space-y-1">
            <legend className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.buy.billing')}</legend>
            {['invoice', 'card'].map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm font-body text-galaxy-text">
                <input type="radio" name="billing" value={b} checked={billing === b} onChange={() => setBilling(b)} />
                {t(`school:teacher.school_plan.buy.${b}`)}
              </label>
            ))}
            {billing === 'invoice' && <p className="text-xs font-body text-galaxy-text-muted">{t('school:teacher.school_plan.buy.invoice_note')}</p>}
          </fieldset>
          <label className="block space-y-1">
            <span className="text-sm font-body text-galaxy-text">{t('school:teacher.billing.buy.school_name')}</span>
            <input type="text" maxLength={120} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={`${input} w-full`} />
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={dpa} onChange={(e) => setDpa(e.target.checked)} className="mt-1" />
            <span className="text-sm font-body text-galaxy-text">
              {t('school:teacher.billing.buy.ndpa')}{' '}
              <Link to={NDPA_PATH} target="_blank" className="underline text-galaxy-secondary">{t('school:teacher.billing.buy.ndpa_link')}</Link>
            </span>
          </label>
          <button className={primary} disabled={busy || !quote.ok || !schoolName.trim() || !dpa} onClick={buy}>
            {billing === 'invoice' ? t('school:teacher.school_plan.buy.send_invoice') : t('school:teacher.school_plan.buy.pay')}
          </button>
        </section>
      )}

      {plan && (
        <>
          <section className={card}>
            <h2 className="font-heading text-lg font-bold text-galaxy-text">{plan.school_name}</h2>
            <p className="font-body font-semibold text-galaxy-text">{t(`school:teacher.billing.status.${plan.status}`)}</p>
            <p className="text-sm font-body text-galaxy-text-muted">
              {plan.status === 'pending_payment'
                ? t('school:teacher.billing.due', { date: formatDate(plan.expires_at, 'long') })
                : plan.cancel_at_period_end
                  ? t('school:teacher.billing.cancel_at_end', { date: formatDate(plan.expires_at, 'long') })
                  : t('school:teacher.billing.renews', { date: formatDate(plan.expires_at, 'long') })}
            </p>
            <p className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.seats_given', { used: plan.used, total: plan.seats })}</p>
            {plan.pending_seats != null && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.billing.pending_seats', { count: plan.pending_seats })}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <input type="number" inputMode="numeric" min={Math.max(MIN_SCHOOL_SEATS, plan.used)} value={planSeats ?? plan.pending_seats ?? plan.seats}
                onChange={(e) => setPlanSeats(e.target.value)} className={`${input} max-w-[8rem]`} aria-label={t('school:teacher.school_plan.change_seats')} />
              <button className={primary} disabled={busy || planSeats == null} onClick={() => act({ action: 'seats', seats: Number(planSeats) }).then(() => setPlanSeats(null))}>
                {t('school:teacher.school_plan.change_seats')}
              </button>
              <button className={secondary} disabled={busy} onClick={portal}><ExternalLink size={14} /> {t('school:teacher.billing.manage')}</button>
            </div>
            <p className="text-xs font-body text-galaxy-text-muted">{t('school:teacher.school_plan.change_hint')}</p>
          </section>

          <section className={card}>
            <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.school_plan.blocks.heading')}</h2>
            {plan.blocks.length === 0 && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.school_plan.blocks.none')}</p>}
            <ul className="space-y-1">
              {plan.blocks.map((b, i) => (
                <li key={b.classroom_id ?? `colleague-${i}`} className="text-sm font-body text-galaxy-text">
                  {b.mine ? b.class_name : t('school:teacher.school_plan.blocks.colleague')} · {t('school:teacher.school_plan.blocks.seats', { count: b.seats })}
                </li>
              ))}
            </ul>

            <h3 className="font-heading font-semibold text-galaxy-text pt-2">{t('school:teacher.school_plan.assign.heading')}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.assign.class')}</span>
                <select value={assignClass} onChange={(e) => setAssignClass(e.target.value)} className={input}>
                  <option value="">—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.assign.seats')}</span>
                <input type="number" min={1} max={MAX_CLASS_SEATS} value={assignSeats} onChange={(e) => setAssignSeats(e.target.value)} className={`${input} max-w-[6rem]`} />
              </label>
              <button className={primary} disabled={busy || !assignClass} onClick={() => act({ action: 'assign', classId: assignClass, seats: Number(assignSeats) }, 'school:teacher.school_plan.assign.done')}>
                {t('school:teacher.school_plan.assign.button')}
              </button>
            </div>

            <h3 className="font-heading font-semibold text-galaxy-text pt-2">{t('school:teacher.school_plan.offer.heading')}</h3>
            <p className="text-xs font-body text-galaxy-text-muted">{t('school:teacher.school_plan.offer.hint')}</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.offer.code')}</span>
                <input type="text" maxLength={12} value={offerCode} onChange={(e) => setOfferCode(e.target.value.toUpperCase())} className={`${input} max-w-[9rem] uppercase`} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-body text-galaxy-text">{t('school:teacher.school_plan.offer.seats')}</span>
                <input type="number" min={1} max={MAX_CLASS_SEATS} value={offerSeats} onChange={(e) => setOfferSeats(e.target.value)} className={`${input} max-w-[6rem]`} />
              </label>
              <button className={primary} disabled={busy || !offerCode.trim()} onClick={() => act({ action: 'offer', code: offerCode.trim(), seats: Number(offerSeats) }, 'school:teacher.school_plan.offer.sent').then((d) => d && setOfferCode(''))}>
                {t('school:teacher.school_plan.offer.button')}
              </button>
            </div>
            {plan.offers?.map((o) => (
              <div key={o.id} className="flex items-center gap-3 text-sm font-body text-galaxy-text">
                <span>{t('school:teacher.school_plan.offer.pending', { count: o.seats })}</span>
                <button className={secondary} disabled={busy} onClick={() => act({ action: 'cancel_offer', offerId: o.id })}>{t('school:teacher.school_plan.offer.withdraw')}</button>
              </div>
            ))}
          </section>

          <section className={card}>
            <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.billing.invoices.heading')}</h2>
            {invoices && invoices.length === 0 && <p className="text-sm font-body text-galaxy-text-muted">{t('school:teacher.billing.invoices.none')}</p>}
            {invoices?.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 text-sm font-body text-galaxy-text">
                <span>{formatDate(i.created)}</span>
                <span>{i.number}</span>
                <span>{formatMoneyCents(i.status === 'paid' ? i.amount_paid : i.amount_due, (i.currency || 'usd').toUpperCase())}</span>
                <span className="text-galaxy-text-muted">{t(`school:teacher.billing.invoices.status.${i.status}`, { defaultValue: i.status })}</span>
                {i.hosted_invoice_url && <a href={i.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline">{t('school:teacher.billing.invoices.view')}</a>}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
