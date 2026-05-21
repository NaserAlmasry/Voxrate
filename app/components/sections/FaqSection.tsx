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
    q: 'Can I analyze a competitor\'s listing?',
    a: "Yes. Competitor analysis runs both products through the AI simultaneously and produces a battle card — why buyers choose them over you, your exact keyword gaps, and a ranked fix list. It costs 35 credits (vs 20 for own listings). Starter gets 1 competitor analysis per month. Growth unlocks up to 3 per product per month. Pro unlocks up to 10 per product per month. Resets on the 1st of each month.",
  },
  {
    q: 'What are credits and do they expire?',
    a: 'Credits are the currency used for analyses. Each own-listing analysis costs 20 credits, each competitor analysis costs 35 credits. All other tools (rewriter, grader, reply generator, listing builder) are free. Credits purchased in packs never expire. Subscription credits refresh monthly.',
  },
  {
    q: 'Is my data and my customers\' data private?',
    a: "Voxrate only analyzes publicly available review text from Amazon — the same text anyone can read on the listing page. We don't access your Amazon account, private messages, or order data. Your generated reports are private to your account and are never shared.",
  },
  {
    q: 'What if I\'m not happy with the results?',
    a: 'Email us at info@voxrate.app and we\'ll personally look into it with you. Tell us what seemed off and we\'ll check together — we want every analysis to be genuinely useful and we\'ll work with you until it is.',
  },
]

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="py-24 px-6 bg-white border-t border-neutral-200">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">FAQ</p>
          <h2 className="text-3xl font-bold mb-3">Common questions</h2>
          <p className="text-sm text-neutral-500">Everything sellers ask before signing up</p>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className={`border rounded-2xl overflow-hidden transition-colors ${open === i ? 'border-orange-200 bg-orange-50/30' : 'border-neutral-200 bg-white'}`}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
              >
                <span className="text-sm font-medium text-neutral-800">{item.q}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className={`flex-shrink-0 text-neutral-400 transition-transform ${open === i ? 'rotate-180 text-orange-500' : ''}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div id={`faq-answer-${i}`} hidden={open !== i} className="px-5 pb-5">
                <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
