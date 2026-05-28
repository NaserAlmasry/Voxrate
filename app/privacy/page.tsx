import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Voxrate',
  description: 'Privacy Policy for Voxrate.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-neutral-400 hover:text-black transition-colors mb-10 inline-block">← Back to Voxrate</Link>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-12">Last updated: May 28, 2026</p>
        <div className="space-y-10 text-sm text-neutral-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">1. Who We Are</h2>
            <p>Voxrate ("we", "us", "our") is an AI-powered review analysis platform for Amazon sellers. For privacy inquiries, contact us at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">2. What Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="font-medium text-neutral-800">Account data:</span> Email address, name, and authentication provider (Google or email/password) when you create an account.</li>
              <li><span className="font-medium text-neutral-800">Usage data:</span> Amazon listing URLs and ASINs you analyze, analysis results, credit balance, and subscription status.</li>
              <li><span className="font-medium text-neutral-800">Payment data:</span> Payment processing is handled entirely by Stripe. We never see or store your card details.</li>
              <li><span className="font-medium text-neutral-800">Technical data:</span> IP address (for rate limiting), browser type, and pages visited (via Vercel Analytics).</li>
              <li><span className="font-medium text-neutral-800">Error data:</span> Crash reports and error logs via Sentry, which may include browser and OS information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and improve the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (account confirmation, weekly digests, monitoring alerts)</li>
              <li>To detect and prevent abuse, fraud, and security threats</li>
              <li>To understand how users interact with the platform (analytics)</li>
            </ul>
            <p className="mt-3">We do not sell your data to third parties. We do not use your data for advertising.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">4. Data Storage and Security</h2>
            <p>Your data is stored on servers in the <span className="font-medium text-neutral-800">United States (AWS us-east-1)</span> via Supabase. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use industry-standard security practices including Row Level Security (RLS) to ensure users can only access their own data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">5. Third-Party Services</h2>
            <p>We use the following third-party services to operate Voxrate:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><span className="font-medium text-neutral-800">Supabase</span> — database, authentication, and file storage</li>
              <li><span className="font-medium text-neutral-800">Stripe</span> — payment processing</li>
              <li><span className="font-medium text-neutral-800">AI Infrastructure Partners</span> — Voxrate routes analysis requests through a proprietary ensemble of state-of-the-art large language models (LLMs) provided by third-party AI infrastructure partners. Listing content and review data are transmitted to these services solely for the purpose of generating analysis output. Vendor identities are not disclosed as they constitute part of Voxrate&apos;s proprietary technology stack.</li>
              <li><span className="font-medium text-neutral-800">Vercel</span> — hosting and analytics</li>
              <li><span className="font-medium text-neutral-800">Sentry</span> — error monitoring</li>
              <li><span className="font-medium text-neutral-800">Upstash Redis</span> — rate limiting</li>
            </ul>
            <p className="mt-3">Each service has its own privacy policy. By using Voxrate, you acknowledge that your data may be processed by these services.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">6. Chrome Extension</h2>
            <p>The Voxrate Chrome extension ("Voxrate for Amazon Sellers") has a single purpose: to read Amazon product review data from pages the user is actively viewing in their authenticated Amazon session and send that data to the Voxrate API for AI-powered analysis.</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><span className="font-medium text-neutral-800">Amazon review pages:</span> The extension reads publicly visible review text, star ratings, and product listing metadata from Amazon product pages you visit. This data is transmitted over HTTPS to the Voxrate API (voxrate.app) for analysis and may then be forwarded to third-party AI processing partners solely to generate the analysis output. It is the same data visible to any logged-in browser visitor.</li>
              <li><span className="font-medium text-neutral-800">Seller Central pages:</span> When you visit your Amazon Seller Central account, the extension reads account health metrics, stranded inventory counts, and return summaries that are already displayed on-screen. This data is sent to Voxrate to generate alerts. The extension never accesses, stores, or transmits your Amazon credentials, payment information, or buyer order details.</li>
              <li><span className="font-medium text-neutral-800">Listing monitoring:</span> The extension checks product listing pages (title, price, images, buy box status) at regular intervals you configure. Changes are sent to Voxrate to generate alerts.</li>
              <li><span className="font-medium text-neutral-800">Local storage:</span> The extension stores your Voxrate session token locally in Chrome storage to authenticate API calls. It is never shared with third parties.</li>
            </ul>
            <p className="mt-3">The extension does not collect, store, or transmit any Amazon customer&apos;s personally identifiable information. It reads only review text content, star ratings, and product listing metadata visible on pages the user has loaded. It does not access any Amazon pages the user has not explicitly navigated to.</p>
            <p className="mt-3">The extension does not collect browsing history outside of Amazon domains. It does not inject ads, track affiliate links, or run any code on non-Amazon pages (except voxrate.app for authentication). All data transmitted by the extension is covered by this Privacy Policy.</p>
            <p className="mt-3">Review and listing data transmitted by the extension is processed on AWS infrastructure in us-east-1. Analysis results are stored in your Voxrate account. Raw review text transmitted for analysis is not retained beyond the duration of the API request unless it forms part of a saved report in your account.</p>
            <p className="mt-3 font-medium text-neutral-800">Permissions used and why:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><span className="font-medium">storage</span> — stores your session token and cached report data locally</li>
              <li><span className="font-medium">tabs</span> — opens Amazon review pages within your existing Amazon session to collect paginated reviews. The extension does not read, monitor, or access URLs of any tabs outside of amazon.com domains.</li>
              <li><span className="font-medium">alarms</span> — schedules periodic listing checks for monitoring alerts</li>
              <li><span className="font-medium">scripting</span> — injects content scripts on Amazon pages to read on-screen data</li>
              <li><span className="font-medium">host_permissions (Amazon domains)</span> — required to read Amazon page content in the above scripts</li>
              <li><span className="font-medium">host_permissions (voxrate.app)</span> — required to authenticate and send collected data to your Voxrate account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. Cookies</h2>
            <p>Voxrate uses cookies solely for authentication (session management via Supabase). We do not use tracking or advertising cookies. You can disable cookies in your browser but this will prevent you from logging in.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. Your Rights (GDPR — EEA Users)</h2>
            <p>If you are located in the European Economic Area, you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict processing of your data</li>
              <li>Request a portable copy of your data</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, email <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>. We will respond within 30 days. You may also delete your account directly from <strong>Settings → Delete Account</strong> in your dashboard, which initiates removal of your personal data within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">8. Your Rights (CCPA — California Residents)</h2>
            <p>If you are a California resident, you have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Know what personal information we collect about you and how it is used</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of the sale of your personal information — <span className="font-medium text-neutral-800">we do not sell personal information</span></li>
              <li>Non-discrimination for exercising your privacy rights</li>
            </ul>
            <p className="mt-3">To submit a request, email <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a> with the subject "CCPA Request". We will respond within 45 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">9. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, your personal data is removed within 30 days. Analysis reports may be retained in anonymized form for product improvement.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">10. Children's Privacy</h2>
            <p>Voxrate is not intended for use by children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or an in-app notice. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">12. Contact</h2>
            <p>For any privacy-related questions or requests, contact us at <a href="mailto:info@voxrate.app" className="underline text-black">info@voxrate.app</a>.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
