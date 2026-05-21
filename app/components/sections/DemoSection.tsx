'use client'

import { Coffee, Crosshair, AlertCircle, Sparkles, Wrench, TrendingUp, Megaphone, Star } from 'lucide-react'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return { text: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100' }
}

const DEMO_SCORE = 28
const sc = scoreColor(DEMO_SCORE)
const COMP_SCORE = 54
const csc = scoreColor(COMP_SCORE)

const demoComplaints = [
  {
    title: 'Lid leaks when tilted or in bags',
    severity: 'CRITICAL', frequency: '203 of 1,000 reviews',
    quote: '"leaked all over my gym bag — soaked my clothes and phone. The twist lock feels secure but it just drips constantly"',
    description: 'Reviewers report leaking when the bottle is tilted past 45° or stored sideways. The complaint clusters around the lid gasket seal and accounts for 74% of all 1-star reviews.',
    revenueImpact: '20% of buyers affected — at $28/unit, each return costs ~$9–14 in shipping plus replacement. Return rate on this complaint is 68%.',
    riskIfIgnored: '"Leaked in my bag" reviews are the most-shared negative reviews on Amazon — buyers include photos, which Amazon surfaces prominently',
    fixes: [
      { simple: 'Source a lid with a double-seal silicone gasket (inner + outer ring) — single-ring gaskets fail when pressure builds during temperature changes', why: '203 of 1,000 reviewers reported leaking, the #1 reason for 1-star reviews and returns' },
      { simple: 'Add a "leak-test passed" QC sticker to each lid at packaging — sets buyer expectation and reduces dispute rate', why: 'Reduces unboxing anxiety and return-without-reason disputes' },
      { simple: 'Update listing title to include "leak-proof lid" explicitly — buyers who searched this term and got a leak feel actively deceived', why: 'Sets correct expectations, reduces "not as described" dispute rate' },
    ]
  },
  {
    title: 'Condensation on exterior defeats the insulation claim',
    severity: 'MEDIUM', frequency: '141 of 1,000 reviews',
    quote: '"heavy condensation on the outside — the whole point of double-wall vacuum is no sweat. Mine sweats more than a cheap plastic bottle"',
    description: 'Condensation appears when the vacuum seal between walls is compromised. Reviewers report this starting within 2–4 weeks of purchase, indicating a manufacturing consistency issue.',
    revenueImpact: '14% of buyers affected — condensation complaints generate the most detailed negative reviews with photos, which suppresses conversion on your listing',
    riskIfIgnored: 'Each photo review showing condensation costs you conversions — Amazon A/B tests show photo-negative reviews reduce add-to-cart rate by up to 12%',
    fixes: [
      { simple: 'Tighten vacuum seal QC — test a sample of each batch with a pressure gauge before shipping. Reject any unit showing >0.5 psi variance', why: 'Targets the manufacturing root cause rather than masking it' },
      { simple: 'Add "if you experience condensation, contact us for immediate replacement" to your listing description', why: 'Converts a 1-star review into a resolved customer interaction' },
    ]
  },
  {
    title: 'Paint and coating chips within first month',
    severity: 'LOW', frequency: '48 of 1,000 reviews',
    quote: '"the matte black coating started flaking near the bottom after 3 weeks — looks terrible and I\'m worried about what\'s getting into my water"',
    description: 'Powder-coat and painted finishes are chipping at the base and around the lid threads. Buyers raising food-safety concerns are the highest-return segment.',
    revenueImpact: '5% of buyers affected — paint complaints generate food-safety questions that trigger Amazon\'s health product review process',
    riskIfIgnored: 'Food-safety flag reviews can trigger Amazon category restrictions — a low-frequency complaint with outsized platform risk',
    fixes: [
      { simple: 'Switch to a food-safe, BPA-free powder coat with a minimum 2-coat process — the base is the highest-impact zone and needs a rubber bumper or reinforced coat', why: '~$0.80/unit cost increase eliminates the chipping complaint and the food-safety risk' },
    ]
  },
]

