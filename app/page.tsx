'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import CheckoutButton from '@/app/components/CheckoutButton'
import AuthModal from '@/app/components/AuthModal'
import { Coffee, Search, Crosshair, Zap, PenLine, MessageCircle, Layers, BarChart2, Bell, Puzzle, RefreshCw, Gift, HelpCircle, AlertCircle, ThumbsUp, Wrench, TrendingUp, Megaphone, Star } from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────
function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return { text: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100' }
}

const DEMO_SCORE = 28
const sc = scoreColor(DEMO_SCORE)
const COMP_SCORE = 54
const csc = scoreColor(COMP_SCORE)

const googleOAuthOptions = (origin: string) => ({
  redirectTo: `${origin}/auth/callback`,
  queryParams: { access_type: 'offline', prompt: 'consent' },
})

function CsvGuide({ show, onToggle, onClose }: { show: boolean; onToggle: () => void; onClose: () => void }) {
  return (
    <div className="relative inline-block">
      <button onClick={onToggle} className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2 transition-colors">
        How to export from Amazon?
      </button>
      {show && (
        <div className="absolute right-0 top-6 z-50 w-64 bg-black text-white text-xs rounded-xl p-4 shadow-xl">
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-black rotate-45" />
          <p className="font-semibold mb-2">Export your reviews from Amazon:</p>
          <ol className="space-y-1.5 text-neutral-300">
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">1.</span>Use a tool like <strong className="text-white">Helium 10</strong> or <strong className="text-white">Jungle Scout</strong> to export reviews as CSV</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">2.</span>Or use Amazon's <strong className="text-white">Request My Data</strong> feature in your account settings</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">3.</span>Make sure the CSV has a <strong className="text-white">rating</strong> column and a <strong className="text-white">review text</strong> column</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">4.</span>Upload it here — analysis runs in under 60 seconds</li>
          </ol>
          <button onClick={onClose} className="mt-3 text-neutral-400 hover:text-white text-[10px]">Got it ✕</button>
        </div>
      )}
    </div>
  )
}

// ── demo data ─────────────────────────────────────────────────
const demoComplaints = [
  {
    title: 'Handle snaps at the base after 3–6 weeks',
    severity: 'CRITICAL', frequency: '187 of 1,000 reviews',
    quote: '"snapped clean off while I was lifting it — completely unusable after 3 weeks of daily use"',
    description: 'Reviewers consistently describe the break happening at the lower attachment point after 3–6 weeks of daily use. This complaint accounts for 71% of all 1-star reviews.',
    revenueImpact: '19% of buyers affected — at $35/mug, each return costs ~$8–15 in shipping plus the unit cost',
    riskIfIgnored: 'Each new 1-star review pushes your listing down Amazon search — at current velocity, your ranking will drop measurably within 60 days',
    fixes: [
      { simple: 'Score both surfaces before joining the handle, use slip, and dry slowly covered in plastic — prevents the crack that forms when parts dry at different rates', why: '187 of 1,000 reviewers reported this, generating returns and active dispute cases' },
      { simple: 'Add a small clay coil to reinforce the inside of the lower handle join before firing — this is where reviewers say the break happens', why: 'Targets the exact failure point reviewers describe' },
      { simple: 'Add a care card with hand wash instructions and thermal shock warning — sets expectations before the 3–6 week failure window', why: 'Reduces dispute rate without requiring production changes' },
    ]
  },
  {
    title: 'Glaze color significantly darker than photos',
    severity: 'MEDIUM', frequency: '134 of 1,000 reviews',
    quote: '"expected the light sage green from the photos — what arrived was closer to army green, I felt completely misled"',
    description: 'Color complaints cluster in 2★ and 3★ reviews from buyers selecting for specific color-matched home decor projects. Each color complaint carries a 40% chance of a return request.',
    revenueImpact: '13% of buyers affected — color returns are the most time-intensive to resolve',
    riskIfIgnored: '"Not as described" reviews — Amazon weights these heavily in dispute resolution',
    fixes: [
      { simple: 'Reshoot on a cloudy day near a north-facing window — eliminates the warm color shift that makes your glaze look darker than it is', why: 'Zero cost fix that eliminates the root cause of 134 complaints' },
      { simple: 'Add a color note: "Photos taken in natural daylight — colors may vary slightly on warm-toned screens"', why: 'Reduces return rate and protects against Amazon dispute resolutions' },
    ]
  },
  {
    title: 'Packaging offers no transit protection',
    severity: 'LOW', frequency: '43 of 1,000 reviews',
    quote: '"the box was completely caved in — the mug survived but I was shaking opening it, zero padding inside"',
    description: 'Single-wall boxes with no internal padding are transmitting transit impacts directly to the ceramic.',
    revenueImpact: '4% of buyers affected — each damaged arrival generates a return, replacement cost, and a probable 1-star review',
    riskIfIgnored: '"Arrived broken" has zero ambiguity and Amazon sides with the buyer in disputes',
    fixes: [
      { simple: 'Switch to a double-wall box with foam inserts on all sides so the mug cannot move', why: '~$1.05/unit cost increase eliminates the transit damage reviews' },
    ]
  },
]

const demoStrengths = [
  {
    title: 'Heat retention excites daily coffee drinkers',
    frequency: '312 of 1,000 reviews',
    quote: '"still hot after 45 minutes — I keep forgetting about my coffee and it\'s always still drinkable."',
    segment: 'Daily coffee and tea drinkers, aged 28–45',
    summary: 'Heat retention is the single most-mentioned feature in your 5-star reviews — appearing in 31% of all feedback without any prompting. This phrase does not appear in your listing title or tags — it is invisible to search.',
    businessImpact: 'Adding "keeps coffee hot 45+ minutes" to your title targets a validated search term your own customers already use.',
    marketingAngle: '"still hot after 45 minutes — nothing else I\'ve owned does this."',
  },
  {
    title: 'Gift buyers describe it as luxury and gift-worthy',
    frequency: '198 of 1,000 reviews',
    quote: '"gave this as a birthday gift and she immediately asked where I got it — feels expensive"',
    segment: 'Gift buyers aged 30–55, milestone occasions',
    summary: 'Gift buyers spend 40% more per transaction and write the most detailed 5-star reviews. "Feels expensive" appears in 89 reviews verbatim.',
    businessImpact: 'Adding gift-wrapping as an option and "perfect gift" language to your first listing photo would capture gift-search traffic you are currently losing.',
    marketingAngle: '"feels expensive, way more substantial than anything at this price point"',
  },
]

const demoImprovements = [
  { title: 'Add dimensions and capacity as your first listing line', description: '67 reviews mention surprise at the mug size. Adding "Height: 4.1 inches · Capacity: 14oz" as the very first line eliminates the single most common pre-purchase uncertainty and ranks you for capacity-specific searches.', impact: 'Reduces size-related returns + captures dimension-specific search traffic' },
  { title: 'Move "keeps coffee hot" into your listing title', description: 'Your 5-star reviewers independently use "keeps coffee hot" in 312 reviews. None of these phrases appear in your title or bullet points. Your strongest selling point is invisible to Amazon search.', impact: 'Captures validated search intent your existing customers already proved' },
]

const demoMarketingCopy = [
  '"still hot after 45 minutes — I keep forgetting about my coffee and it\'s always still drinkable."',
  '"gave this as a birthday gift and she immediately asked where I got it — feels expensive"',
  '"this mug has completely spoiled me for everything else in my cabinet. Perfect weight, perfect handle."',
  '"I bought this for myself and immediately ordered two more as gifts. The craftsmanship is extraordinary."',
]

const demoStarBreakdown = [
  { star: 5, count: 520, pct: 52 }, { star: 4, count: 150, pct: 15 },
  { star: 3, count: 80,  pct: 8  }, { star: 2, count: 110, pct: 11 },
  { star: 1, count: 140, pct: 14 },
]

