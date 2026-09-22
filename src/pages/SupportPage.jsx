import { motion } from 'motion/react'
import { ArrowLeft, Mail, ExternalLink } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'

const APP_NAME = 'My Book Lab'
const SUPPORT_EMAIL = 'support@mybooklab.app'
const APPLE_REPORT_URL = 'https://reportaproblem.apple.com'
const APPLE_REPORT_LABEL = 'reportaproblem.apple.com'
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
const APPLE = 'Apple'

export default function SupportPage() {
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

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-3">{t('legal:support.title')}</h1>
        <p className="text-galaxy-text-muted font-body text-base mb-8">
          <Trans
            i18nKey="legal:support.intro"
            values={{ app: APP_NAME }}
            components={{ app: <span className="text-galaxy-text font-semibold" /> }}
          />
        </p>

        <div className="space-y-8 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.contact.title')}
            </h2>
            <p className="mb-3">{t('legal:support.contact.body')}</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm"
            >
              <Mail size={16} /> {SUPPORT_EMAIL}
            </a>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.subscription.title')}
            </h2>
            <p className="mb-2">{t('legal:support.subscription.intro')}</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <Trans
                  i18nKey="legal:support.subscription.step_settings"
                  components={{ ui: <span className="text-galaxy-text" /> }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="legal:support.subscription.step_subscriptions"
                  components={{ ui: <span className="text-galaxy-text" /> }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="legal:support.subscription.step_select_app"
                  values={{ app: APP_NAME }}
                  components={{ ui: <span className="text-galaxy-text" /> }}
                />
              </li>
            </ol>
            <p className="mt-2">
              <Trans
                i18nKey="legal:support.subscription.web"
                components={{ account: <Link to="/account" className="underline hover:text-galaxy-text" /> }}
              />
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.refund.title')}
            </h2>
            <p>{t('legal:support.refund.app_store', { apple: APPLE })}</p>
            <a
              href={APPLE_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 text-galaxy-text hover:text-galaxy-primary transition-colors underline"
            >
              {APPLE_REPORT_LABEL} <ExternalLink size={13} className="opacity-60" />
            </a>
            <p className="mt-2">{t('legal:support.refund.web', { email: SUPPORT_EMAIL })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.delete.title')}
            </h2>
            <p>{t('legal:support.delete.intro')}</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>
                <Trans
                  i18nKey="legal:support.delete.step_open_account"
                  components={{ account: <Link to="/account" className="underline hover:text-galaxy-text" /> }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="legal:support.delete.step_danger_zone"
                  components={{ ui: <span className="text-galaxy-text" /> }}
                />
              </li>
              <li>
                <Trans
                  i18nKey="legal:support.delete.step_confirm"
                  components={{ ui: <span className="text-galaxy-text" /> }}
                />
              </li>
            </ol>
            <p className="mt-2">{t('legal:support.delete.note', { apple: APPLE })}</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.password.title')}
            </h2>
            <p>
              <Trans
                i18nKey="legal:support.password.body"
                components={{ login: <Link to="/login" className="underline hover:text-galaxy-text" /> }}
              />
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              {t('legal:support.links.title')}
            </h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/privacy" className="underline hover:text-galaxy-text">
                {t('legal:privacy.title')}
              </Link>
              <a
                href={APPLE_EULA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-galaxy-text"
              >
                {t('legal:support.links.eula')}
              </a>
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
