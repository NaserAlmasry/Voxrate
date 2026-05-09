'use client'

// ============================================================
// PRIVACY POLICY — voxrate/app/privacy/page.tsx
// ============================================================

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Navbar */}
      <nav className="border-b border-neutral-200 bg-white px-6 h-16 flex items-center justify-between">
        <a href="/">
  <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} />
</a>
        <a href="/privacy" target="_blank" className="hover:text-black transition-colors">Privacy</a>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-10">Last updated: April 21, 2026</p>

        <div className="space-y-8 text-sm text-neutral-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">1. Who We Are</h2>
            <p>Voxrate ("we", "our", or "us") operates the website voxrate.app and provides an AI-powered review analysis tool for Etsy sellers. If you have any questions about this Privacy Policy, contact us at <a href="mailto:hello@voxrate.app" className="text-orange-600 hover:underline">hello@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following information when you use Voxrate:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> Your name and email address collected via Google OAuth when you sign in.</li>
              <li><strong>Product URLs:</strong> Etsy product URLs you submit for analysis.</li>
              <li><strong>Analysis data:</strong> Reports generated from your product reviews, stored in your account history.</li>
              <li><strong>Usage data:</strong> How you interact with the service (pages visited, features used).</li>
              <li><strong>Payment information:</strong> Processed securely by Stripe. We do not store your card details.</li>
              <li><strong>Notes:</strong> Any private notes you add to your reports.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and operate the Voxrate service</li>
              <li>To generate AI-powered analysis reports from public Etsy review data</li>
              <li>To process payments via Stripe</li>
              <li>To send you important service updates and account notifications</li>
              <li>To improve our product and fix issues</li>
              <li>To enforce our Terms of Service and prevent abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">4. Data We Scrape</h2>
            <p>Voxrate analyzes publicly available product reviews from Etsy. We do not store personal information about individual reviewers. We only process and store the analysis results (patterns, themes, scores) for your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Google OAuth:</strong> For authentication. Governed by Google's Privacy Policy.</li>
              <li><strong>Supabase:</strong> For secure database storage of your account and reports.</li>
              <li><strong>Stripe:</strong> For payment processing. Governed by Stripe's Privacy Policy.</li>
              <li><strong>ZenRows:</strong> For web scraping of public Etsy data.</li>
              <li><strong>Groq / Anthropic:</strong> For AI analysis of review content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">6. Data Retention</h2>
            <p>We retain your account data and reports for as long as your account is active. If you delete your account, your data will be removed within 30 days. You can request deletion at any time by contacting <a href="mailto:hello@voxrate.app" className="text-orange-600 hover:underline">hello@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. Data Security</h2>
            <p>We use industry-standard security measures including encrypted connections (HTTPS), row-level security in our database, and secure authentication. However, no method of transmission over the internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your report data</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:hello@voxrate.app" className="text-orange-600 hover:underline">hello@voxrate.app</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">9. Cookies</h2>
            <p>We use essential cookies only for authentication and session management. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">10. Children's Privacy</h2>
            <p>Voxrate is not intended for users under the age of 16. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a notice on the site. Continued use of Voxrate after changes means you accept the updated policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">12. Contact</h2>
            <p>For any privacy-related questions or requests, contact us at: <a href="mailto:hello@voxrate.app" className="text-orange-600 hover:underline">hello@voxrate.app</a></p>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6 px-6 text-center">
        <p className="text-xs text-neutral-400">© 2026 Voxrate · <a href="/terms" className="hover:text-black transition-colors">Terms of Service</a> · <a href="/privacy" className="hover:text-black transition-colors">Privacy Policy</a></p>
      </footer>
    </div>
  )
}
