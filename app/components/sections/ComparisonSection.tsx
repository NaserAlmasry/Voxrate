'use client'

import { useState, useRef } from 'react'

const ALL_ROWS = [
  { feature: 'Single health score per listing — watch it rise as you fix',                    us: true,      them: false },
  { feature: 'Ranked complaint themes — by severity and revenue impact',                      us: true,      them: false },
  { feature: 'Step-by-step fix for each complaint — not just "you should improve"',           us: true,      them: false },
  { feature: 'Competitor review weakness spy — see their gaps before they fix them',          us: true,      them: false },
  { feature: 'Review attack alerts — 3+ new 1★ reviews triggers an immediate email',         us: true,      them: false },
  { feature: 'Coordinated attack detection — flags reviews sharing similar wording',          us: true,      them: false },
  { feature: 'Competitor watchlist — daily score tracking, emailed on any change',            us: true,      them: false },
  { feature: 'Chrome extension — analysis overlay lives inside Amazon, no tab switching',     us: true,      them: false },
  { feature: 'Seller Central scanner — account health auto-read on each visit',               us: true,      them: false },
  { feature: 'Re-analyze over time — track whether your fixes are actually working',          us: true,      them: false },
  { feature: 'SEO keywords pulled from real buyer language in your reviews',                  us: true,      them: 'partial' },
  { feature: 'AI listing rewriter using your own review keywords',                            us: true,      them: 'partial' },
  { feature: 'Review reply generator (3 tones)',                                              us: true,      them: false },
  { feature: 'Listing keyword score + title/bullets structure audit',                         us: 'partial', them: true },
]

const VISIBLE_DEFAULT = 5

export default function ComparisonSection() {
  const [showAll, setShowAll] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const rows = showAll ? ALL_ROWS : ALL_ROWS.slice(0, VISIBLE_DEFAULT)

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto scroll-fade">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Why Voxrate</p>
          <h2 className="text-3xl font-bold mb-3">Most Amazon tools score your title.<br/>We score what your customers say.</h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">Keyword and listing tools tell you what buyers search for <em>before</em> they click. Voxrate tells you what they say <em>after</em> they buy — and exactly how to fix it.</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden mb-3">
          <div className="grid grid-cols-3 bg-neutral-50 border-b border-neutral-200">
            <div className="p-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Capability</div>
            <div className="p-4 text-center">
              <span className="text-sm font-bold text-black">Voxrate</span>
            </div>
            <div className="p-4 text-center">
              <span className="text-sm font-semibold text-neutral-400">Typical Amazon tools</span>
            </div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 border-b border-neutral-100 last:border-b-0 ${i % 2 === 0 ? '' : 'bg-neutral-50/50'}`}>
              <div className="p-3.5 text-xs text-neutral-700">{row.feature}</div>
              <div className="p-3.5 text-center">
                {row.us === true
                  ? <span className="text-green-500 font-bold text-sm">✓</span>
                  : <span className="text-xs text-orange-400 font-medium">Partial</span>}
              </div>
              <div className="p-3.5 text-center">
                {row.them === true
                  ? <span className="text-green-400 text-sm">✓</span>
                  : row.them === 'partial'
                  ? <span className="text-xs text-orange-400 font-medium">Partial</span>
                  : <span className="text-neutral-300 text-sm">✗</span>}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            if (showAll) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setShowAll(v => !v)
          }}
          className="w-full py-2.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 border border-neutral-200 bg-white rounded-xl transition-colors flex items-center justify-center gap-1.5 mb-3"
        >
          {showAll ? 'Show less' : `Show ${ALL_ROWS.length - VISIBLE_DEFAULT} more features`}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: showAll ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <p className="text-xs text-neutral-400 text-center">&ldquo;Typical Amazon tools&rdquo; refers to general keyword/SEO research tools. Comparison based on publicly available features as of 2026.</p>
      </div>
    </section>
  )
}
