// Public pricing page for schools (Stage 4, web only, EN/IT). Every price
// and number on it comes from lib/school/pricing.js — the same values the
// server charges — so the page can't drift (tests/school-pricing-page.test.js).
// The #ndpa section is the page the purchase forms link to.
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, School } from 'lucide-react'
import { formatDate, formatMoneyCents } from '../i18n/formats'
import {
  SEAT_PRICE_CENTS, MIN_CLASS_SEATS, MAX_CLASS_SEATS, MIN_SCHOOL_SEATS, FOUNDING_LAST_DAY, IMAGES_PER_SEAT, isFoundingEligible,
} from '../../lib/school/pricing.js'

function PriceCard({ name, cents, detail, highlight }) {
  const { t } = useTranslation()
  return (
    <div className={`glass rounded-2xl p-6 border ${highlight ? 'border-galaxy-secondary/50' : 'border-galaxy-text-muted/10'} flex flex-col gap-2`}>
      <h2 className="font-heading text-xl font-bold text-galaxy-text">{name}</h2>
      <p className="font-heading text-4xl font-bold text-galaxy-text">{formatMoneyCents(cents)}</p>
      <p className="text-sm font-body text-galaxy-text-muted">{t('pricing:schools.per_student')}</p>
      <p className="text-sm font-body text-galaxy-text">{detail}</p>
    </div>
  )
}

export default function SchoolsPricingPage() {
  const { t } = useTranslation()
  const date = formatDate(`${FOUNDING_LAST_DAY}T12:00:00Z`, 'long')
  const founding = isFoundingEligible()
  const included = [
    t('pricing:schools.included.book'),
    t('pricing:schools.included.pdf'),
    t('pricing:schools.included.pictures', { count: IMAGES_PER_SEAT }),
    t('pricing:schools.included.features'),
  ]
  const faq = ['ndpa', 'invoice', 'trial', 'renew', 'ipad']

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <header className="text-center space-y-3">
        <School size={40} className="mx-auto text-galaxy-secondary" />
        <h1 className="font-heading text-4xl font-bold text-galaxy-text">{t('pricing:schools.title')}</h1>
        <p className="font-body text-lg text-galaxy-text-muted">{t('pricing:schools.subtitle')}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <PriceCard name={t('pricing:schools.class.name')} cents={SEAT_PRICE_CENTS.standard}
          detail={t('pricing:schools.class.detail', { min: MIN_CLASS_SEATS, max: MAX_CLASS_SEATS })} />
        {founding && (
          <PriceCard name={t('pricing:schools.founding.name')} cents={SEAT_PRICE_CENTS.founding} highlight
            detail={t('pricing:schools.founding.detail', { date })} />
        )}
        <PriceCard name={t('pricing:schools.school.name')} cents={SEAT_PRICE_CENTS.school}
          detail={t('pricing:schools.school.detail', { min: MIN_SCHOOL_SEATS })} />
      </div>

      <section className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-3">
        <h2 className="font-heading text-2xl font-bold text-galaxy-text flex items-center gap-2"><BookOpen size={22} /> {t('pricing:schools.included.heading')}</h2>
        <ul className="space-y-2">
          {included.map((line) => (
            <li key={line} className="flex items-start gap-2 font-body text-galaxy-text"><Check size={18} className="mt-0.5 text-emerald-300 shrink-0" /> {line}</li>
          ))}
        </ul>
        <p className="text-sm font-body text-galaxy-text-muted">{t('pricing:schools.trial')}</p>
        <Link to="/teacher/classes" className="inline-block px-5 py-3 rounded-xl font-body font-bold text-white btn-fill-primary">{t('pricing:schools.cta')}</Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-galaxy-text">{t('pricing:schools.faq.heading')}</h2>
        {faq.map((k) => (
          <div key={k} id={k === 'ndpa' ? 'ndpa' : undefined} className="glass rounded-2xl p-5 border border-galaxy-text-muted/10 scroll-mt-24">
            <h3 className="font-heading font-semibold text-galaxy-text">{t(`pricing:schools.faq.${k}_q`)}</h3>
            <p className="mt-1 font-body text-galaxy-text-muted">{t(`pricing:schools.faq.${k}_a`)}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
