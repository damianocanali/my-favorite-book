import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { formatDate } from '../i18n/formats'

// Never translated — interpolated so no locale can rename the brand, the
// domain, the payment processor or the support address.
const APP_NAME = 'My Book Lab'
const SITE_DOMAIN = 'mybooklab.app'
const SUPPORT_EMAIL = 'support@mybooklab.app'
const STRIPE = 'Stripe'

const LAST_UPDATED = '2026-09-01'

// Reachable at /terms. The iOS paywall links here directly
// (ios-native/MyBookLab/Views/PaywallView.swift) because App Store
// Guideline 3.1.2 requires a functional Terms of Use link next to any
// auto-renewing subscription. Keep this route alive.
export default function TermsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm mb-6"
        >
          <ArrowLeft size={16} /> {t('common:actions.back')}
        </button>

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-6">{t('legal:terms.title')}</h1>

        <div className="space-y-6 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <p className="text-galaxy-text font-semibold">
            {t('legal:meta.last_updated', { date: formatDate(LAST_UPDATED, 'long') })}
          </p>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.acceptance.title')}
            </h2>
            <p>{t('legal:terms.acceptance.body', { app: APP_NAME })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.user_content.title')}
            </h2>
            <p>{t('legal:terms.user_content.body', { domain: SITE_DOMAIN })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.subscriptions.title')}
            </h2>
            <p className="mb-2">{t('legal:terms.subscriptions.intro', { app: APP_NAME })}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal:terms.subscriptions.item_charge', { stripe: STRIPE })}</li>
              <li>{t('legal:terms.subscriptions.item_renewal')}</li>
              <li>{t('legal:terms.subscriptions.item_renewal_charge')}</li>
              <li>{t('legal:terms.subscriptions.item_manage')}</li>
              <li>{t('legal:terms.subscriptions.item_cancel')}</li>
              <li>{t('legal:terms.subscriptions.item_trial')}</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.coins.title')}
            </h2>
            <p>{t('legal:terms.coins.body')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.printed.title')}
            </h2>
            <p>{t('legal:terms.printed.body', { stripe: STRIPE })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.ai_content.title')}
            </h2>
            <p>{t('legal:terms.ai_content.body')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.prohibited.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:terms.prohibited.body"
                values={{ email: SUPPORT_EMAIL }}
                components={{ email: <span className="text-galaxy-primary" /> }}
              />
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.changes.title')}
            </h2>
            <p>{t('legal:terms.changes.body')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:terms.contact.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:terms.contact.body"
                values={{ email: SUPPORT_EMAIL }}
                components={{
                  email: <span className="text-galaxy-primary" />,
                  privacy: <Link to="/privacy" className="text-galaxy-primary underline" />,
                }}
              />
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
