import Link from 'next/link'

const CWS_URL = 'https://chromewebstore.google.com/detail/phngikckgandobfcfkifbkejmlgobhgd'

const steps = [
  {
    num: '1',
    title: 'Install the extension',
    body: 'Click "Add to Chrome" below. Chrome will ask you to confirm — click "Add extension". Takes less than 10 seconds.',
  },
  {
    num: '2',
    title: 'Sign in to your Amazon account in Chrome',
    body: 'The extension only works when you are logged into Amazon in the same browser. If you are not logged in, the extension will not be able to read any data. This is by design — we never store your Amazon credentials.',
  },
  {
    num: '3',
    title: 'Connect it to your Voxrate account',
    body: 'After installing, open voxrate.app/dashboard/settings/extension. Your token is captured automatically — no copy-pasting needed. The extension icon will show a green dot when connected.',
  },
  {
    num: '4',
    title: 'Visit Amazon — it works in the background',
    body: 'When you browse Amazon product pages, the extension silently collects review data and sends it to Voxrate for AI analysis. You will occasionally see a brief new tab open and close — this is normal and expected. It is the extension reading reviews for your queued analyses.',
  },
]

const features = [
  {
    tag: 'Review Scraper',
    icon: '📊',
    status: 'live' as const,
    title: 'Reads reviews automatically while you browse',
    body: 'When you visit any Amazon product page, the extension collects reviews in the background and sends them for AI analysis. No manual steps. Just browse Amazon as you normally would — Voxrate handles the rest.',
    howItWorks: 'The extension opens a brief Amazon tab, scrolls through reviews naturally, then closes the tab. This typically takes 30–90 seconds per product.',
  },
  {
    tag: 'Velocity Tracker',
    icon: '📈',
    status: 'live' as const,
    title: 'Tracks how fast reviews are arriving',
    body: 'Enable Velocity Tracker in the extension popup and Voxrate records the daily star count distribution for every product page you visit. A sudden spike in 1-star reviews on a competitor\'s listing is flagged immediately — before it shows in the overall rating.',
    howItWorks: 'Toggle it on from the extension popup. Works on any Amazon product page you visit — no extra steps needed.',
  },
  {
    tag: 'Competitor Overlay',
    icon: '🔍',
    status: 'live' as const,
    title: 'See Voxrate data while browsing any Amazon listing',
    body: 'Enable the overlay in the extension popup and a small panel appears on the right side of any Amazon product page — showing the latest Voxrate snapshot, alerts, and velocity data for that product. Works on competitor listings and your own.',
    howItWorks: 'Toggle it on from the extension popup. The panel is injected into a separate layer — invisible to Amazon, does not affect the page.',
  },
  {
    tag: 'Pro Monitoring',
    icon: '🔔',
    status: 'live' as const,
    title: 'Powers automatic review monitoring for Pro users',
    body: 'If you are on the Pro plan and have Review Monitoring set up, the extension silently handles the scraping in the background whenever you browse Amazon — so Voxrate can check your monitored products without using any third-party API credits. No extra steps needed.',
    howItWorks: 'Automatic when you are on Pro with monitoring enabled. The extension picks up queued monitoring jobs while you browse normally.',
  },
  {
    tag: 'Account Health',
    icon: '🛡',
    status: 'soon' as const,
    title: 'Seller Central health scanner — coming soon',
    body: 'Voxrate will read your Account Health Rating, ODR, late shipment rate, and policy violations directly from Seller Central whenever you visit — and alert you the moment any metric approaches the warning threshold.',
    howItWorks: 'Will activate automatically when you visit sellercentral.amazon.com — no extra setup beyond installing the extension.',
  },
]

const faqs = [
  {
    q: 'Does the extension read my Amazon password or login?',
    a: 'No. The extension uses your existing logged-in browser session. It never sees, stores, or transmits your Amazon credentials.',
  },
  {
    q: 'Why does a new Amazon tab open briefly?',
    a: 'When you queue a product for analysis, the extension opens an Amazon tab to read the reviews, then closes it automatically. This is normal — the tab needs to open so the extension can access review data in your logged-in session.',
  },
  {
    q: 'Does it work on Amazon marketplaces outside the US?',
    a: 'Yes. The extension works on amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.it, amazon.es, amazon.ca, amazon.com.au, amazon.co.jp, amazon.in, amazon.com.mx, and amazon.com.br.',
  },
  {
    q: 'What does the extension popup show?',
    a: 'The popup shows your connection status, whether Velocity Tracker and Competitor Overlay are enabled, and the current job status (idle or running). You can toggle features on and off from there.',
  },
  {
    q: 'I am on the Pro plan — does the extension help with Review Monitoring?',
    a: 'Yes. When you have products set up in Review Monitoring and your extension is active, it automatically handles the scraping in the background while you browse Amazon normally. This means your monitored products get checked without consuming any external API credits.',
  },
  {
    q: 'The extension is not working. What do I check first?',
    a: 'First: make sure you are logged into Amazon in Chrome. Second: open the extension popup and check the green "Connected" dot is showing. Third: visit voxrate.app/dashboard/settings/extension to reconnect if needed.',
  },
  {
    q: 'Does it work if I am not logged into Amazon?',
    a: 'No. Amazon requires a logged-in session to display full review content. The extension will show "Please log into Amazon" in the popup if it detects you are signed out.',
  },
  {
    q: 'Will Amazon ban my account for using this?',
    a: 'No. The extension reads data from pages you visit naturally in your own browser — the same way you would read it yourself. It does not make automated requests from servers and does not violate Amazon\'s terms of service.',
  },
]

