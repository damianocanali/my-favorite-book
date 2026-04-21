import { motion } from 'motion/react'
import { ArrowLeft, Mail, ExternalLink } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

const SUPPORT_EMAIL = 'support@mybooklab.app'
const APPLE_REPORT_URL = 'https://reportaproblem.apple.com'

export default function SupportPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm mb-6"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-3">Support</h1>
        <p className="text-galaxy-text-muted font-body text-base mb-8">
          Need help with <span className="text-galaxy-text font-semibold">My Book Lab</span>? Here's how to reach us and handle common questions.
        </p>

        <div className="space-y-8 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Contact us</h2>
            <p className="mb-3">
              Email us and we'll get back to you within two business days.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm"
            >
              <Mail size={16} /> {SUPPORT_EMAIL}
            </a>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Manage or cancel a subscription</h2>
            <p className="mb-2">
              Subscriptions purchased on iPhone or iPad are managed through your Apple ID. To cancel or change plan:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open <span className="text-galaxy-text">Settings</span> on your device</li>
              <li>Tap your name at the top, then <span className="text-galaxy-text">Subscriptions</span></li>
              <li>Select <span className="text-galaxy-text">My Book Lab</span> and choose Cancel or Change</li>
            </ol>
            <p className="mt-2">
              Subscriptions purchased on the web can be managed from your <Link to="/account" className="underline hover:text-galaxy-text">Account page</Link> via the "Manage subscription" button.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Request a refund</h2>
            <p>
              For purchases made through the App Store (iPhone / iPad), refunds are handled directly by Apple:
            </p>
            <a
              href={APPLE_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 text-galaxy-text hover:text-galaxy-primary transition-colors underline"
            >
              reportaproblem.apple.com <ExternalLink size={13} className="opacity-60" />
            </a>
            <p className="mt-2">
              For web purchases, contact us at {SUPPORT_EMAIL} and we'll work with you directly.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Delete your account</h2>
            <p>
              You can permanently delete your account and all associated data (books, subscriptions, profile) from inside the app:
            </p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>Sign in and open the <Link to="/account" className="underline hover:text-galaxy-text">Account page</Link></li>
              <li>Scroll to the <span className="text-galaxy-text">Danger Zone</span> section</li>
              <li>Tap <span className="text-galaxy-text">Delete my account</span> and confirm</li>
            </ol>
            <p className="mt-2">
              Deletion is immediate and cannot be reversed. Active App Store subscriptions must be cancelled separately via Settings → Subscriptions (deleting the account does not refund Apple charges).
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Forgot your password</h2>
            <p>
              On the <Link to="/login" className="underline hover:text-galaxy-text">login screen</Link>, tap "Forgot password" and follow the link we email you.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Privacy & Terms</h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/privacy" className="underline hover:text-galaxy-text">Privacy Policy</Link>
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-galaxy-text"
              >
                Terms of Use (EULA)
              </a>
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
