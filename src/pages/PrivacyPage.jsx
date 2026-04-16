import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
          <p className="text-galaxy-text font-semibold">Last updated: April 1, 2026</p>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Our Commitment to Children's Privacy</h2>
            <p>
              My Book Lab ("we", "our", "us") is designed for children and families. We take children's
              privacy extremely seriously and comply with the Children's Online Privacy Protection Act (COPPA)
              and applicable data protection laws. We do not knowingly collect personal information from children
              under 13 without verifiable parental consent.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> Email address and display name provided during registration. Teachers also provide a role designation.</li>
              <li><strong>Story content:</strong> Stories, illustrations, and books created within the app are stored locally on the device and optionally synced to our servers when submitted to a classroom.</li>
              <li><strong>Voice data:</strong> When using voice input, audio is processed by your device's built-in speech recognition. We do not record, store, or transmit audio data.</li>
              <li><strong>AI-generated images:</strong> Text prompts are sent to our image generation service to create illustrations and avatars. No personal information is included in these prompts.</li>
              <li><strong>Payment information:</strong> Payments are processed entirely by Stripe. We never see, store, or have access to credit card numbers or payment details.</li>
              <li><strong>Usage data:</strong> We collect anonymous usage statistics (pages created, features used) to improve the app. This data cannot be used to identify individual users.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">How We Use Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the app's functionality</li>
              <li>To enable classroom features for teachers and students</li>
              <li>To process subscription payments through Stripe</li>
              <li>To generate AI illustrations and avatars based on user selections</li>
              <li>To improve and optimize the app experience</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Data Storage & Security</h2>
            <p>
              Books and stories are primarily stored on the user's device using local storage. Classroom submissions
              are stored securely in our database (powered by Supabase) with row-level security policies.
              All data is transmitted over encrypted HTTPS connections.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase:</strong> Authentication and database services</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>Together AI:</strong> AI image generation (no personal data is shared)</li>
            </ul>
            <p className="mt-2">We do not use advertising networks, analytics trackers, or sell data to third parties.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Parental Controls</h2>
            <p>
              All purchases within the app are gated behind a parental verification step (a math problem
              that young children cannot solve). Parents can manage their child's account, delete data,
              or cancel subscriptions at any time.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Data Deletion</h2>
            <p>
              Users can delete their account and all associated data at any time by contacting us.
              Local device data can be cleared by uninstalling the app or clearing browser storage.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Contact Us</h2>
            <p>
              If you have questions about this privacy policy or wish to exercise your data rights, please
              contact us at <span className="text-galaxy-primary">privacy@mybooklab.app</span>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-galaxy-text-muted/20">
          <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-6">Terms of Service</h1>

          <div className="space-y-6 text-galaxy-text-muted font-body text-sm leading-relaxed">
            <section>
              <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Acceptance of Terms</h2>
              <p>
                By using My Book Lab, you agree to these terms of service. If you are a parent or
                guardian, you are responsible for your child's use of the app.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">User Content</h2>
              <p>
                Users retain ownership of all stories, text, and creative content they produce. By submitting
                content to a classroom, users grant their teacher permission to view that content.
                AI-generated illustrations are created for the user's personal and educational use.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Subscriptions & Payments</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Free accounts have limited features as described on our pricing page</li>
                <li>Paid subscriptions are billed monthly or annually through Stripe</li>
                <li>You may cancel your subscription at any time; access continues until the end of the billing period</li>
                <li>Refunds are handled in accordance with Stripe's and the applicable app store's policies</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">AI-Generated Content</h2>
              <p>
                Illustrations and avatars are generated by AI and may occasionally contain imperfections.
                We do not guarantee the accuracy or quality of AI-generated images. Users can regenerate
                or remove any AI content they are not satisfied with.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-galaxy-text mb-2">Prohibited Use</h2>
              <p>
                Users may not use the app to generate inappropriate, harmful, or offensive content.
                We reserve the right to suspend accounts that violate these terms.
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
                Questions about these terms? Contact us at <span className="text-galaxy-primary">support@mybooklab.app</span>
              </p>
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