export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <header className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} />
        </Link>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">← Back to site</Link>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 md:py-20 max-w-3xl mx-auto text-center">
        <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-4">Chrome Extension</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
          Your Amazon store,<br className="hidden md:block" /> running smarter in the background.
        </h1>
        <p className="text-lg text-neutral-500 max-w-xl mx-auto mb-8">
          Install once. Every Amazon page you visit automatically feeds Voxrate — no manual steps, no switching tabs.
        </p>
        <a
          href={CWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity=".12"/><circle cx="12" cy="12" r="4"/><path d="M12 2a10 10 0 0 1 8.66 5H12V2z" opacity=".6"/><path d="M3.34 7A10 10 0 0 0 12 22v-5a5 5 0 0 1-4.33-7.5L3.34 7z" opacity=".4"/><path d="M20.66 7l-4.33 7.5A5 5 0 0 1 12 17v5a10 10 0 0 0 8.66-15z" opacity=".8"/></svg>
          Add to Chrome — it&apos;s free
        </a>
        <p className="text-xs text-neutral-400 mt-3">Works on Chrome and Chromium-based browsers (Edge, Brave)</p>
      </section>

      {/* Setup Steps */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">How to set it up</h2>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-4 p-5 rounded-2xl border border-neutral-100 bg-neutral-50">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.num}
              </div>
              <div>
                <p className="font-semibold text-neutral-900 mb-1">{s.title}</p>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Important notes banner */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 flex gap-3">
          <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
          <div className="text-sm text-amber-900 leading-relaxed space-y-1">
            <p><strong>You must be logged into Amazon in Chrome</strong> for the extension to work. If you are not logged in, the extension cannot access review data and will show a warning in the popup.</p>
            <p className="mt-1"><strong>A brief Amazon tab will open and close</strong> when the extension runs an analysis — this is intentional and normal, not a bug.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">What each feature does</h2>
        <div className="space-y-5">
          {features.map((f, i) => (
            <div key={i} className={`p-6 rounded-2xl border ${f.status === 'soon' ? 'border-neutral-100 bg-neutral-50 opacity-80' : 'border-neutral-100 bg-white hover:border-neutral-200'} transition-colors`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {f.tag}
                </span>
                {f.status === 'soon' && (
                  <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-neutral-900 mb-2 leading-snug">{f.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed mb-3">{f.body}</p>
              <div className="flex gap-2 items-start text-xs text-neutral-400 bg-neutral-50 rounded-xl px-3 py-2.5">
                <span className="font-semibold text-neutral-500 flex-shrink-0">How:</span>
                <span>{f.howItWorks}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-neutral-900 mb-6">Common questions</h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="group rounded-xl border border-neutral-100 overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-semibold text-neutral-800 list-none select-none hover:bg-neutral-50 transition-colors">
                {f.q}
                <svg className="w-4 h-4 text-neutral-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div className="px-5 pb-4 text-sm text-neutral-500 leading-relaxed border-t border-neutral-50">
                <p className="pt-3">{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="rounded-2xl bg-neutral-900 p-8 text-center">
          <p className="text-white font-bold text-xl mb-2">One install. Works every time you open Amazon.</p>
          <p className="text-neutral-400 text-sm mb-6">Available on all Voxrate plans including the free trial.</p>
          <a
            href={CWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Get the Voxrate Extension →
          </a>
        </div>
      </section>

      <footer className="border-t border-neutral-100 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-400">
          <Link href="/faq" className="hover:text-black transition-colors">FAQ</Link>
          <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
        </div>
        <p className="text-xs text-neutral-300 mt-3">© {new Date().getFullYear()} Voxrate</p>
      </footer>
    </main>
  )
}
