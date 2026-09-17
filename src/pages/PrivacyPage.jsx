import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

export default function PrivacyPage() {
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

        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-6">Privacy Policy</h1>

        <div className="space-y-6 text-galaxy-text-muted font-body text-sm leading-relaxed">
          <p className="text-galaxy-text font-semibold">Last updated: September 17, 2026</p>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Our Commitment to Children's Privacy</h2>
            {/*
              This used to state a parental-consent threshold of "under 13". That is the COPPA
              figure and has no basis in EU or Italian law — Italy sets the age of digital consent
              at 14 (art. 2-quinquies D.Lgs. 196/2003). But quoting an age at all was the wrong
              frame: GDPR Art. 8 engages only where consent is the lawful basis AND the service is
              offered directly to a child, and here an adult holds the account while the core
              service rests on contract. So this describes how the account actually works, and
              names the two operations that genuinely do rest on consent.
            */}
            <p>
              My Book Lab ("we", "our", "us") is designed for children and families. An account is
              created and controlled by an adult — a parent, guardian, or teacher — who provides the
              child's details, is responsible for the account, and authorises any purchase. A child
              does not create their own account.
            </p>
            <p className="mt-2">
              Most of what we do with this information is what we need in order to provide the
              service you asked for: making and storing the book, printing and shipping it, and
              running your subscription. Two things are different, and we ask for them separately
              because the app works fully without either: publishing a book to the public gallery,
              and turning a photo into a cartoon. You can withdraw that permission at any time.
            </p>
            <p className="mt-2">
              If you believe a child's personal information reached us without an adult's
              involvement, contact us at{' '}
              <span className="text-galaxy-primary">privacy@mybooklab.app</span> and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account information:</strong> the email address and display name given at
                registration. Teachers also provide a role designation.
              </li>
              <li>
                <strong>Author details:</strong> the first name and age a child enters when creating
                a book. These are stored with the book and shown on the book itself.
              </li>
              <li>
                <strong>Story content:</strong> stories, page text, illustrations, and book covers
                are saved to your account on our servers so they are available on every device you
                sign in on. They are private to your account unless you choose to publish a book to
                the public gallery.
              </li>
              <li>
                <strong>Photos:</strong> if you use the "create your hero" feature, the photo you
                choose is sent to our AI provider to be transformed into a cartoon. We do not store
                the original photo — only the cartoon result is saved to your account. No facial
                recognition is performed and no biometric template is created.
              </li>
              <li>
                <strong>Story text sent for AI help:</strong> when a child asks the Story Buddy for
                help, the story text and the question are sent to our AI provider to produce a reply.
                Prompts and story text are also sent to a moderation service to screen for unsafe
                content.
              </li>
              <li>
                <strong>Payment information:</strong> subscriptions and coin packs bought on iPhone
                or iPad are processed by Apple; web subscriptions and printed-book orders are
                processed by Stripe. We never see, store, or have access to card numbers.
              </li>
              <li>
                <strong>Shipping information:</strong> when you order a printed book, the recipient
                name, postal address, email, and phone number you enter are sent to our print partner
                so the book can be printed and delivered.
              </li>
              <li>
                <strong>Usage data:</strong> we record counts of AI generations per account to
                enforce fair usage limits and prevent abuse. We do not use advertising or analytics
                trackers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">How We Use Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide the app and keep your books available across your devices</li>
              <li>To generate illustrations, covers, and avatars you ask for</li>
              <li>To screen content for safety before it is generated or published</li>
              <li>To enable classroom features for teachers and students</li>
              <li>To process payments and deliver printed books</li>
              <li>To enforce usage limits and protect against abuse of paid AI features</li>
            </ul>
            <p className="mt-2">
              We do not sell personal information, and we do not use it for behavioural advertising.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Publishing to the Gallery</h2>
            <p>
              Publishing a book is optional and off by default. If you publish one, its title,
              illustrations, story text, and the author's first name and age become publicly readable
              in the app and on mybooklab.app, to people who are not signed in. Never include a full
              name, school, address, or other identifying detail in a book you publish. You can
              unpublish a book at any time, and you can report any published book you find
              inappropriate.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Data Storage &amp; Security</h2>
            <p>
              Accounts, books, orders, and progress are stored in our database, hosted by Supabase,
              and protected by row-level security policies so one account cannot read another's data.
              All data is transmitted over encrypted HTTPS connections. Sign-in credentials on iPhone
              and iPad are held in the device Keychain.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase:</strong> authentication, database, and file storage</li>
              <li><strong>Together AI:</strong> generates illustrations, covers, and cartoon avatars. Receives the illustration prompt, and — for the "create your hero" feature — the photo you supply.</li>
              <li><strong>Anthropic:</strong> powers the Story Buddy assistant. Receives the story text and the child's question.</li>
              <li><strong>OpenAI:</strong> content moderation only. Receives prompts and story text to screen them for unsafe content.</li>
              <li><strong>Stripe:</strong> payment processing for web subscriptions and printed books</li>
              <li><strong>RevenueCat &amp; Apple:</strong> manage subscriptions and coin purchases made in the iOS app</li>
              <li><strong>Lulu:</strong> our print partner. Receives the book file and the shipping details for printed orders.</li>
            </ul>
            <p className="mt-2">
              Several of these providers are based outside the European Economic Area, including in
              the United States. Where that is the case we rely on the safeguards permitted under
              data protection law; you can ask us for details of the safeguards that apply to a
              particular provider.
            </p>
            <p className="mt-2">We do not use advertising networks or analytics trackers, and we do not sell data to third parties.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Parental Controls</h2>
            <p>
              A parental verification step — a maths problem young children cannot solve — appears
              before the camera and photo library are used, and before any purchase. Parents control
              the account, and can review, unpublish, or delete their child's books at any time.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Data Deletion</h2>
            <p>
              You can delete your account and all associated data from inside the app, on the Account
              screen, on both the web and iOS. Deletion removes your books, orders, progress, and
              account record. You can also email{' '}
              <span className="text-galaxy-primary">privacy@mybooklab.app</span> and we will delete
              your data on request.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Contact Us</h2>
            <p>
              If you have questions about this privacy policy or wish to exercise your data rights,
              please contact us at{' '}
              <span className="text-galaxy-primary">privacy@mybooklab.app</span>. Our{' '}
              <Link to="/terms" className="text-galaxy-primary underline">
                Terms of Use
              </Link>{' '}
              cover subscriptions, purchases, and printed books.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
