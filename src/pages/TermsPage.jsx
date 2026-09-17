import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

// Reachable at /terms. The iOS paywall links here directly
// (ios-native/MyBookLab/Views/PaywallView.swift) because App Store
// Guideline 3.1.2 requires a functional Terms of Use link next to any
// auto-renewing subscription. Before this page existed that link resolved
// to the 404 page. Keep this route alive.
export default function TermsPage() {
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

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-6">Terms of Use</h1>

        <div className="space-y-6 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <p className="text-galaxy-text font-semibold">Last updated: September 17, 2026</p>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Acceptance of Terms</h2>
            <p>
              By using My Book Lab, you agree to these terms of use. An account is created and
              controlled by an adult — a parent, guardian, or teacher — who is responsible for the
              account and for any purchases made through it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">User Content</h2>
            <p>
              Users retain ownership of all stories, text, and creative content they produce. By
              submitting content to a classroom, users grant their teacher permission to view that
              content. Publishing a book to the public gallery is optional and off by default; a
              published book can be unpublished at any time.
              AI-generated illustrations are created for the user's personal and educational use.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              Auto-Renewing Subscriptions
            </h2>
            <p className="mb-2">
              My Book Lab offers auto-renewing subscriptions that unlock unlimited books,
              illustrations, and other paid features. Pricing and the length of each subscription
              period are shown in the app before you buy, in your local currency and inclusive of
              any applicable tax.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Payment is charged to your Apple&nbsp;ID account at confirmation of purchase when you
                subscribe on iPhone or iPad, or to your payment method via Stripe when you subscribe
                on the web.
              </li>
              <li>
                Your subscription renews automatically unless auto-renew is turned off at least 24
                hours before the end of the current period.
              </li>
              <li>
                Your account is charged for renewal within 24 hours prior to the end of the current
                period, at the price of the plan you selected.
              </li>
              <li>
                You can manage or cancel your subscription after purchase in your device's
                Settings&nbsp;&rarr;&nbsp;Apple&nbsp;ID&nbsp;&rarr;&nbsp;Subscriptions, or, for web
                subscriptions, from the billing portal linked in your account page.
              </li>
              <li>
                Cancelling stops the next renewal. Access continues until the end of the period you
                have already paid for.
              </li>
              <li>
                Any unused portion of a free trial, where offered, is forfeited when you purchase a
                subscription.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">
              Coins and One-Time Purchases
            </h2>
            <p>
              Coins are a virtual item used inside the app to unlock art styles and cosmetic items.
              Coins can be earned for free by using the app, or bought in packs. Coins do not expire,
              have no cash value outside the app, and cannot be transferred between accounts or
              redeemed for money.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Printed Books</h2>
            {/*
              The old wording here said orders "cannot be cancelled once printing has begun".
              That is wrong as a matter of law: the withdrawal exclusion for goods made to the
              consumer's specifications attaches at contract conclusion and does not depend on
              whether production has started (CJEU C-529/19, Möbel Kraft, 21 October 2020). Any
              production-milestone trigger is unsound, so the clause now relies on the
              personalisation exclusion itself and states the baseline it displaces.
            */}
            <p>
              Printed books are physical goods, printed and shipped by our print partner and paid
              for by card through Stripe. Prices shown at checkout include the book and shipping.
            </p>
            <p className="mt-2">
              For most goods bought at a distance you would have 14 days to change your mind. A
              printed book is made to your specifications and clearly personalised with your child's
              own story, illustrations, and name, so the right of withdrawal does not apply to it.
              You agree to this when you place the order, and we tell you again at checkout before
              you pay.
            </p>
            <p className="mt-2">
              This does not affect your statutory guarantee. If a book arrives damaged, defective,
              or not matching what you ordered, contact us and we will reprint or refund it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">AI-Generated Content</h2>
            <p>
              Illustrations and avatars are generated by AI and may occasionally contain
              imperfections. We do not guarantee the accuracy or quality of AI-generated images.
              Users can regenerate or remove any AI content they are not satisfied with. The Story
              Buddy assistant is designed to suggest ideas and ask questions rather than write
              stories on a child's behalf.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Prohibited Use</h2>
            <p>
              Users may not use the app to generate or publish inappropriate, harmful, or offensive
              content, to impersonate others, or to harass anyone. We reserve the right to remove
              content and suspend accounts that violate these terms. Report objectionable content in
              the app or by emailing{' '}
              <span className="text-galaxy-primary">support@mybooklab.app</span>; we review reports
              and act within 24 hours.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the app after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Contact</h2>
            <p>
              Questions about these terms? Contact us at{' '}
              <span className="text-galaxy-primary">support@mybooklab.app</span>. See also our{' '}
              <Link to="/privacy" className="text-galaxy-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