const compComplaints = [
  { title: 'Thin walls chip easily', severity: 'CRITICAL', frequency: '203 of 900 reviews', opportunity: true,
    quote: '"the rim chipped on the second wash — felt like cheap porcelain, not the artisan quality they advertise"',
    yourOpportunity: 'Add "thick stoneware walls — chip-resistant" to your title and first listing bullet. Buyers who\'ve been burned by thin-walled mugs search specifically for this. Your wall thickness is 8mm vs their estimated 4mm.' },
  { title: 'Handle too small for large hands', severity: 'MEDIUM', frequency: '98 of 900 reviews', opportunity: true,
    quote: '"I have average-sized hands and I can barely fit two fingers in — completely unusable as a morning coffee mug"',
    yourOpportunity: 'Mention your handle interior diameter (yours is 42mm) in the listing specs. Add "ergonomic handle — fits all hand sizes" to your listing description. This is a validated frustration their buyers have that yours don\'t.' },
  { title: 'Glaze peeling after dishwasher', severity: 'MEDIUM', frequency: '67 of 900 reviews', opportunity: false,
    quote: '"after 3 dishwasher cycles the glaze started peeling at the base — not food safe anymore"',
    yourOpportunity: 'Highlight your food-safe, dishwasher-safe glaze certification in the listing. Their buyers are already nervous about this — capitalize on it.' },
]

const compStrengths = [
  { title: 'Beautiful minimalist design', frequency: '290 reviews' },
  { title: 'Fast shipping praised', frequency: '187 reviews' },
]

// ── Inline stats strip (below hero URL bar) ───────────────────
function useCountUp(target: number, duration: number, triggered: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!triggered) return
    let current = 0
    const step = Math.ceil(target / (duration / 16))
    const timer = setInterval(() => {
      current += step
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(current)
    }, 16)
    return () => clearInterval(timer)
  }, [triggered, target, duration])
  return count
}

function InlineStats() {
  const ref = useRef<HTMLDivElement>(null)
  const [triggered, setTriggered] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setTriggered(true); obs.disconnect() }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const reviews = useCountUp(3000, 1600, triggered)

  return (
    <div ref={ref} className="mt-5 flex flex-wrap items-center justify-center gap-2 scroll-fade">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-white font-medium">
          <span className="text-orange-400 font-black">{reviews.toLocaleString()}+</span> reviews analyzed
        </span>
        <span className="text-neutral-600 text-xs">·</span>
        <span className="text-xs text-neutral-300">avg. ~1 min 20 sec per analysis</span>
      </div>
    </div>
  )
}

// ── FAQ Section component ──────────────────────────────────────
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

