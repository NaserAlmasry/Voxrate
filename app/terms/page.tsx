import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Voxrate',
  description: 'Terms of Service for Voxrate.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-neutral-400 hover:text-black transition-colors mb-10 inline-block">← Back to Voxrate</Link>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-12">Last updated: May 12, 2026</p>
        <div className="space-y-10 text-sm text-neutral-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Voxrate ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">2. Description of Service</h2>
            <p>Voxrate is an AI-powered review analysis platform for Amazon sellers. It analyzes Amazon listings and reviews to provide health scores, complaint summaries, SEO recommendations, and AI-generated content. The Service is provided as-is and features may change at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">3. Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your credentials. Notify us immediately at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a> if you suspect unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">4. Credits and Payments</h2>
            <p>Voxrate operates on a credit-based system. Subscription credits refresh monthly and do not carry over. One-time credit pack purchases never expire. All payments are processed by Stripe. Subscriptions auto-renew unless cancelled before the renewal date.</p>
            <p className="mt-3">We do not offer refunds for credits already consumed or subscription periods in progress. For billing errors contact us within 14 days at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service for illegal purposes, attempt to scrape or reverse-engineer it, submit harmful content to AI tools, share account credentials, use bots or automated scripts, or bypass rate limits or access controls. Violations may result in immediate account suspension without refund.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">6. AI-Generated Content</h2>
            <p>AI-generated content is provided for informational purposes only. We do not guarantee accuracy or fitness for any particular purpose. You are solely responsible for reviewing and deciding whether to use any AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. Intellectual Property</h2>
            <p>The Voxrate name, logo, and design are owned by Voxrate. You retain ownership of data you submit. By submitting content you grant Voxrate a limited license to process it solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Voxrate shall not be liable for indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid us in the 3 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">9. Disclaimers</h2>
            <p>Voxrate is not affiliated with or endorsed by Amazon.com, Inc. The Service is provided without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">10. Termination</h2>
            <p>You may cancel your account at any time from Settings. We reserve the right to suspend accounts for violations, fraudulent activity, or chargebacks. Upon termination your data may be deleted after 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">11. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use after changes constitutes acceptance. We will notify users of material changes via email or in-app notice.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">12. Contact</h2>
            <p>Questions? Email us at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
