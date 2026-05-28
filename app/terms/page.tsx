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
        <p className="text-sm text-neutral-400 mb-12">Last updated: May 28, 2026</p>
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
            <h2 className="text-base font-semibold text-neutral-900 mb-3">4. Subscriptions, Analyses, and Payments</h2>
            <p>Voxrate operates on a monthly subscription model. Each plan includes a set number of analyses per month (your "monthly allotment"). Unused analyses roll over automatically to the following month, subject to a cap: up to 2× your monthly allotment on Starter and Growth, and up to 3× on Pro. Rolled-over analyses expire if your subscription lapses or is cancelled.</p>
            <p className="mt-3">Subscriptions renew automatically on your billing date unless cancelled beforehand. Cancellation takes effect at the end of the current billing period — you retain access and analyses until then.</p>
            <p className="mt-3"><span className="font-medium text-neutral-800">No refunds.</span> All payments are final and non-refundable. We do not offer refunds for subscription periods already started, analyses already consumed, or unused rollover balances at cancellation. If you believe a charge was made in error, contact us within 14 days at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a> and we will investigate. By starting your subscription or consuming your first analysis, you expressly waive any applicable statutory cooling-off or withdrawal rights to the extent permitted by law.</p>
            <p className="mt-3">All payments are processed by Stripe. We never see or store your card details.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">5. Free Trial</h2>
            <p>New accounts receive a 14-day free trial with 5 analyses included. No credit card is required to start a trial. Trial analyses do not roll over after the trial period ends. Upon trial expiry your account moves to a read-only free tier — existing reports remain accessible but new analyses require a paid subscription.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">6. Acceptable Use</h2>
            <p>You agree not to use the Service for illegal purposes, attempt to scrape or reverse-engineer it, submit harmful content to AI tools, share account credentials, use bots or automated scripts, or bypass rate limits or access controls. Violations may result in immediate account suspension without refund.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. AI-Generated Content</h2>
            <p>AI-generated content is provided for informational purposes only. We do not guarantee accuracy or fitness for any particular purpose. You are solely responsible for reviewing and deciding whether to use any AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">8. Intellectual Property</h2>
            <p>The Voxrate name, logo, and design are owned by Voxrate. You retain ownership of data you submit. By submitting content you grant Voxrate a limited license to process it solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Voxrate shall not be liable for indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid us in the 3 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">10. Data Sources and Accuracy</h2>
            <p>Voxrate derives its analysis from Amazon product and review data collected through two distinct mechanisms depending on your account tier:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><span className="font-medium text-neutral-800">Free-tier users:</span> Data is retrieved via third-party data aggregation services that index publicly available Amazon marketplace content. Voxrate does not control the availability, completeness, or freshness of data obtained through these services.</li>
              <li><span className="font-medium text-neutral-800">Paid subscribers (Starter, Growth, Pro):</span> Data is collected directly through the Voxrate Chrome Extension, which operates exclusively within your own authenticated Amazon session using data you are already authorized to access. No third-party scraping infrastructure is involved for extension-sourced analyses.</li>
            </ul>
            <p className="mt-3">In all cases, Voxrate makes no warranty that analysis results are complete, current, or error-free. Amazon.com, Inc. may modify, restrict, or remove access to marketplace data at any time and without notice. Voxrate shall not be liable for any disruption to the Service resulting from such changes. Analysis output is intended for informational and strategic reference only; you remain solely responsible for any business decisions made on the basis of results generated by the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">11. Disclaimers</h2>
            <p>Voxrate is not affiliated with or endorsed by Amazon.com, Inc. The Service is provided without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">12. Termination</h2>
            <p>You may cancel your subscription or delete your account at any time from the Settings page. We reserve the right to suspend or terminate accounts for violations of these Terms, fraudulent activity, or chargebacks. Upon account deletion your personal data is removed within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">13. Governing Law</h2>
            <p>These Terms are governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of competent jurisdiction. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">14. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use after changes constitutes acceptance. We will notify users of material changes via email or in-app notice.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">15. Contact</h2>
            <p>Questions? Email us at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
