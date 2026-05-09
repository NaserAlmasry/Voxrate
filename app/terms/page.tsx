'use client'

// ============================================================
// TERMS OF SERVICE — voxrate/app/terms/page.tsx
// ============================================================

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Navbar */}
      <nav className="border-b border-neutral-200 bg-white px-6 h-16 flex items-center justify-between">
        <a href="/">
  <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} />
</a>
        <a href="/" className="text-sm text-neutral-500 hover:text-black transition-colors">← Back to home</a>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-10">Last updated: April 21, 2026</p>

        <div className="space-y-8 text-sm text-neutral-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Voxrate ("the Service") at voxrate.app, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users including free and paid plan subscribers.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">2. Description of Service</h2>
            <p>Voxrate is an AI-powered tool that analyzes publicly available product reviews from Etsy to help sellers understand customer feedback, identify patterns, and improve their listings. The Service provides health scores, complaint analysis, strengths, improvement suggestions, and marketing copy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">3. Accounts</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must sign in with a valid Google account to use the Service.</li>
              <li>You are responsible for maintaining the security of your account.</li>
              <li>You must not share your account with others.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">4. Free and Paid Plans</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Free plan:</strong> Includes 72 starter credits (≈ 3 analyses). No credit card required.</li>
              <li><strong>Credit packs (one-time):</strong> 120 credits ($4), 500 credits ($12), or 1,200 credits ($25). Credits never expire.</li>
              <li><strong>Starter subscription ($9/mo):</strong> 720 credits refreshed monthly. Unused credits roll over.</li>
              <li><strong>Pro subscription ($19/mo):</strong> 2,400 credits refreshed monthly. Unused credits roll over.</li>
              <li>Each own-listing analysis costs 24 credits. Each competitor analysis costs 48 credits. AI tools (rewriter, reply generator, grader, builder) are free.</li>
              <li>Paid subscriptions are billed monthly via Stripe.</li>
              <li>You may cancel your subscription at any time. Access continues until the end of the billing period.</li>
              <li>We do not offer refunds for partial months.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Attempt to bypass usage limits or abuse the free plan</li>
              <li>Use the Service to analyze products you do not own or have permission to analyze</li>
              <li>Reverse engineer, copy, or resell any part of the Service</li>
              <li>Use automated scripts or bots to access the Service</li>
              <li>Submit URLs that are not valid Etsy product listings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">6. Data and Content</h2>
            <p className="mb-3">Voxrate analyzes publicly available review data from Etsy. By using the Service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You confirm you have the right to analyze the products you submit.</li>
              <li>You own the reports and notes you create within the Service.</li>
              <li>We do not claim ownership of your data or reports.</li>
              <li>We may use anonymized, aggregated usage data to improve the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7. AI-Generated Content</h2>
            <p>Reports generated by Voxrate are produced by AI and are for informational purposes only. We do not guarantee the accuracy, completeness, or fitness for any particular purpose of AI-generated analysis. Always use your own judgment when making business decisions based on our reports.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7a. Language Limitations</h2>
            <p className="mb-3">Voxrate's AI analysis is optimized for <strong>English and other Latin-script languages</strong> (including French, Spanish, Italian, Portuguese, German, Dutch, and similar). For listings whose reviews are primarily in these languages, the Service will perform at its designed quality level.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Reviews written in non-Latin scripts (Arabic, Chinese, Japanese, Korean, Cyrillic, etc.) will be processed but analysis quality, accuracy, and depth of insights will be <strong>significantly reduced</strong>.</li>
              <li>Mixed-language listings (where reviews appear in multiple languages) may produce less reliable results than single-language listings.</li>
              <li>We do not offer refunds or credits for analyses where results were limited due to non-Latin or non-English review content.</li>
              <li>We recommend having at least 20–30 reviews primarily in English or a Latin-script language for best results.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">7b. Minimum Review Requirements</h2>
            <p className="mb-3">Voxrate's analysis quality depends significantly on the number of reviews available for a given listing:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Listings with <strong>fewer than 15 reviews</strong> may produce limited, unreliable, or inconclusive results.</li>
              <li>Listings with <strong>20–30 reviews</strong> will produce usable insights, though some patterns may not yet be statistically meaningful.</li>
              <li>Listings with <strong>50+ reviews</strong> provide the most accurate complaint patterns, strength identification, and keyword extraction.</li>
              <li>Credits are consumed upon analysis regardless of review count. We recommend checking your review volume before running an analysis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">8. Service Availability</h2>
            <p>We aim to keep Voxrate available at all times but do not guarantee uninterrupted access. We may perform maintenance, updates, or experience downtime. We are not liable for any loss resulting from service interruptions.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Voxrate shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to loss of revenue, data, or business opportunities.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">10. Modifications to the Service</h2>
            <p>We reserve the right to modify, suspend, or discontinue any part of the Service at any time. We will provide reasonable notice for significant changes that affect paid subscribers.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms of Service at any time. Continued use of the Service after changes constitutes acceptance of the new terms. We will notify users of material changes via email.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">12. Governing Law</h2>
            <p>These Terms are governed by applicable law. Any disputes shall be resolved through good-faith negotiation. If unresolved, disputes shall be subject to the jurisdiction of the courts where Voxrate operates.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">13. Third-Party Services — Etsy</h2>
            <p className="mb-3">Voxrate uses the Etsy API to retrieve publicly available listing and review data. By using Voxrate, you acknowledge the following:</p>
            <p className="mb-3">The term &quot;Etsy&quot; is a trademark of Etsy, Inc. Voxrate uses Etsy&apos;s API but is not endorsed or certified by Etsy.</p>
            <p className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 leading-relaxed font-mono">
              DISCLAIMER: THIS APPLICATION IS SOLELY PROVIDED BY VOXRATE (THE &quot;APPLICATION DEVELOPER&quot;). YOU ACKNOWLEDGE THAT ETSY, INC. AND ITS AFFILIATES ARE NOT THE APPLICATION DEVELOPER, DO NOT PROVIDE THE APPLICATION SERVICE, AND MAKE NO WARRANTIES OF ANY KIND WITH RESPECT TO THE APPLICATION OR DATA ACCESSED THROUGH IT.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">14. Contact</h2>
            <p>For any questions about these Terms, contact us at: <a href="mailto:info@voxrate.app" className="text-orange-600 hover:underline">info@voxrate.app</a></p>
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
