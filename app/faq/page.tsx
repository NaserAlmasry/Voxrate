'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    q: 'Does this work for any Amazon product?',
    a: 'Yes — Voxrate works for any product category on Amazon, from electronics and kitchen goods to clothing and supplements. The AI adapts its analysis to the product type. Best results come from listings with 30+ reviews.',
  },
  {
    q: 'What if my listing has very few reviews?',
    a: 'The analysis will still run with fewer reviews, but insights may be limited. We recommend waiting until you have at least 20–30 reviews for reliable patterns. With fewer than 15 reviews, the health score and complaint categories may not be accurate enough to act on.',
  },
  {
    q: 'Does it work with languages other than English?',
    a: 'Voxrate is optimized for English and other Latin-script languages (French, Spanish, Italian, Portuguese, German, Dutch, etc.). It will still analyze non-Latin reviews (e.g. Japanese, Arabic, Chinese) but accuracy and depth of insights will be lower. For best results, your reviews should be primarily in a Latin-script language.',
  },
  {
    q: 'How is Voxrate different from other Amazon tools?',
    a: "Most Amazon tools tell you what buyers search for before they buy — keyword volume, competition, ranking. Voxrate tells you what buyers say after they buy — complaints, praise, and specific fixes. They solve different problems: use keyword tools to get found, use Voxrate to improve what happens after they find you.",
  },
  {
    q: "Can I analyze a competitor's listing?",
    a: "Yes. Paste any Amazon product URL or ASIN — including a competitor's. Voxrate analyzes their reviews, shows you their top weaknesses, what they do well, and gives you a side-by-side comparison with exact positioning language to use. Competitor analysis costs 35 credits (vs 20 for own listings). Starter gets 1 per month. Growth unlocks up to 3 per product per month. Pro unlocks up to 10 per product per month. Resets on the 1st of each month.",
  },
  {
    q: 'What are credits and do they expire?',
    a: 'Credits are the currency used for analyses. Each own-listing analysis costs 20 credits. Each competitor analysis costs 35 credits. All other tools (description rewriter, listing grader, review reply generator, listing builder) are completely free — no credits needed. Credits purchased in one-time packs never expire. Subscription credits refresh monthly.',
  },
  {
    q: "Is my data and my customers' data private?",
    a: "Voxrate only analyzes publicly available review text from Amazon — the same text anyone can read on the listing page. We don't access your Amazon Seller Central account, private messages, or order data. Your generated reports are private to your account and are never shared.",
  },
  {
    q: "What if I'm not happy with the results?",
    a: "Email us at info@voxrate.app and we'll personally look into it with you. Tell us what seemed off and we'll check together — we want every analysis to be genuinely useful and we'll work with you until it is.",
  },
]

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      <nav className="border-b border-neutral-200 bg-white px-6 h-16 flex items-center justify-between">
        <a href="/"><img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} /></a>
        <a href="/" className="text-sm text-neutral-500 hover:text-black transition-colors">← Back to home</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">FAQ</p>
          <h1 className="text-3xl font-bold mb-3">Common questions</h1>
          <p className="text-sm text-neutral-500">Everything Amazon sellers ask before signing up. Can't find your answer? Email <a href="mailto:info@voxrate.app" className="text-orange-500 hover:underline">info@voxrate.app</a></p>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`border rounded-2xl overflow-hidden transition-colors ${open === i ? 'border-orange-200 bg-orange-50/40' : 'border-neutral-200 bg-white'}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
              >
                <span className="text-sm font-medium text-neutral-800">{item.q}</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={`flex-shrink-0 text-neutral-400 transition-transform ${open === i ? 'rotate-180 text-orange-500' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-white border border-neutral-200 rounded-2xl text-center">
          <p className="text-sm font-semibold text-neutral-800 mb-1">Still have a question?</p>
          <p className="text-xs text-neutral-500 mb-4">We reply personally to every email — usually within a few hours.</p>
          <a
            href="mailto:info@voxrate.app"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            info@voxrate.app
          </a>
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-white py-6 px-6 text-center">
        <p className="text-xs text-neutral-400">
          © 2026 Voxrate ·{' '}
          <a href="/faq" className="hover:text-black transition-colors">FAQ</a> ·{' '}
          <a href="/terms" className="hover:text-black transition-colors">Terms</a> ·{' '}
          <a href="/privacy" className="hover:text-black transition-colors">Privacy</a>
        </p>
      </footer>
    </div>
  )
}
