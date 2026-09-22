import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { formatDate } from '../i18n/formats'

// Never translated: the brand, the domain, the contact address and every
// vendor name are interpolated into the prose rather than living inside a
// translatable string, so no locale can rename a legal counterparty.
const APP_NAME = 'My Book Lab'
const SITE_DOMAIN = 'mybooklab.app'
const PRIVACY_EMAIL = 'privacy@mybooklab.app'
const VENDORS = {
  supabase: 'Supabase',
  together: 'Together AI',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  stripe: 'Stripe',
  revenuecat: 'RevenueCat',
  apple: 'Apple',
  lulu: 'Lulu',
}

// ISO so the rendered date follows the locale ("September 1, 2026" /
// "1 settembre 2026") instead of being frozen in English.
const LAST_UPDATED = '2026-09-01'

export default function PrivacyPage() {
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

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-6">{t('legal:privacy.title')}</h1>

        <div className="space-y-6 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <p className="text-galaxy-text font-semibold">
            {t('legal:meta.last_updated', { date: formatDate(LAST_UPDATED, 'long') })}
          </p>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.commitment.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:privacy.commitment.body"
                values={{ app: APP_NAME, email: PRIVACY_EMAIL }}
                components={{ email: <span className="text-galaxy-primary" /> }}
              />
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.collect.title')}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <Trans i18nKey="legal:privacy.collect.item_account" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_author" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_story" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_photos" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_ai_text" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans
                  i18nKey="legal:privacy.collect.item_payment"
                  values={{ apple: VENDORS.apple, stripe: VENDORS.stripe }}
                  components={{ b: <strong /> }}
                />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_shipping" components={{ b: <strong /> }} />
              </li>
              <li>
                <Trans i18nKey="legal:privacy.collect.item_usage" components={{ b: <strong /> }} />
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.use.title')}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('legal:privacy.use.item_provide')}</li>
              <li>{t('legal:privacy.use.item_generate')}</li>
              <li>{t('legal:privacy.use.item_moderate')}</li>
              <li>{t('legal:privacy.use.item_classroom')}</li>
              <li>{t('legal:privacy.use.item_payments')}</li>
              <li>{t('legal:privacy.use.item_limits')}</li>
            </ul>
            <p className="mt-2">{t('legal:privacy.use.no_sale')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.gallery.title')}
            </h2>
            <p>{t('legal:privacy.gallery.body', { domain: SITE_DOMAIN })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.storage.title')}
            </h2>
            <p>{t('legal:privacy.storage.body', { supabase: VENDORS.supabase })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.third_parties.title')}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>{VENDORS.supabase}:</strong> {t('legal:privacy.third_parties.desc_supabase')}
              </li>
              <li>
                <strong>{VENDORS.together}:</strong> {t('legal:privacy.third_parties.desc_together')}
              </li>
              <li>
                <strong>{VENDORS.anthropic}:</strong> {t('legal:privacy.third_parties.desc_anthropic')}
              </li>
              <li>
                <strong>{VENDORS.openai}:</strong> {t('legal:privacy.third_parties.desc_openai')}
              </li>
              <li>
                <strong>{VENDORS.stripe}:</strong> {t('legal:privacy.third_parties.desc_stripe')}
              </li>
              <li>
                <strong>
                  {VENDORS.revenuecat} &amp; {VENDORS.apple}:
                </strong>{' '}
                {t('legal:privacy.third_parties.desc_apple_iap')}
              </li>
              <li>
                <strong>{VENDORS.lulu}:</strong> {t('legal:privacy.third_parties.desc_lulu')}
              </li>
            </ul>
            <p className="mt-2">{t('legal:privacy.third_parties.no_trackers')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.parental_controls.title')}
            </h2>
            <p>{t('legal:privacy.parental_controls.body')}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.deletion.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:privacy.deletion.body"
                values={{ email: PRIVACY_EMAIL }}
                components={{ email: <span className="text-galaxy-primary" /> }}
              />
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:privacy.contact.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:privacy.contact.body"
                values={{ email: PRIVACY_EMAIL }}
                components={{
                  email: <span className="text-galaxy-primary" />,
                  terms: <Link to="/terms" className="text-galaxy-primary underline" />,
                }}
              />
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