function FaqSection() {
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

const HERO_HEADLINES = [
  { stat: '99.9% of shoppers read reviews before buying.', action: 'Most sellers never find out what those reviews are actually saying.' },
  { stat: 'A 1-star improvement lifts conversion by 4–5%.', action: 'Your reviews are telling you exactly how to get there.' },
  { stat: 'Only 5% of sellers respond to their reviews.', action: 'Even fewer actually fix the problems inside them.' },
]

function HeroHeadline() {
  const [idx, setIdx]       = useState(0)
  const [phase, setPhase]   = useState<'in' | 'out'>('in')

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase('out')
      setTimeout(() => {
        setIdx(i => (i + 1) % HERO_HEADLINES.length)
        setPhase('in')
      }, 420)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const h = HERO_HEADLINES[idx]
  return (
    <div className="min-h-[140px] flex flex-col items-center justify-center mb-5">
      <h1
        key={idx}
        className={`text-3xl md:text-4xl lg:text-5xl font-bold tracking-normal leading-[1.15] text-center ${phase === 'in' ? 'hero-rotate-in' : 'hero-rotate-out'}`}
      >
        {h.stat}<br />{h.action}
      </h1>
      <div className="flex gap-1.5 mt-4 justify-center">
        {HERO_HEADLINES.map((_, i) => (
          <button key={i} onClick={() => { setPhase('out'); setTimeout(() => { setIdx(i); setPhase('in') }, 420) }}
            className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-neutral-300'}`}
            aria-label={`Headline ${i + 1}`} />
        ))}
      </div>
    </div>
  )
}

function HeroDashboardMockup() {
  return (
    <div className="relative w-full max-w-xs mx-auto md:mx-0 select-none" aria-hidden="true">
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-orange-500/10 rounded-3xl blur-2xl" />
      <div className="relative bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden text-left">
        {/* Header bar */}
        <div className="bg-neutral-900 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"/><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"/><span className="w-2.5 h-2.5 rounded-full bg-green-400"/></div>
          <span className="text-[10px] text-neutral-400 ml-2 font-mono truncate">voxrate.app/dashboard/report</span>
        </div>
        {/* Product row */}
        <div className="px-4 pt-4 pb-3 border-b border-neutral-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-neutral-400 mb-0.5">Amazon · B08N5WRWNW</p>
            <p className="text-sm font-semibold leading-tight">Premium Stainless<br/>Water Bottle 32oz</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-yellow-400 text-xs">★★★</span>
              <span className="text-[10px] text-neutral-500">3.1 · 2,847 reviews</span>
            </div>
          </div>
          <div className="text-center bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex-shrink-0">
            <p className="text-[10px] text-neutral-500">Health</p>
            <p className="text-2xl font-black text-red-500">34</p>
            <p className="text-[10px] text-neutral-400">/100</p>
          </div>
        </div>
        {/* Quick win */}
        <div className="mx-4 mt-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-3">
          <p className="text-[9px] font-semibold text-orange-100 uppercase tracking-wider mb-1">⚡ Quick Win</p>
          <p className="text-xs font-semibold text-white leading-snug">Add "leak-proof lid" to your title — fixes 43% of 1-star reviews</p>
        </div>
        {/* Complaints */}
        <div className="px-4 pt-3 pb-4 space-y-2">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Top complaints</p>
          {[
            { label: 'Lid leaks under pressure', pct: 43, color: 'bg-red-500' },
            { label: 'Coating peels after 2 months', pct: 28, color: 'bg-orange-400' },
            { label: 'Arrived dented', pct: 19, color: 'bg-yellow-400' },
          ].map(c => (
            <div key={c.label}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-neutral-600 truncate pr-2">{c.label}</span>
                <span className="text-neutral-400 flex-shrink-0">{c.pct}%</span>
              </div>
              <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Floating badge */}
      <div className="absolute -bottom-2 -right-2 bg-black text-white text-[9px] font-semibold px-2 py-1 rounded-full shadow-lg">
        Voxrate fix ✓
      </div>
    </div>
  )
}

function SocialProofSection() {
  return (
    <section className="py-20 px-6 bg-neutral-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">The research is clear</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Amazon reviews are your biggest lever.<br/>Almost no one pulls it.</h2>
          <p className="text-sm text-neutral-400 max-w-xl mx-auto">These numbers come from independent research — not our marketing team.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {[
            {
              stat: '84%',
              claim: 'of Amazon sellers say reviews are "extremely or very important" to their business',
              source: 'eComEngine — Impact of Amazon Reviews, 200+ sellers surveyed',
              year: '2024',
              color: 'border-orange-500/30 bg-orange-500/5',
              statColor: 'text-orange-400',
            },
            {
              stat: '20×',
              claim: 'It takes 20+ five-star reviews to undo the damage of just one negative review',
              source: 'Seller Labs — Negative Review Recovery Study',
              year: '2024',
              color: 'border-red-500/30 bg-red-500/5',
              statColor: 'text-red-400',
            },
            {
              stat: '4–5%',
              claim: 'conversion rate lift for every 1-star improvement in your Amazon rating',
              source: 'Pattern Research — Amazon Star Rating Conversion Analysis',
              year: '2024',
              color: 'border-green-500/30 bg-green-500/5',
              statColor: 'text-green-400',
            },
            {
              stat: '69%',
              claim: 'of Amazon sellers are stagnant or losing money — only 23% are genuinely thriving',
              source: 'Marketplace Pulse — Seller Index 2026',
              year: '2026',
              color: 'border-blue-500/30 bg-blue-500/5',
              statColor: 'text-blue-400',
            },
          ].map(s => (
            <div key={s.stat} className={`rounded-2xl border p-6 ${s.color}`}>
              <p className={`text-5xl font-black mb-3 ${s.statColor}`}>{s.stat}</p>
              <p className="text-sm text-white font-medium leading-snug mb-3">{s.claim}</p>
              <p className="text-[10px] text-neutral-500 leading-relaxed">{s.source} · {s.year}</p>
            </div>
          ))}
        </div>

        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-5 text-center">What independent research says about the problem</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                quote: 'Getting more reviews and managing negative reviews are the two biggest challenges Amazon sellers face — cited by over 200 active sellers surveyed.',
                attribution: 'eComEngine — Impact of Amazon Reviews Survey, 2024',
              },
              {
                quote: 'Only 1–2% of Amazon buyers leave a review. That means a single unhappy buyer who does write one carries disproportionate weight on your listing score.',
                attribution: 'Multiple sources including Jungle Scout Seller Report, 2024',
              },
              {
                quote: '45% of sellers receive fewer than 30 new reviews per month — yet each negative review in that small pool can meaningfully drop the overall rating.',
                attribution: 'eComEngine — 200+ Sellers Surveyed, 2024',
              },
            ].map((q, i) => (
              <div key={i} className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700/50">
                <p className="text-sm text-neutral-200 leading-relaxed mb-3 italic">"{q.quote}"</p>
                <p className="text-[10px] text-neutral-500">{q.attribution}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-neutral-800 text-center">
            <p className="text-sm text-neutral-300 mb-1">Voxrate is built to solve exactly this — automatically, in under 2 minutes.</p>
            <p className="text-xs text-neutral-500">Paste your Amazon URL and get a full breakdown of what's hurting your score and how to fix it.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const [heroUrl, setHeroUrl]         = useState('')
  const [heroUrlError, setHeroUrlError] = useState('')
  const [ctaUrl, setCtaUrl]           = useState('')
  const [ctaUrlError, setCtaUrlError] = useState('')
  const [pricingTab, setPricingTab]   = useState<'packs' | 'subscription'>('subscription')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<{ step?: 'plan' | 'auth'; authMode?: 'signup' | 'login' }>({})
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [nlEmail, setNlEmail]         = useState('')
  const [nlSubmitted, setNlSubmitted] = useState(false)
  const [nlError, setNlError]         = useState(false)
  const [csvMsg, setCsvMsg]           = useState('')
  const [activeTab, setActiveTab]     = useState('complaints')
  const [expandedComplaint, setExpandedComplaint] = useState<number | null>(0)
  const [compExpandedComplaint, setCompExpandedComplaint] = useState<number | null>(0)
  const [footerNlEmail, setFooterNlEmail]   = useState('')
  const [footerNlSubmitted, setFooterNlSubmitted] = useState(false)
  const [showCsvGuide, setShowCsvGuide] = useState(false)
  const [csvFile, setCsvFile]         = useState<File | null>(null)
  const [csvFileText, setCsvFileText] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [productName, setProductName] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productNameError, setProductNameError] = useState('')
  const [productCategoryError, setProductCategoryError] = useState('')
  const [calcProducts, setCalcProducts] = useState(5)
  const [calcFrequency, setCalcFrequency] = useState<'monthly' | 'quarterly'>('monthly')
  const nlDropdownRef = useRef<HTMLDivElement>(null)
  const [supabase] = useState(() => createClient())

  const saveNewsletter = async (email: string) => {
    try { await supabase.from('newsletter_emails').insert({ email }) } catch {}
  }

  useEffect(() => {
    const els = document.querySelectorAll('.scroll-fade')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
    }, { threshold: 0.1 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!showNewsletter) return
    const handler = (e: MouseEvent) => {
      if (nlDropdownRef.current && !nlDropdownRef.current.contains(e.target as Node)) setShowNewsletter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNewsletter])

  const signIn = useCallback(async (url: string, requireUrl = false) => {
    if (requireUrl) {
      if (!url.trim()) return { error: 'Please paste an Amazon product URL or ASIN first' }
      if (!url.includes('amazon.com') && !/^[A-Z0-9]{10}$/i.test(url.trim())) return { error: 'Please paste a valid Amazon URL or ASIN' }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (requireUrl) {
      try { localStorage.setItem('pendingUrl', url) } catch { return { error: 'Browser storage unavailable. Please enable cookies.' } }
    }
    if (user) { window.location.href = '/dashboard'; return { error: null } }
    // Not logged in — show auth modal with plan picker so user signs up properly
    setAuthModalMode({ step: 'plan' })
    setShowAuthModal(true)
    return { error: null }
  }, [supabase])

  const analyzeHero = async () => { const r = await signIn(heroUrl, true); if (r?.error) setHeroUrlError(r.error) }
  const analyzeCta  = async () => { const r = await signIn(ctaUrl,  true); if (r?.error) setCtaUrlError(r.error) }
  const openCsv = () => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAuthModalMode({ step: 'plan' }); setShowAuthModal(true); return }
      document.getElementById('csv-in')?.click()
    })
  }

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) { setCsvMsg('Please upload a .csv file'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvFile(f); setCsvFileText(ev.target?.result as string)
      setProductName(''); setProductCategory(''); setProductPrice('')
      setProductNameError(''); setProductCategoryError('')
      setShowProductModal(true); setCsvMsg('')
    }
    reader.readAsText(f)
    setCsvMsg(`Reading "${f.name}"...`)
  }

  const submitCsvWithProductInfo = async () => {
    if (!productName.trim()) { setProductNameError('Please enter your product name'); return }
    if (!productCategory.trim()) { setProductCategoryError('Please select a category'); return }
    if (!csvFile || !csvFileText) return
    setShowProductModal(false)
    setCsvMsg(`Preparing "${csvFile.name}"...`)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    const storeData = () => {
      try {
        localStorage.setItem('pendingCsvContent', csvFileText)
        localStorage.setItem('pendingCsvName', csvFile.name)
        localStorage.setItem('pendingCsvProductName', productName.trim())
        localStorage.setItem('pendingCsvProductCategory', productCategory.trim())
        localStorage.setItem('pendingCsvPrice', productPrice.trim())
        return true
      } catch { setCsvMsg('File too large to store. Please try a smaller CSV.'); return false }
    }
    if (user) { if (!storeData()) return; window.location.href = '/dashboard'; return }
    if (!storeData()) return
    await supabase.auth.signInWithOAuth({ provider: 'google', options: googleOAuthOptions(window.location.origin) })
  }

  // Credit calculator logic
  const creditsNeeded = calcFrequency === 'monthly'
    ? calcProducts * 24
    : Math.ceil(calcProducts * 24 / 3)
  const packRecommendation = creditsNeeded <= 100 ? { name: 'Starter Pack', credits: 100, price: 4.99 }
    : creditsNeeded <= 300 ? { name: 'Growth Pack', credits: 300, price: 12.99 }
    : { name: 'Pro Pack', credits: 700, price: 24.99 }
  const subRecommendation = creditsNeeded <= 300 ? { name: 'Starter', price: 9.99, credits: 300 }
    : creditsNeeded <= 800 ? { name: 'Growth', price: 24.99, credits: 800 }
    : { name: 'Pro', price: 49.99, credits: 2000 }

  const featureItems: { icon: React.ReactNode; title: string; desc: string; badge: string; soon?: boolean }[] = [
    { icon: <Search className="text-orange-500" size={18} />, title: 'Review Analysis', desc: 'Deep AI analysis of every review — complaints ranked by severity, strengths by frequency, with exact step-by-step fixes.', badge: 'Core feature' },
    { icon: <Crosshair className="text-orange-500" size={18} />, title: 'Competitor Spy', desc: "Analyze any competitor's listing. See their weaknesses before they fix them. Turn their problems into your positioning.", badge: 'Growth & Pro' },
    { icon: <Zap className="text-orange-500" size={18} />, title: 'Listing Grader', desc: 'Get an A–F grade on your title, tags, description and pricing separately — with specific fixes for each.', badge: 'Free tool' },
    { icon: <PenLine className="text-orange-500" size={18} />, title: 'AI Description Rewriter', desc: 'Rewrite your listing description using your own review keywords and insights. SEO-optimized in one click.', badge: 'Free tool' },
    { icon: <MessageCircle className="text-orange-500" size={18} />, title: 'Review Reply Generator', desc: '3 ready-to-paste reply options for any review — empathetic, professional, or personal tone.', badge: 'Free tool' },
    { icon: <Layers className="text-orange-500" size={18} />, title: 'AI Listing Builder', desc: 'Generate a complete listing from scratch — title options, 13 SEO tags, and full description from a short prompt.', badge: 'Free tool' },
    { icon: <BarChart2 className="text-orange-500" size={18} />, title: 'Shop Health Score', desc: "See your entire shop's health at a glance — aggregated score, top recurring complaints, and 3 priority actions.", badge: 'Free' },
    { icon: <Bell className="text-orange-500" size={18} />, title: 'Review Monitoring', desc: 'Automatic weekly re-analysis. Get alerts the moment your score drops or new complaints appear.', badge: 'Coming soon', soon: true },
    { icon: <Puzzle className="text-orange-500" size={18} />, title: 'Chrome Extension', desc: 'Analyze any Amazon listing instantly while browsing — without leaving the page. One-click access to full reports.', badge: 'Coming soon', soon: true },
  ]

  const creditItems: { action: string; cost: string; icon: React.ReactNode; free?: boolean }[] = [
    { action: 'Own product analysis',    cost: '20 credits', icon: <Search className="text-orange-500" size={18} /> },
    { action: 'Competitor analysis',     cost: '35 credits', icon: <Crosshair className="text-orange-500" size={18} /> },
    { action: 'Re-analyze listing',      cost: '20 credits', icon: <RefreshCw className="text-orange-500" size={18} /> },
    { action: 'All tools (rewrite, reply, grade, builder)', cost: 'FREE', icon: <Gift className="text-green-500" size={18} />, free: true },
  ]

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-neutral-900" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {showAuthModal && (
        <AuthModal
          onClose={() => { setShowAuthModal(false); setAuthModalMode({}) }}
          initialStep={authModalMode.step}
          initialAuthMode={authModalMode.authMode}
        />
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        html { scroll-behavior: smooth; }
        .glow { position: relative; transition: box-shadow 0.3s ease, background 0.2s ease; }
        .glow:hover { box-shadow: 0 0 0 2px #000, 0 0 18px 4px rgba(249,115,22,0.5); }
        .bdg:hover .bdot { animation: blink 1.1s ease infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.1} }
        .pcard { transition: transform 0.22s ease, box-shadow 0.22s ease; position: relative; }
        .pcard:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 0 0 2px rgba(249,115,22,0.4), 0 16px 48px rgba(249,115,22,0.15); z-index: 2; }
        .ndrop { animation: ndwn 0.18s ease forwards; }
        @keyframes ndwn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .hero-fade { animation: herofade 0.8s ease forwards; }
        @keyframes herofade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .hero-rotate-in  { animation: heroIn  0.6s ease forwards; }
        .hero-rotate-out { animation: heroOut 0.4s ease forwards; }
        @keyframes heroIn  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes heroOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-14px)} }
        .scroll-fade { opacity:0; transform:translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .scroll-fade.visible { opacity:1; transform:translateY(0); }
        .feat-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .feat-card:hover { transform: translateY(-3px); box-shadow: 0 0 0 2px rgba(249,115,22,0.3), 0 8px 32px rgba(249,115,22,0.12); }
        .step-connector { background: linear-gradient(90deg, #f97316, #fb923c); }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#FAF9F6]/85 backdrop-blur-lg border-b border-neutral-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/"><img src="/logo.png" alt="Voxrate" height={36} style={{ objectFit: 'contain', maxWidth: 160 }} /></a>
          <div className="hidden md:flex items-center gap-7 text-sm text-neutral-600">
            <a href="#features"    className="hover:text-black transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-black transition-colors">How it works</a>
            <a href="#pricing"     className="hover:text-black transition-colors">Pricing</a>
            <div className="relative" ref={nlDropdownRef}>
              <button onClick={() => setShowNewsletter(v => !v)} className="hover:text-black transition-colors">Newsletter</button>
              {showNewsletter && (
                <div className="ndrop absolute top-9 left-1/2 -translate-x-1/2 w-72 bg-white border border-neutral-200 rounded-2xl p-4 shadow-xl z-10">
                  {nlSubmitted ? (
                    <p className="text-sm text-green-600 font-medium text-center py-2">Thanks! We'll be in touch.</p>
                  ) : (
                    <>
                      <p className="text-xs text-neutral-500 mb-3">Get notified about new features and exclusive discounts</p>
                      <div className="flex gap-2">
                        <input type="email" value={nlEmail} onChange={e => { setNlEmail(e.target.value); setNlError(false) }}
                          placeholder="your@email.com"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-orange-400 transition-colors ${nlError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`} />
                        <button onClick={async () => {
                          if (!nlEmail || !nlEmail.includes('@') || !nlEmail.includes('.')) { setNlError(true); return }
                          await saveNewsletter(nlEmail); setNlSubmitted(true); setNlEmail('')
                          setTimeout(() => { setShowNewsletter(false); setNlSubmitted(false) }, 2500)
                        }} className="px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-700 transition-colors">Join</button>
                      </div>
                      {nlError && <p className="text-xs text-red-500 mt-1.5">Please enter a valid email</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setAuthModalMode({ step: 'auth', authMode: 'login' }); setShowAuthModal(true) }}
              className="text-sm text-neutral-600 hover:text-black hidden sm:block transition-colors bg-transparent border-none cursor-pointer p-0">Login</button>
            <button onClick={() => setShowAuthModal(true)}
              className="glow px-5 py-2.5 text-sm font-medium rounded-full bg-black text-white hover:bg-neutral-800 transition-colors">
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
            {/* Left: text + input */}
            <div className="flex-1 text-center">
              <div className="bdg inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-700 mb-3 cursor-default select-none">
                <span className="bdot w-1.5 h-1.5 rounded-full bg-orange-500" />
                TURN REVIEWS INTO REVENUE
              </div>
              <p className="text-sm text-neutral-500 mb-3 max-w-lg mx-auto">
                You're getting reviews. You don't know what they're actually costing you.
              </p>
              <HeroHeadline />
              <p className="text-sm text-neutral-500 mb-6 max-w-lg mx-auto">The Amazon review analyzer that turns customer feedback into specific, actionable improvements</p>

              <div className="max-w-lg mx-auto">
                <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm transition-colors ${heroUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
                  <label htmlFor="hero-url" className="sr-only">Amazon product URL or ASIN</label>
                  <input id="hero-url" type="url" value={heroUrl} onChange={e => { setHeroUrl(e.target.value); setHeroUrlError('') }}
                    onKeyDown={e => e.key === 'Enter' && analyzeHero()}
                    placeholder="Paste your Amazon URL or ASIN..."
                    className="flex-1 px-4 py-3 text-sm bg-transparent outline-none placeholder:text-neutral-400" />
                  <button onClick={analyzeHero} className="glow px-5 py-3 bg-black text-white font-medium rounded-xl whitespace-nowrap text-sm">
                    <span className="block leading-tight">Analyze →</span>
                    <span className="block text-[10px] text-neutral-400 font-normal leading-tight mt-0.5">First analysis free</span>
                  </button>
                </div>
                {heroUrlError && <p className="text-xs text-red-500 mt-2 text-left px-1">{heroUrlError}</p>}

                <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-neutral-500">
                  {['First analysis free', 'No credit card required', 'Specific fixes, not guesses'].map(t => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-green-500" />{t}
                    </span>
                  ))}
                </div>
                <InlineStats />
              </div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="w-full md:w-auto md:flex-shrink-0 md:w-[300px] lg:w-[340px]">
              <HeroDashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="py-20 px-6 bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-4">Live Demo</p>
            <div className="flex justify-center mb-3">
              <div className="relative inline-block text-left">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="absolute -top-4 -left-6 opacity-20" style={{ color: '#f97316' }}>
                  <text x="0" y="48" fontSize="64" fill="#f97316" fontFamily="Georgia, serif">"</text>
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
                    <p className="text-sm font-semibold">Switch to stoneware clay and increase handle thickness to 9mm — eliminates 71% of 1-star reviews</p>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Eliminates 71% of complaints</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">~$120 supplier upgrade</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 px-6 pt-4 overflow-x-auto pb-1">
                  {[
                    { id: 'complaints',   label: 'Problems',       icon: <AlertCircle size={12} /> },
                    { id: 'strengths',    label: 'Strengths',      icon: <ThumbsUp size={12} /> },
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
                          <p className="text-xs text-neutral-600 italic mb-3 border-l-2 border-green-200 pl-2">"{s.quote}"</p>
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
                            {['keeps coffee hot', 'substantial and gift-worthy', 'handmade ceramic mug gift', 'stays warm 45 minutes', 'hand thrown pottery'].map(kw => (
                              <span key={kw} className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs rounded-full font-medium">{kw}</span>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {[
                            'Add "keeps coffee hot 45+ minutes" to listing title — appears in 312 five-star reviews',
                            'Add "substantial and gift-worthy" as a backend keyword — gift buyers who search this spend 40% more',
                            'Replace first listing bullet with the heat retention claim backed by your own reviews',
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

      <SocialProofSection />

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 scroll-fade">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Everything you need</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">One tool. Every edge.</h2>
            <p className="text-sm text-neutral-500 max-w-xl mx-auto">From diagnosing why buyers leave to generating the copy that makes them stay — all in one dashboard</p>
          </div>

          {/* Core paid features — big cards */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            {featureItems.slice(0, 2).map((f) => (
              <div key={f.title} className="feat-card bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed mb-3">{f.desc}</p>
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">{f.badge}</span>
              </div>
            ))}
          </div>

          {/* Free tools — compact grid */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 scroll-fade mb-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Also included free on every plan</p>
            <div className="grid md:grid-cols-2 gap-3">
              {featureItems.slice(2, 7).map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-neutral-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{f.title}</p>
                    <p className="text-xs text-neutral-400 leading-snug">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coming soon — small teaser */}
          <div className="flex flex-wrap gap-3 justify-center scroll-fade">
            {featureItems.slice(7).map((f) => (
              <div key={f.title} className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full text-xs text-neutral-500">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                {f.title} — coming soon
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 bg-white border-y border-neutral-200">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-sm text-neutral-600 mb-14">From listing URL to full action plan</p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {[
              {
                n: 1,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                title: 'Paste your Amazon URL or ASIN',
                body: "Drop in any Amazon product link or ASIN, or upload a CSV export of your reviews. No setup, no forms, no configuration.",
              },
              {
                n: 2,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
                title: 'AI analyzes every review',
                body: 'Our AI reads all your reviews, finds complaint patterns, hidden strengths, and buyer keywords specific to your listing.',
              },
              {
                n: 3,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
                title: 'Get your full action plan',
                body: 'See exactly what to fix, what to promote, and which words to add to your listing — grounded in real buyer language.',
              },
            ].map((s, idx) => (
              <div key={s.n} className="flex flex-col md:flex-row items-center">
                {/* Step card */}
                <div className="flex flex-col items-center text-center scroll-fade w-full md:w-64 px-4">
                  <div className="relative mb-5">
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-md border border-neutral-100 flex items-center justify-center mx-auto">
                      {s.icon}
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow">{s.n}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{s.body}</p>
                </div>
                {/* Arrow between steps only */}
                {idx < 2 && (
                  <div className="flex-shrink-0 my-4 md:my-0 md:mx-2 rotate-90 md:rotate-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="13 6 19 12 13 18"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="py-24 px-6 bg-[#FAF9F6]">
        <div className="max-w-3xl mx-auto scroll-fade">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Why Voxrate</p>
            <h2 className="text-3xl font-bold mb-3">Not all Amazon tools are equal</h2>
            <p className="text-sm text-neutral-500">Other tools tell you what buyers search for. We tell you what buyers actually say — and what to do about it.</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="grid grid-cols-3 bg-neutral-50 border-b border-neutral-200">
              <div className="p-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Feature</div>
              <div className="p-4 text-center">
                <span className="text-sm font-bold text-black">Voxrate</span>
              </div>
              <div className="p-4 text-center">
                <span className="text-sm font-semibold text-neutral-400">Others</span>
              </div>
            </div>
            {[
              { feature: 'Review sentiment analysis',      us: true,  them: false },
              { feature: 'Complaint patterns with fixes',  us: true,  them: false },
              { feature: 'SEO keywords from real buyers',  us: true,  them: 'partial' },
              { feature: 'Competitor review spy',          us: true,  them: false },
              { feature: 'AI description rewriter',        us: true,  them: 'partial' },
              { feature: 'Review reply generator',         us: true,  them: false },
              { feature: 'Shop health score',              us: true,  them: false },
              { feature: 'Listing grader (A–F)',           us: true,  them: 'partial' },
              { feature: 'Pay as you go (no subscription required)', us: true, them: false },
              { feature: 'Credits never expire',           us: true,  them: false },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 border-b border-neutral-100 ${i % 2 === 0 ? '' : 'bg-neutral-50/50'}`}>
                <div className="p-3.5 text-xs text-neutral-700">{row.feature}</div>
                <div className="p-3.5 text-center">
                  <span className="text-green-500 font-bold text-sm">✓</span>
                </div>
                <div className="p-3.5 text-center">
                  {row.them === true
                    ? <span className="text-green-400 text-sm">✓</span>
                    : row.them === 'partial'
                    ? <span className="text-xs text-orange-400 font-medium">Partial</span>
                    : <span className="text-neutral-300 text-sm">✗</span>
                  }
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-400 text-center mt-3">"Others" refers to general Amazon SEO tools. Comparison based on publicly available features.</p>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-neutral-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              {pricingTab === 'subscription' ? 'Your listing always improving' : 'Buy once, use forever'}
            </h2>
            <p className="text-sm text-neutral-500 mb-6 max-w-xl mx-auto">
              {pricingTab === 'subscription'
                ? 'Subscribe and get credits every month. Unused credits reset each month.'
                : 'Buy credits when you need them — they never expire. No subscription required.'}
            </p>
            <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
              {[{ id: 'subscription', label: 'Subscription' }, { id: 'packs', label: 'Credit packs' }].map(t => (
                <button key={t.id} onClick={() => setPricingTab(t.id as any)}
                  className={`px-4 py-1.5 text-sm rounded-full transition-all ${pricingTab === t.id ? 'bg-white shadow-sm font-medium' : 'text-neutral-500'}`}>
                  {t.label}
                  {t.id === 'subscription' && <span className="text-orange-500 text-xs ml-1">Save 2 months</span>}
                </button>
              ))}
            </div>
          </div>

          {pricingTab === 'subscription' && (
            <div className="flex items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 text-sm rounded-full border transition-all ${billingCycle === 'monthly' ? 'bg-black text-white border-black' : 'text-neutral-500 border-neutral-200'}`}
              >Monthly</button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-1.5 text-sm rounded-full border transition-all flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-black text-white border-black' : 'text-neutral-500 border-neutral-200'}`}
              >
                Annual
                <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">2 months free</span>
              </button>
            </div>
          )}

          {pricingTab === 'packs' ? (
            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {[
                {
                  name: 'Starter', id: 'starter_pack', credits: 100, price: 4.99, analyses: '≈ 5 own analyses', desc: 'Test the tool on your listing',
                  badge: null,
                  features: ['5 full own-listing analyses', '1 free competitor analysis included', 'Credits never expire', 'All free tools included'],
                  popular: false,
                },
                {
                  name: 'Growth', id: 'growth_pack', credits: 300, price: 12.99, analyses: '≈ 15 analyses', desc: 'Most popular top-up for active sellers',
                  badge: 'Most popular',
                  features: ['15 own analyses OR 8 competitor analyses', 'Competitor analysis included', 'Credits never expire', 'All free tools included'],
                  popular: true,
                },
                {
                  name: 'Pro', id: 'pro_pack', credits: 700, price: 24.99, analyses: '≈ 35 analyses', desc: 'Best value — lowest cost per analysis',
                  badge: 'Best value',
                  features: ['35 own analyses OR 20 competitor analyses', 'Lowest cost per credit ($0.036/cr)', 'Credits never expire', 'All free tools included'],
                  popular: false,
                },
              ].map(pack => (
                <div key={pack.name} className={`pcard p-6 rounded-2xl border relative ${pack.popular ? 'bg-black text-white border-black ring-2 ring-orange-500 ring-offset-2 scale-[1.04] z-10' : 'bg-white border-neutral-200'}`}>
                  {pack.badge && <div className="absolute top-4 right-4 px-2 py-0.5 text-xs bg-orange-500 rounded-full text-white">{pack.badge}</div>}
                  <h3 className={`font-semibold mb-1 ${pack.popular ? 'text-white' : ''}`}>{pack.name}</h3>
                  <p className={`text-xs mb-4 ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{pack.desc}</p>
                  <p className="text-4xl font-black mb-1">${pack.price}</p>
                  <p className={`text-xs mb-1 ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>one-time · never expires</p>
                  <div className={`my-4 p-3 rounded-xl ${pack.popular ? 'bg-white/10' : 'bg-orange-50'}`}>
                    <p className={`text-2xl font-black ${pack.popular ? 'text-orange-400' : 'text-orange-600'}`}>{pack.credits.toLocaleString()}</p>
                    <p className={`text-xs ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>credits · {pack.analyses}</p>
                  </div>
                  <ul className={`space-y-1.5 text-xs mb-6 ${pack.popular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {pack.features.map(f => (
                      <li key={f} className="flex gap-2"><span className={pack.popular ? 'text-orange-400' : 'text-green-500'}>✓</span>{f}</li>
                    ))}
                  </ul>
                  <CheckoutButton
                    pack={pack.id as any}
                    label={`Get ${pack.credits.toLocaleString()} credits →`}
                    className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${pack.popular ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-black hover:bg-neutral-800 text-white'}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {[
                {
                  name: 'Starter',
                  monthlyPrice: 9.99, annualPrice: 7.99,
                  credits: 300, analyses: '≈ 15 analyses/mo',
                  badge: null,
                  features: [
                    '300 credits every month',
                    '1 competitor analysis included — see exactly why they outsell you',
                    'Full own-listing reports, no limits',
                    'All free tools included',
                  ],
                  upsell: 'Want to track more competitors? Upgrade to Growth →',
                  btnLabel: 'Get 300 credits/mo →',
                  popular: false, plan: 'starter'
                },
                {
                  name: 'Growth',
                  monthlyPrice: 24.99, annualPrice: 19.99,
                  credits: 800, analyses: '≈ 40 analyses/mo',
                  badge: 'Most popular',
                  features: [
                    '800 credits every month',
                    'Competitor analysis unlocked — up to 3 per product/month',
                    'Side-by-side battle card vs any competitor',
                    'Full reports + SEO keyword gaps',
                    'Review monitoring & alerts',
                  ],
                  upsell: null,
                  btnLabel: 'Unlock competitor analysis →',
                  popular: true, plan: 'growth'
                },
                {
                  name: 'Pro',
                  monthlyPrice: 49.99, annualPrice: 39.99,
                  credits: 2000, analyses: '≈ 100 analyses/mo',
                  badge: 'Best value',
                  features: [
                    '2,000 credits every month',
                    'Up to 10 competitor analyses per product/month',
                    'Unlimited products tracked',
                    'CSV/PDF export for every report',
                    'Re-analyze free — no credits deducted',
                    'Priority email support',
                  ],
                  upsell: null,
                  btnLabel: 'Get 100 analyses/mo →',
                  popular: false, plan: 'pro'
                },
              ].map(sub => {
                const price = billingCycle === 'annual' ? sub.annualPrice : sub.monthlyPrice
                return (
                <div key={sub.name} className={`pcard p-6 rounded-2xl border relative ${sub.popular ? 'bg-black text-white border-black ring-2 ring-orange-500 ring-offset-2 scale-[1.04] z-10' : 'bg-white border-neutral-200'}`}>
                  {sub.badge && <div className="absolute top-4 right-4 px-2 py-0.5 text-xs bg-orange-500 rounded-full text-white">{sub.badge}</div>}
                  <h3 className={`font-semibold mb-1 ${sub.popular ? 'text-white' : ''}`}>{sub.name}</h3>
                  <div className="mb-1 mt-3">
                    <span className="text-4xl font-black">${price}</span>
                    <span className={`text-sm ml-1 ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>/month</span>
                    {billingCycle === 'annual' && (
                      <span className="ml-2 text-xs text-orange-500 font-medium">billed yearly</span>
                    )}
                  </div>
                  {billingCycle === 'annual' && (
                    <p className={`text-xs mb-1 ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      ${(sub.annualPrice * 12).toFixed(0)}/year — save ${((sub.monthlyPrice - sub.annualPrice) * 12).toFixed(0)}
                    </p>
                  )}
                  <div className={`my-4 p-3 rounded-xl ${sub.popular ? 'bg-white/10' : 'bg-orange-50'}`}>
                    <p className={`text-2xl font-black ${sub.popular ? 'text-orange-400' : 'text-orange-600'}`}>{sub.credits.toLocaleString()}</p>
                    <p className={`text-xs ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>credits/month · {sub.analyses}</p>
                  </div>
                  <ul className={`space-y-1.5 text-xs mb-4 ${sub.popular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {sub.features.map(f => (
                      <li key={f} className="flex gap-2"><span className={sub.popular ? 'text-orange-400' : 'text-green-500'}>✓</span>{f}</li>
                    ))}
                  </ul>
                  {sub.upsell && (
                    <p className="text-xs text-orange-500 font-medium mb-4 border border-orange-100 bg-orange-50 rounded-lg px-3 py-2">{sub.upsell}</p>
                  )}
                  <CheckoutButton plan={sub.plan as any} billing={billingCycle} label={sub.btnLabel}
                    className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${sub.popular ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-black hover:bg-neutral-800 text-white'}`}
                  />
                </div>
                )
              })}
            </div>
          )}

          {/* How credits work */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 mb-8 scroll-fade">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">How credits work</p>
            <div className="grid md:grid-cols-4 gap-3">
              {creditItems.map(item => (
                <div key={item.action} className={`p-3 rounded-xl border text-center ${item.free ? 'bg-green-50 border-green-100' : 'bg-white border-neutral-200'}`}>
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center mx-auto mb-2">
                    {item.icon}
                  </div>
                  <p className="text-xs text-neutral-600 mb-1">{item.action}</p>
                  <p className={`text-sm font-bold ${item.free ? 'text-green-600' : 'text-neutral-900'}`}>{item.cost}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 text-center mt-3">1 own-listing analysis = 20 credits · 1 competitor analysis = 35 credits · All other tools are free</p>
          </div>

          {/* Free tier note */}
          <div className="text-center mb-10">
            <p className="text-sm text-neutral-500">
              Not ready to pay?{' '}
              <button onClick={() => setShowAuthModal(true)} className="font-medium text-neutral-700 hover:text-black underline underline-offset-2 bg-transparent border-none cursor-pointer p-0">Start free</button>
              {' '}— 1 analysis included, no credit card required. Expires in 7 days.
            </p>
          </div>

          {/* ── CREDIT CALCULATOR ── */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 scroll-fade">
            <p className="text-sm font-semibold mb-1">Not sure which plan? Use the calculator</p>
            <p className="text-xs text-neutral-500 mb-5">Tell us about your shop and we'll recommend the best option</p>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-neutral-700">How many products do you have?</label>
                  <span className="text-sm font-bold text-orange-600">{calcProducts} products</span>
                </div>
                <input id="calc-products" type="range" min={1} max={50} value={calcProducts} onChange={e => setCalcProducts(Number(e.target.value))}
                  aria-label={`Number of products: ${calcProducts}`}
                  className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs text-neutral-400 mt-1"><span>1</span><span>50</span></div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-semibold text-neutral-700">How often do you re-analyze?</label>
                  <div className="relative group">
                    <HelpCircle className="text-neutral-400 cursor-help" size={14} />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-64 bg-neutral-900 text-white text-xs rounded-xl p-3 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20">
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-neutral-900 rotate-45" />
                      <p className="font-semibold mb-1.5">Monthly vs Quarterly</p>
                      <p className="text-neutral-300 mb-1.5"><strong className="text-white">Monthly:</strong> re-analyze each listing once a month — best for active shops updating listings regularly.</p>
                      <p className="text-neutral-300"><strong className="text-white">Quarterly:</strong> re-analyze every 3 months — good for stable shops that don't change listings often.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: 'monthly', label: 'Monthly', sub: 'Stay on top of changes' }, { id: 'quarterly', label: 'Quarterly', sub: 'Stable shop, occasional checks' }].map(f => (
                    <button key={f.id} onClick={() => setCalcFrequency(f.id as any)}
                      className={`p-3 text-left rounded-xl border transition-colors ${calcFrequency === f.id ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                      <p className={`text-xs font-semibold ${calcFrequency === f.id ? 'text-white' : ''}`}>{f.label}</p>
                      <p className={`text-[10px] mt-0.5 ${calcFrequency === f.id ? 'text-neutral-400' : 'text-neutral-400'}`}>{f.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs text-neutral-500 mb-1">Best credit pack</p>
                  <p className="text-lg font-black text-neutral-900">{packRecommendation.name}</p>
                  <p className="text-2xl font-black text-orange-600">${packRecommendation.price}</p>
                  <p className="text-xs text-neutral-400">{packRecommendation.credits.toLocaleString()} credits · one-time</p>
                </div>
                <div className="p-4 bg-black text-white rounded-xl">
                  <p className="text-xs text-neutral-400 mb-1">Best subscription</p>
                  <p className="text-lg font-black">{subRecommendation.name}</p>
                  <p className="text-2xl font-black text-orange-400">${subRecommendation.price}<span className="text-sm font-normal text-neutral-400">/mo</span></p>
                  <p className="text-xs text-neutral-400">{subRecommendation.credits.toLocaleString()} credits/month</p>
                </div>
              </div>
              <p className="text-xs text-neutral-400 text-center">Based on {creditsNeeded.toLocaleString()} credits needed · {calcFrequency} re-analysis of {calcProducts} products</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section className="py-24 px-6 bg-white border-t border-neutral-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-fade">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Live demo</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">What Voxrate finds in one analysis</h2>
            <p className="text-sm text-neutral-500">Demo listing — ceramic mug, 1,000 reviews. This is exactly what your report looks like.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 scroll-fade">
            {/* WHAT THE LISTING LOOKS LIKE */}
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <span className="text-sm font-bold text-red-700">What Voxrate finds</span>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-neutral-500 mb-2">Health score</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-red-500">28</span>
                    <div className="flex-1 h-2 bg-red-100 rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: '28%' }} /></div>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">Based on rating distribution, complaint severity, and listing signals</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-2">Top complaints detected (187 of 1,000 reviews)</p>
                  <div className="space-y-1.5">
                    {[
                      'Handle snaps at the base after 3–6 weeks',
                      'Glaze color much darker than photos',
                      'No padding — arrived feeling fragile',
                    ].map(c => (
                      <div key={c} className="flex items-start gap-2 text-xs text-neutral-600">
                        <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </span>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-neutral-500 mb-1">Current avg. rating</p>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-lg">★★½☆☆</span>
                    <span className="text-sm font-bold text-red-500">2.7</span>
                  </div>
                </div>
              </div>
            </div>

            {/* WHAT VOXRATE TELLS YOU TO DO */}
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="text-sm font-bold text-green-700">Your action plan from Voxrate</span>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 mb-1">Fix #1 — CRITICAL</p>
                  <p className="text-xs text-neutral-700 font-medium mb-1">Handle snaps at the base after 3–6 weeks</p>
                  <p className="text-xs text-neutral-500">Score both surfaces before joining, use slip, and dry slowly covered in plastic — prevents the crack that forms when parts dry at different rates.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 mb-1">Fix #2 — MEDIUM</p>
                  <p className="text-xs text-neutral-700 font-medium mb-1">Glaze color much darker than photos</p>
                  <p className="text-xs text-neutral-500">Reshoot on a cloudy day near a north-facing window — eliminates the warm color shift that makes your glaze look darker than it is.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 mb-1">Fix #3 — LOW</p>
                  <p className="text-xs text-neutral-700 font-medium mb-1">No padding — arrived feeling fragile</p>
                  <p className="text-xs text-neutral-500">Switch to a double-wall box with foam inserts — mug cannot move in transit. ~$1.05/unit cost increase.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 scroll-fade">
            {[
              { stat: '3', label: 'ranked complaints', sub: 'each with exact fixes' },
              { stat: '187', label: 'reviews flagged', sub: 'for the #1 complaint alone' },
              { stat: '19%', label: 'of buyers affected', sub: 'by the top complaint' },
              { stat: '<60s', label: 'to full action plan', sub: 'from paste to fix list' },
            ].map(({ stat, label, sub }) => (
              <div key={stat} className="bg-white border border-neutral-200 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-orange-600">{stat}</p>
                <p className="text-xs font-semibold text-neutral-700 mt-0.5">{label}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">{sub}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-400 text-center mt-4">Demo listing — ceramic mug with 1,000 reviews. Paste any Amazon URL to see your real report.</p>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ── */}
      <section className="py-24 px-6 bg-[#FAF9F6]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-fade">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Is this for you?</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Who gets the most out of Voxrate</h2>
            <p className="text-sm text-neutral-500 max-w-xl mx-auto">Best results come from listings with 20+ reviews — the more reviews, the more precise the patterns.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 scroll-fade">
            {[
              {
                emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                who: 'New sellers',
                fit: 'Great fit',
                fitColor: 'text-green-600 bg-green-50',
                desc: 'Just launched your first listings and getting mixed reviews? Find out which specific issues are turning buyers away — before they snowball into a pattern.',
                useCase: 'Fix problems early, before your ranking takes a hit',
              },
              {
                emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                who: 'Growing sellers',
                fit: 'Best fit',
                fitColor: 'text-orange-600 bg-orange-50',
                desc: "You have reviews coming in but sales have plateaued. Something's holding you back — complaints you haven't spotted, or strengths you're not promoting. Voxrate finds both.",
                useCase: 'Break through the plateau with data, not guesswork',
              },
              {
                emoji_replaced: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                who: 'Experienced sellers',
                fit: 'Great fit',
                fitColor: 'text-green-600 bg-green-50',
                desc: "You've optimized your listings but competitors keep closing the gap. Analyze their reviews to find their blind spots — and yours — and position your shop ahead.",
                useCase: 'Stay ahead of competitors with intelligence they don\'t have',
              },
            ].map(item => (
              <div key={item.who} className="bg-white rounded-2xl border border-neutral-200 p-6 scroll-fade feat-card">
                <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
                  {item.emoji_replaced}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{item.who}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.fitColor}`}>{item.fit}</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed mb-4">{item.desc}</p>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <p className="text-xs font-medium text-neutral-700">{item.useCase}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-neutral-50 border border-neutral-200 rounded-2xl p-5 scroll-fade">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Not the right fit if...</p>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                "You haven't launched yet and have zero reviews",
                "You sell on platforms other than Amazon — analysis is built around Amazon listings and review structure",
                "You're looking for keyword research before buyers find you — Voxrate works with what buyers say after they buy, not search volume",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-neutral-500">
                  <span className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── SEO TEXT ── */}
      <section className="py-6 px-6 bg-[#FAF9F6]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl mx-auto">
            Voxrate is an Amazon review analysis tool that helps sellers understand exactly what buyers are saying about their products.
            Paste your Amazon listing URL or ASIN, or upload a CSV of your reviews to get a health score, complaint analysis with specific fixes,
            SEO keywords extracted from real buyer language, and marketing copy from your best reviews.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#FAF9F6] to-orange-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">Stop guessing.<br />Start selling smarter.</h2>
          <p className="text-neutral-600 text-sm mb-10">See exactly what your buyers love, what they complain about, and how to fix it.</p>
          <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm max-w-xl mx-auto transition-colors ${ctaUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
            <input type="url" value={ctaUrl} onChange={e => { setCtaUrl(e.target.value); setCtaUrlError('') }}
              onKeyDown={e => e.key === 'Enter' && analyzeCta()}
              placeholder="Paste your Amazon product URL or ASIN..."
              className="flex-1 px-4 py-3 text-base bg-transparent outline-none placeholder:text-neutral-400" />
            <button onClick={analyzeCta} className="glow px-6 py-3 bg-black text-white font-medium rounded-xl whitespace-nowrap">Analyze →</button>
          </div>
          {ctaUrlError && <p className="text-xs text-red-500 mt-2">{ctaUrlError}</p>}
          <p className="mt-5 text-xs text-neutral-500">First analysis is free · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER TRUST BAR ── */}
      <div className="bg-neutral-950 py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
          {[
            { n: '84%', label: 'of sellers say reviews are critical', src: 'eComEngine, 2024' },
            { n: '4–5%', label: 'conversion lift per star improvement', src: 'Pattern Research, 2024' },
            { n: '20×', label: 'reviews needed to undo one bad one', src: 'Seller Labs, 2024' },
          ].map(s => (
            <div key={s.n} className="flex items-center gap-3">
              <span className="text-xl font-black text-orange-400">{s.n}</span>
              <div className="text-left">
                <p className="text-xs text-neutral-300">{s.label}</p>
                <p className="text-[10px] text-neutral-600">{s.src}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} className="mb-3" />
              <p className="text-xs text-neutral-400 leading-relaxed">The Amazon review analyzer that turns customer feedback into specific fixes. Free to try.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Product</p>
              <div className="space-y-2">
                {[['#features','Features',false],['#how-it-works','How it works',false],['#pricing','Pricing',false],['/faq','FAQ',true],['/privacy','Privacy policy',true],['/terms','Terms of service',true]].map(([h,l,blank]) => (
                  <a key={String(l)} href={String(h)} target={blank ? '_blank' : undefined} rel={blank ? 'noopener noreferrer' : undefined}
                    className="block text-xs text-neutral-400 hover:text-black transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Stay in the loop</p>
              <p className="text-xs text-neutral-500 mb-3">New features, tips, and exclusive discounts for Amazon sellers.</p>
              {footerNlSubmitted ? (
                <p className="text-xs text-green-600 font-medium">Thanks! We'll be in touch.</p>
              ) : (
                <div className="flex gap-2">
                  <input type="email" value={footerNlEmail} onChange={e => setFooterNlEmail(e.target.value)}
                    onKeyDown={async e => { if (e.key === 'Enter' && footerNlEmail.includes('@')) { await saveNewsletter(footerNlEmail); setFooterNlSubmitted(true) } }}
                    placeholder="your@email.com"
                    className="flex-1 px-3 py-2 text-xs border border-neutral-200 rounded-lg outline-none focus:border-orange-400 transition-colors" />
                  <button onClick={async () => { if (footerNlEmail.includes('@')) { await saveNewsletter(footerNlEmail); setFooterNlSubmitted(true) } }}
                    className="px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors">Join</button>
                </div>
              )}
              <p className="text-xs text-neutral-400 mt-2">
                Questions? <a href="mailto:info@voxrate.app" className="text-orange-500 hover:underline">info@voxrate.app</a>
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-xs text-neutral-400">© 2026 Voxrate</p>
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <a href="/faq" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">FAQ</a>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Privacy</a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Terms</a>
              <a href="mailto:info@voxrate.app" className="hover:text-black transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── PRODUCT INFO MODAL ── */}
      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg">Tell us about your product</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Helps us write better fixes and a more accurate SEO score</p>
              </div>
              <button onClick={() => setShowProductModal(false)} className="text-neutral-400 hover:text-black text-lg leading-none ml-4">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Product name <span className="text-red-500">*</span></label>
                <input type="text" value={productName} onChange={e => { setProductName(e.target.value); setProductNameError('') }}
                  onKeyDown={e => e.key === 'Enter' && submitCsvWithProductInfo()}
                  placeholder="e.g. Handmade Ceramic Coffee Mug" autoFocus
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none focus:border-orange-400 transition-colors ${productNameError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`} />
                {productNameError && <p className="text-xs text-red-500 mt-1">{productNameError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Product category <span className="text-red-500">*</span></label>
                <select value={productCategory} onChange={e => { setProductCategory(e.target.value); setProductCategoryError('') }}
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none focus:border-orange-400 transition-colors bg-white ${productCategoryError ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}>
                  <option value="">Select a category...</option>
                  {['Electronics','Kitchen & Home','Health & Personal Care','Beauty','Clothing & Apparel','Sports & Outdoors','Toys & Games','Baby','Pet Supplies','Tools & Home Improvement','Books & Media','Food & Grocery','Automotive','Office Products','Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {productCategoryError && <p className="text-xs text-red-500 mt-1">{productCategoryError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Listing price <span className="text-neutral-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                  <input type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="29.99"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-2.5 text-sm border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">Cancel</button>
              <button onClick={submitCsvWithProductInfo} className="flex-1 py-2.5 text-sm font-medium bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors">Analyze reviews →</button>
            </div>
            <p className="text-[10px] text-neutral-400 text-center mt-3">File: {csvFile?.name ?? ''} · {csvFile ? Math.round(csvFile.size / 1024) : 0}KB</p>
          </div>
        </div>
      )}
    </div>
  )
}