const demoStrengths = [
  {
    title: 'Ice retention praised across all buyer segments',
    frequency: '341 of 1,000 reviews',
    quote: '"ice still in there after 18 hours in the car — I\'ve tried 6 different bottles and nothing comes close"',
    segment: 'Outdoor and gym buyers, aged 22–45',
    summary: 'Ice retention is the single most-mentioned feature in your 5-star reviews — appearing in 34% of all feedback without any prompting. "Ice still there after X hours" appears in 341 reviews verbatim. This phrase does not appear in your listing title or bullet points.',
    businessImpact: 'Adding "ice retention 18+ hours" to your title directly targets the search term your own customers already use — and it\'s a term competitors aren\'t ranking for.',
    marketingAngle: '"ice still in there after 18 hours — I\'ve tried 6 different bottles and nothing comes close"',
  },
  {
    title: 'Buyers describe it as a gift upgrade over competitors',
    frequency: '210 of 1,000 reviews',
    quote: '"bought this as a graduation gift and she said it\'s the nicest water bottle she\'s ever owned — feels premium"',
    segment: 'Gift buyers aged 28–50, outdoor and fitness occasions',
    summary: 'Gift buyers spend 35% more per transaction and write the most-detailed 5-star reviews. "Feels premium" and "great gift" appear in 210 reviews — none of which are being captured in your listing\'s gift-search keywords.',
    businessImpact: 'Adding a gift-wrapping option and "perfect gift for hikers / gym-goers" to your first bullet would capture high-intent gift traffic you are currently losing to competitors.',
    marketingAngle: '"feels premium, way more substantial than anything at this price point — everyone I\'ve given one to has re-ordered"',
  },
]

const demoImprovements = [
  { title: 'Add ice retention hours to your listing title', description: '341 reviews independently use "ice still there after X hours" without any prompting. This phrase does not appear anywhere in your title or bullet points — your strongest selling point is invisible to search. Adding "ice retention 18+ hours" to the title targets a validated, high-intent search term.', impact: 'Captures validated search intent your own buyers already proved — zero cost' },
  { title: 'Add capacity and dimensions as your first listing bullet', description: '89 reviews mention surprise at the bottle size or weight. Adding "32oz · Height: 10.5 inches · Weight: 13oz" as the very first bullet eliminates the most common pre-purchase uncertainty and improves search ranking for size-specific queries.', impact: 'Reduces size-related returns and ranks for capacity-specific searches' },
]

const demoMarketingCopy = [
  '"ice still in there after 18 hours in the car — I\'ve tried 6 different bottles and nothing comes close"',
  '"bought this as a graduation gift and she said it\'s the nicest water bottle she\'s ever owned — feels premium"',
  '"this bottle has completely replaced my Yeti. Same insulation, half the price, and it actually fits in my car cupholder."',
  '"I bought one for myself and immediately ordered three more as gifts. Everyone asks where I got it."',
]

const demoStarBreakdown = [
  { star: 5, count: 510, pct: 51 }, { star: 4, count: 160, pct: 16 },
  { star: 3, count: 85,  pct: 9  }, { star: 2, count: 105, pct: 10 },
  { star: 1, count: 140, pct: 14 },
]

const compComplaints = [
  { title: 'Lid cracks at the hinge after 2–3 months', severity: 'CRITICAL', frequency: '198 of 900 reviews', opportunity: true,
    quote: '"the hinge cracked and now the lid doesn\'t seal — completely unusable. I switched to this brand and the lid feels 3x more solid"',
    yourOpportunity: 'Add "reinforced stainless lid — no plastic hinge" to your title and first bullet. Buyers burned by cracked hinges search specifically for this. Their lid is plastic-hinged; yours is full stainless.' },
  { title: 'Doesn\'t fit standard car cupholders', severity: 'MEDIUM', frequency: '112 of 900 reviews', opportunity: true,
    quote: '"too wide for any cupholder in my car or truck — I have to hold it the entire drive, completely defeats the purpose"',
    yourOpportunity: 'Add "fits standard car cupholders" to your listing description — your base diameter is 3.1 inches vs their 3.6 inches. This is a validated frustration their buyers have that yours don\'t.' },
  { title: 'Metallic taste reported in first 1–2 weeks', severity: 'MEDIUM', frequency: '71 of 900 reviews', opportunity: false,
    quote: '"strong metallic taste for the first two weeks — barely drinkable. Eventually went away but shouldn\'t be an issue at this price point"',
    yourOpportunity: 'Add a "first-use rinse guide" card in your packaging — a baking soda rinse eliminates the metallic taste immediately. Their buyers don\'t know this fix; yours will.' },
]

