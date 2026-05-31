import Link from 'next/link'

const features = [
  {
    title: 'See exactly why shoppers skip your competitor — while you browse their listing',
    body: "Open any product on Amazon and Voxrate shows you a breakdown of that product's most common buyer complaints, what they love, and the keywords buyers actually use. You don't need to read 3,000 reviews — Voxrate reads them and surfaces what matters. If a competitor has a packaging problem, a sizing issue, or a recurring quality complaint, you'll know before you compete with them.",
    tag: 'Competitor Intelligence',
  },
  {
    title: 'Know the moment a bad review hits your listing — not days later',
    body: "Every new 1-star or 2-star review on your product triggers an alert. You'll get an email within hours, not days. That means you can respond fast, catch a product defect early, or flag a review that violates Amazon's policies before it tanks your rating. Most sellers only notice bad reviews when their conversion rate has already dropped.",
    tag: 'Review Alerts',
  },
  {
    title: 'Your account health checked every time you open Seller Central — automatically',
    body: "Every time you open Seller Central, Voxrate reads your account health dashboard for you — stranded inventory, late shipment rate, return rate, policy warnings. If something needs action, you see it immediately. No more missing a warning because you forgot to check that tab. Sellers who catch account health issues early avoid suppressions and listing removals.",
    tag: 'Account Health',
  },
  {
    title: 'Spot review spikes before they affect your ranking',
    body: "Voxrate tracks how fast reviews are coming in on your products and your competitors'. A sudden spike in reviews on a competitor's listing could mean a launch campaign, a viral post, or a review manipulation pattern worth reporting. A drop in your own review velocity can be an early signal of a conversion problem. You'll see the trend — not just the total count.",
    tag: 'Velocity Tracker',
  },
]

export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} />
        </Link>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">Back to site</Link>
      </header>

      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-4">Chrome Extension</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
          Your Amazon store, running smarter in the background.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          Install Voxrate once on Chrome. From that point on, every Amazon page you visit works harder for you — no extra steps, no switching tabs.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/phngikckgandobfcfkifbkejmlgobhgd"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Add to Chrome — it&apos;s free
        </a>
      </section>

      <section className="px-6 pb-24 max-w-3xl mx-auto">
        <div className="space-y-6">
          {features.map((f, i) => (
            <div key={i} className="p-7 rounded-2xl border border-neutral-100 bg-white hover:border-neutral-200 transition-colors">
              <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-3 inline-block">{f.tag}</span>
              <h2 className="text-lg font-bold text-neutral-900 mb-3 leading-snug">{f.title}</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 p-7 rounded-2xl bg-neutral-900 text-center">
          <p className="text-white font-bold text-xl mb-2">One install. Runs silently. Works every time you open Amazon.</p>
          <p className="text-neutral-400 text-sm mb-6">Available free with all Voxrate plans. No configuration needed.</p>
          <a
            href="https://chromewebstore.google.com/detail/phngikckgandobfcfkifbkejmlgobhgd"
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
          <Link href="/careers" className="hover:text-black transition-colors">Careers</Link>
        </div>
        <p className="text-xs text-neutral-300 mt-3">© {new Date().getFullYear()} Voxrate</p>
      </footer>
    </main>
  )
}