const compStrengths = [
  { title: 'Bold color selection praised', frequency: '276 reviews' },
  { title: 'Carry loop praised for outdoor use', frequency: '194 reviews' },
]

type Props = {
  activeTab: string
  setActiveTab: (v: string) => void
  expandedComplaint: number | null
  setExpandedComplaint: (v: number | null) => void
  compExpandedComplaint: number | null
  setCompExpandedComplaint: (v: number | null) => void
}

export default function DemoSection({ activeTab, setActiveTab, expandedComplaint, setExpandedComplaint, compExpandedComplaint, setCompExpandedComplaint }: Props) {
  return (
    <section className="py-20 px-6 bg-white border-b border-neutral-200">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-4">Live Demo</p>
          <div className="flex justify-center mb-3">
            <div className="relative inline-block text-left">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="absolute -top-4 -left-6 opacity-20" style={{ color: '#f05a1e' }}>
                <text x="0" y="48" fontSize="64" fill="#f05a1e" fontFamily="Georgia, serif">&ldquo;</text>
              </svg>
              <h2 className="text-3xl md:text-4xl font-bold italic text-neutral-900 pl-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                1,000 reviews.<br />Decisions in one page.
              </h2>
              <p className="text-xs text-neutral-400 mt-2 pl-6 not-italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>— what Voxrate gives you</p>
            </div>
          </div>
        </div>

        {/* Demo tabs: own product / competitor */}
        <div className="flex gap-2 mb-4 justify-center">
          <button
            onClick={() => setActiveTab('complaints')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              activeTab !== 'competitor'
                ? 'bg-black text-white border-black'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <Coffee className={activeTab !== 'competitor' ? 'text-white' : 'text-neutral-500'} size={18} />
            Your product
          </button>
          <button
            onClick={() => setActiveTab('competitor')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              activeTab === 'competitor'
                ? 'bg-black text-white border-black'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <Crosshair className={activeTab === 'competitor' ? 'text-white' : 'text-neutral-500'} size={18} />
            Competitor analysis
          </button>
        </div>

        <div className="bg-[#FAF9F6] rounded-2xl border border-neutral-200 overflow-hidden">
          {activeTab !== 'competitor' ? (
            <>
              <div className="p-6 border-b border-neutral-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-0.5">Demo · B09XK7TRM5</p>
                    <h3 className="font-semibold text-lg">Premium Stainless Water Bottle 32oz</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-yellow-400 text-sm">★★½☆☆</span>
                      <span className="text-xs text-neutral-700 font-medium">2.7 avg · 1,000 reviews analyzed</span>
                    </div>
                  </div>
                  <div className={`text-center px-4 py-2 rounded-xl border ${sc.bg} ${sc.border} flex-shrink-0`}>
                    <p className="text-xs text-neutral-600">Health score</p>
                    <p className={`text-2xl font-bold ${sc.text}`}>{DEMO_SCORE}<span className="text-sm text-neutral-400">/100</span></p>
                  </div>
                </div>
                <div className="mt-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-100">Quick Win — Do This Today</p>
                  </div>
                  <p className="text-sm font-semibold">Source a double-seal silicone lid gasket — eliminates 74% of 1-star reviews at ~$0.90/unit extra</p>
                  <div className="flex gap-3 mt-2 flex-wrap">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Eliminates 74% of complaints</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">~$0.90/unit supplier upgrade</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 px-6 pt-4 overflow-x-auto pb-1">
                {[
                  { id: 'complaints',   label: 'Problems',       icon: <AlertCircle size={12} /> },
                  { id: 'strengths',    label: 'Strengths',      icon: <Sparkles size={12} /> },
                  { id: 'improvements', label: 'Improvements',   icon: <Wrench size={12} /> },
                  { id: 'seo',          label: 'SEO',            icon: <TrendingUp size={12} /> },
                  { id: 'marketing',    label: 'Marketing copy', icon: <Megaphone size={12} /> },
                  { id: 'breakdown',    label: 'Star breakdown', icon: <Star size={12} /> },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'complaints' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold">Problems found</p>
                      <p className="text-xs text-neutral-600">3 issues identified</p>
                    </div>
                    {demoComplaints.map((c, i) => {
                      const isExpanded = expandedComplaint === i
                      const sevColor = c.severity === 'CRITICAL'
                        ? { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' }
                        : c.severity === 'MEDIUM'
                        ? { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' }
                        : { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' }
                      return (
                        <div key={i} className={`bg-white rounded-xl border-2 ${sevColor.border} overflow-hidden`}>
                          <button onClick={() => setExpandedComplaint(isExpanded ? null : i)} className="w-full p-4 text-left">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sevColor.bg} ${sevColor.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sevColor.dot}`} />{c.severity}
                                  </span>
                                  <span className="text-xs text-neutral-500">{c.frequency}</span>
                                </div>
                                <p className="font-semibold text-sm">{c.title}</p>
                                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{c.description}</p>
                                {c.quote && <p className="text-xs text-neutral-600 italic mt-1.5 border-l-2 border-neutral-200 pl-2">{c.quote}</p>}
                              </div>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className={`flex-shrink-0 text-neutral-400 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className={`px-4 pb-4 border-t ${sevColor.border}`}>
                              {c.revenueImpact && (
                                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl mb-3">
                                  <p className="text-xs font-semibold text-orange-800 mb-0.5">Revenue impact</p>
                                  <p className="text-xs text-orange-700 leading-relaxed">{c.revenueImpact}</p>
                                </div>
                              )}
                              {c.riskIfIgnored && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-3">
                                  <p className="text-xs font-semibold text-red-800 mb-0.5">If you ignore this</p>
                                  <p className="text-xs text-red-700 leading-relaxed">{c.riskIfIgnored}</p>
                                </div>
                              )}
                              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-3 mb-2">How to fix this</p>
                              <div className="space-y-2">
                                {c.fixes.map((fix, fi) => (
                                  <div key={fi} className="flex gap-3 p-3 bg-neutral-50 rounded-xl">
                                    <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{fi + 1}</span>
                                    <div>
                                      <p className="text-xs font-medium text-neutral-800 leading-relaxed">{fix.simple}</p>
                                      {fix.why && <p className="text-xs text-neutral-400 mt-1">{fix.why}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {activeTab === 'strengths' && (
                  <div className="space-y-3">
                    {demoStrengths.map((s, i) => (
                      <div key={i} className="bg-white rounded-xl border-2 border-green-100 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-sm">{s.title}</p>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">{s.frequency}</span>
                        </div>
                        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mb-2">{s.segment}</p>
                        <p className="text-xs text-neutral-600 italic mb-3 border-l-2 border-green-200 pl-2">&ldquo;{s.quote}&rdquo;</p>
                        <div className="p-3 bg-neutral-50 rounded-xl mb-2">
                          <p className="text-xs font-medium text-neutral-600 mb-1">Why this matters</p>
                          <p className="text-xs text-neutral-700 leading-relaxed">{s.summary}</p>
                        </div>
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-xs font-medium text-amber-700 mb-0.5">Business impact</p>
                          <p className="text-xs text-neutral-600 leading-relaxed">{s.businessImpact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'improvements' && (
                  <div className="space-y-3">
                    {demoImprovements.map((imp, i) => (
                      <div key={i} className="bg-white rounded-xl border-2 border-blue-100 p-4">
                        <p className="font-semibold text-sm mb-1.5">{imp.title}</p>
                        <p className="text-xs text-neutral-600 mb-3 leading-relaxed">{imp.description}</p>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{imp.impact}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'seo' && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">SEO Score</p>
                        <span className="text-2xl font-bold text-orange-500">31/100</span>
                      </div>
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <p className="text-xs font-semibold text-yellow-800 mb-2">Keywords your actual buyers use</p>
                        <div className="flex flex-wrap gap-2">
                          {['ice retention 18 hours', 'leak-proof water bottle', 'fits car cupholder', 'gym water bottle gift', 'stainless insulated bottle'].map(kw => (
                            <span key={kw} className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs rounded-full font-medium">{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          'Add "ice retention 18+ hours" to listing title — appears in 341 five-star reviews unprompted',
                          'Add "fits standard car cupholders" as a bullet — a validated frustration in competitor reviews that you solve',
                          'Replace first listing bullet with the leak-proof claim, backed by your own QC process',
                        ].map(s => (
                          <div key={s} className="flex items-start gap-2 text-xs text-neutral-700 p-2 bg-blue-50 rounded-lg leading-relaxed">
                            <span className="text-blue-500 flex-shrink-0 mt-0.5">→</span>{s}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'marketing' && (
                  <div className="space-y-3">
                    <div className="mb-1">
                      <p className="text-sm font-semibold">Marketing copy</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Ready-to-paste phrases from real 5-star reviews</p>
                    </div>
                    {demoMarketingCopy.map((copy, i) => (
                      <div key={i} className="bg-white rounded-xl border border-purple-100 p-4 flex items-start justify-between gap-3">
                        <p className="text-xs text-neutral-700 italic leading-relaxed">{copy}</p>
                        <button onClick={() => navigator.clipboard.writeText(copy.replace(/^"|"$/g, ''))}
                          className="flex-shrink-0 px-2.5 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">Copy</button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'breakdown' && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Review breakdown by star</p>
                    <div className="bg-white rounded-xl border border-neutral-200 p-5">
                      <div className="space-y-3">
                        {demoStarBreakdown.map(({ star, count, pct }) => {
                          const barColor = star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'
                          return (
                            <div key={star} className="flex items-center gap-3">
                              <span className="text-yellow-400 text-sm w-20 flex-shrink-0">{'★'.repeat(star)}{'☆'.repeat(5 - star)}</span>
                              <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-neutral-600 w-28 text-right flex-shrink-0">{count} reviews ({pct}%)</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="text-center p-2.5 bg-red-50 rounded-xl"><p className="text-lg font-bold text-red-500">25%</p><p className="text-[10px] text-neutral-400">Unhappy buyers</p></div>
                        <div className="text-center p-2.5 bg-neutral-50 rounded-xl"><p className="text-lg font-bold text-neutral-500">8%</p><p className="text-[10px] text-neutral-400">Neutral</p></div>
                        <div className="text-center p-2.5 bg-green-50 rounded-xl"><p className="text-lg font-bold text-green-500">67%</p><p className="text-[10px] text-neutral-400">Happy buyers</p></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── COMPETITOR TAB ── */
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <Crosshair className="text-orange-500 flex-shrink-0" size={18} />
                <p className="text-sm text-orange-800 font-medium">Competitor analysis — see their weaknesses before they fix them</p>
              </div>

              {/* Score comparison */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`p-4 rounded-xl border ${sc.bg} ${sc.border}`}>
                  <p className="text-xs text-neutral-500 mb-1">Your mug</p>
                  <p className={`text-3xl font-black ${sc.text}`}>{DEMO_SCORE}</p>
                  <p className="text-xs text-neutral-500 mt-1">1,000 reviews</p>
                </div>
                <div className={`p-4 rounded-xl border ${csc.bg} ${csc.border}`}>
                  <p className="text-xs text-neutral-500 mb-1">Competitor mug</p>
                  <p className={`text-3xl font-black ${csc.text}`}>{COMP_SCORE}</p>
                  <p className="text-xs text-neutral-500 mt-1">900 reviews</p>
                </div>
              </div>

              {/* Their top complaints = your advantage */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Their top complaints = your advantage</p>
                <div className="space-y-2">
                  {compComplaints.filter(c => c.opportunity).map((c, i) => {
                    const isExpanded = compExpandedComplaint === i
                    return (
                      <div key={i} className="bg-white rounded-xl border-2 border-green-100 overflow-hidden">
                        <button onClick={() => setCompExpandedComplaint(isExpanded ? null : i)} className="w-full p-4 text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{c.severity}
                                </span>
                                <span className="text-xs text-neutral-500">{c.frequency}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                  Your opportunity
                                </span>
                              </div>
                              <p className="font-semibold text-sm">{c.title}</p>
                              <p className="text-xs text-neutral-600 italic mt-1.5 border-l-2 border-neutral-200 pl-2">{c.quote}</p>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`flex-shrink-0 text-neutral-400 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-green-100">
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                              <p className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Your opportunity — exact wording to use
                              </p>
                              <p className="text-xs text-green-900 leading-relaxed">{c.yourOpportunity}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* What they do well */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">What they do well (match or beat this)</p>
                <div className="space-y-2">
                  {compStrengths.map((s, i) => (
                    <div key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                      <div>
                        <p className="text-xs font-semibold text-neutral-800">{s.title}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{s.frequency} mention this</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Side-by-side comparison table */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Side-by-side comparison</p>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="grid grid-cols-3 bg-neutral-50 border-b border-neutral-200">
                    <div className="p-3 text-xs font-semibold text-neutral-500">Attribute</div>
                    <div className="p-3 text-xs font-semibold text-neutral-700 text-center">You</div>
                    <div className="p-3 text-xs font-semibold text-neutral-400 text-center">Competitor</div>
                  </div>
                  {[
                    { attr: 'Wall thickness', you: { label: '8mm', color: 'text-green-600', bg: 'bg-green-50' }, them: { label: '4mm', color: 'text-red-500', bg: 'bg-red-50' } },
                    { attr: 'Handle interior', you: { label: '42mm', color: 'text-green-600', bg: 'bg-green-50' }, them: { label: '28mm', color: 'text-red-500', bg: 'bg-red-50' } },
                    { attr: 'Glaze durability', you: { label: 'Fired 2300°F', color: 'text-green-600', bg: 'bg-green-50' }, them: { label: 'Peeling reported', color: 'text-red-500', bg: 'bg-red-50' } },
                    { attr: 'Shipping speed', you: { label: '4–6 days', color: 'text-orange-500', bg: 'bg-orange-50' }, them: { label: '2–3 days', color: 'text-green-600', bg: 'bg-green-50' } },
                    { attr: 'Price point', you: { label: '$35', color: 'text-neutral-700', bg: 'bg-neutral-50' }, them: { label: '$28', color: 'text-neutral-700', bg: 'bg-neutral-50' } },
                  ].map((row, i) => (
                    <div key={i} className={`grid grid-cols-3 border-b border-neutral-100 last:border-b-0 ${i % 2 === 0 ? '' : 'bg-neutral-50/40'}`}>
                      <div className="p-3 text-xs text-neutral-600">{row.attr}</div>
                      <div className="p-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.you.color} ${row.you.bg}`}>{row.you.label}</span>
                      </div>
                      <div className="p-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.them.color} ${row.them.bg}`}>{row.them.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action plan */}
              <div className="p-4 bg-black text-white rounded-xl">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Your action plan</p>
                <ul className="space-y-2">
                  {[
                    'Add "thick stoneware walls, chip-resistant" to your listing title — 203 of their buyers complain about thin walls chipping',
                    'Add your handle interior diameter (42mm) to listing specs — their buyers explicitly say the 28mm handle is unusable',
                    'Improve shipping to under 3 days — fast shipping is their strongest loyalty driver with 187 reviews mentioning it',
                    'Mention dishwasher-safe glaze certification in your first photo caption — their buyers are nervous about glaze peeling after 67 reports',
                  ].map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                      <span className="text-orange-400 flex-shrink-0 mt-0.5 font-bold">{i + 1}.</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
