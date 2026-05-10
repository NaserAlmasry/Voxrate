'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import CheckoutButton from '@/app/components/CheckoutButton'
import AuthModal from '@/app/components/AuthModal'

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
        How to export from Etsy?
      </button>
      {show && (
        <div className="absolute right-0 top-6 z-50 w-64 bg-black text-white text-xs rounded-xl p-4 shadow-xl">
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-black rotate-45" />
          <p className="font-semibold mb-2">Export your reviews from Etsy:</p>
          <ol className="space-y-1.5 text-neutral-300">
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">1.</span>Go to your Etsy Shop Manager</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">2.</span>Click <strong className="text-white">Reviews</strong> in the left sidebar</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">3.</span>Click <strong className="text-white">Download CSV</strong> at the top right</li>
            <li className="flex gap-2"><span className="text-orange-400 font-bold flex-shrink-0">4.</span>Upload the downloaded file here</li>
          </ol>
          <button onClick={onClose} className="mt-3 text-neutral-400 hover:text-white text-[10px]">Got it ✕</button>
        </div>
      )}
    </div>
  )
}

// ── SVG icon components ────────────────────────────────────────
function IconCoffee({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}

function IconSearch({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function IconTarget({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  )
}

function IconZap({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function IconEdit({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function IconMessageCircle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconLayers({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function IconBarChart({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function IconBell({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function IconPuzzle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}

function IconRefresh({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )
}

function IconGift({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
}

function IconQuestionMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
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
    riskIfIgnored: 'Each new 1-star review pushes your listing down Etsy search — at current velocity, your ranking will drop measurably within 60 days',
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
    riskIfIgnored: '"Not as described" reviews — Etsy weights these heavily in dispute resolution',
    fixes: [
      { simple: 'Reshoot on a cloudy day near a north-facing window — eliminates the warm color shift that makes your glaze look darker than it is', why: 'Zero cost fix that eliminates the root cause of 134 complaints' },
      { simple: 'Add a color note: "Photos taken in natural daylight — colors may vary slightly on warm-toned screens"', why: 'Reduces return rate and protects against Etsy dispute resolutions' },
    ]
  },
  {
    title: 'Packaging offers no transit protection',
    severity: 'LOW', frequency: '43 of 1,000 reviews',
    quote: '"the box was completely caved in — the mug survived but I was shaking opening it, zero padding inside"',
    description: 'Single-wall boxes with no internal padding are transmitting transit impacts directly to the ceramic.',
    revenueImpact: '4% of buyers affected — each damaged arrival generates a return, replacement cost, and a probable 1-star review',
    riskIfIgnored: '"Arrived broken" has zero ambiguity and Etsy sides with the buyer in disputes',
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
  { title: 'Move "keeps coffee hot" into your listing title', description: 'Your 5-star reviewers independently use "keeps coffee hot" in 312 reviews. None of these phrases appear in your title or tags. Your strongest selling point is invisible to Etsy search.', impact: 'Captures validated search intent your existing customers already proved' },
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
    q: 'Does this work for any Etsy product?',
    a: 'Yes — Voxrate works for any product category on Etsy, from jewelry and ceramics to digital downloads and clothing. The AI adapts its analysis to the product type. Best results come from listings with 30+ reviews.',
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
    q: 'How is Voxrate different from other Etsy tools?',
    a: "Most Etsy tools tell you what buyers search for before they buy — keyword volume, competition, tag suggestions. Voxrate tells you what buyers say after they buy — complaints, praise, and specific fixes. They solve different problems: use keyword tools to get found, use Voxrate to improve what happens after they find you.",
  },
  {
    q: 'Can I analyze a competitor\'s listing?',
    a: "Yes. You can paste any public Etsy listing URL — including competitors'. Voxrate will analyze their reviews, show you their top weaknesses, what they do well, and give you a side-by-side comparison. Competitor analysis costs 48 credits (vs 24 for your own listings) and is available on Starter and Pro plans.",
  },
  {
    q: 'What are credits and do they expire?',
    a: 'Credits are the currency used for analyses. Each own-listing analysis costs 24 credits, each competitor analysis costs 48 credits. All other tools (rewriter, grader, reply generator, listing builder) are free — no credits needed. Credits purchased in packs never expire. Subscription credits refresh monthly.',
  },
  {
    q: 'Is my data and my customers\' data private?',
    a: "Voxrate only analyzes publicly available review text from Etsy — the same text anyone can read on the listing page. We don't access your Etsy account, private messages, or order data. Your generated reports are private to your account and are never shared.",
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

export default function LandingPage() {
  const [heroUrl, setHeroUrl]         = useState('')
  const [heroUrlError, setHeroUrlError] = useState('')
  const [ctaUrl, setCtaUrl]           = useState('')
  const [ctaUrlError, setCtaUrlError] = useState('')
  const [pricingTab, setPricingTab]   = useState<'packs' | 'subscription'>('packs')
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
      if (!url.trim()) return { error: 'Please paste an Etsy product URL first' }
      if (!url.includes('etsy.com/listing/')) return { error: 'Please paste a valid Etsy listing URL' }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (requireUrl) {
      try { localStorage.setItem('pendingUrl', url) } catch { return { error: 'Browser storage unavailable. Please enable cookies.' } }
    }
    if (user) { window.location.href = '/dashboard'; return { error: null } }
    await supabase.auth.signInWithOAuth({ provider: 'google', options: googleOAuthOptions(window.location.origin) })
    return { error: null }
  }, [supabase])

  const analyzeHero = async () => { const r = await signIn(heroUrl, true); if (r?.error) setHeroUrlError(r.error) }
  const analyzeCta  = async () => { const r = await signIn(ctaUrl,  true); if (r?.error) setCtaUrlError(r.error) }
  const openCsv = () => document.getElementById('csv-in')?.click()

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
  const packRecommendation = creditsNeeded <= 120 ? { name: 'Starter Pack', credits: 120, price: 5.99 }
    : creditsNeeded <= 360 ? { name: 'Standard Pack', credits: 360, price: 14.99 }
    : { name: 'Pro Pack', credits: 840, price: 29.99 }
  const subRecommendation = creditsNeeded <= 720 ? { name: 'Starter', price: 9.99, credits: 720 }
    : { name: 'Pro', price: 19.99, credits: 2400 }

  const featureItems: { icon: React.ReactNode; title: string; desc: string; badge: string; soon?: boolean }[] = [
    { icon: <IconSearch className="text-orange-500" />, title: 'Review Analysis', desc: 'Deep AI analysis of every review — complaints ranked by severity, strengths by frequency, with exact step-by-step fixes.', badge: 'Core feature' },
    { icon: <IconTarget className="text-orange-500" />, title: 'Competitor Spy', desc: "Analyze any competitor's listing. See their weaknesses before they fix them. Turn their problems into your positioning.", badge: 'Starter & Pro' },
    { icon: <IconZap className="text-orange-500" />, title: 'Listing Grader', desc: 'Get an A–F grade on your title, tags, description and pricing separately — with specific fixes for each.', badge: 'Free tool' },
    { icon: <IconEdit className="text-orange-500" />, title: 'AI Description Rewriter', desc: 'Rewrite your listing description using your own review keywords and insights. SEO-optimized in one click.', badge: 'Free tool' },
    { icon: <IconMessageCircle className="text-orange-500" />, title: 'Review Reply Generator', desc: '3 ready-to-paste reply options for any review — empathetic, professional, or personal tone.', badge: 'Free tool' },
    { icon: <IconLayers className="text-orange-500" />, title: 'AI Listing Builder', desc: 'Generate a complete listing from scratch — title options, 13 SEO tags, and full description from a short prompt.', badge: 'Free tool' },
    { icon: <IconBarChart className="text-orange-500" />, title: 'Shop Health Score', desc: "See your entire shop's health at a glance — aggregated score, top recurring complaints, and 3 priority actions.", badge: 'Free' },
    { icon: <IconBell className="text-orange-500" />, title: 'Review Monitoring', desc: 'Automatic weekly re-analysis. Get alerts the moment your score drops or new complaints appear.', badge: 'Coming soon', soon: true },
    { icon: <IconPuzzle className="text-orange-500" />, title: 'Chrome Extension', desc: 'Analyze any Etsy listing instantly while browsing — without leaving the page. One-click access to full reports.', badge: 'Coming soon', soon: true },
  ]

  const creditItems: { action: string; cost: string; icon: React.ReactNode; free?: boolean }[] = [
    { action: 'Own product analysis',    cost: '24 credits', icon: <IconSearch className="text-orange-500" /> },
    { action: 'Competitor analysis',     cost: '48 credits', icon: <IconTarget className="text-orange-500" /> },
    { action: 'Re-analyze listing',      cost: '24 credits', icon: <IconRefresh className="text-orange-500" /> },
    { action: 'All tools (rewrite, reply, grade, builder)', cost: 'FREE', icon: <IconGift className="text-green-500" />, free: true },
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
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bdg inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-700 mb-4 cursor-default select-none">
            <span className="bdot w-1.5 h-1.5 rounded-full bg-orange-500" />
            TURN REVIEWS INTO REVENUE
          </div>
          <div className="min-h-[180px] md:min-h-[220px] flex flex-col items-center justify-center mb-6 hero-fade">
            <h1 className="text-4xl md:text-6xl font-bold tracking-normal leading-[1.2]">
              Analyze your reviews.<br />
              <span className="text-orange-600 font-bold">Discover the problems.</span><br />
              Get exact <span className="font-bold underline decoration-orange-400 decoration-2 underline-offset-4">fixes.</span>
            </h1>
          </div>
          <p className="text-sm text-neutral-500 mb-8 max-w-xl mx-auto">The Etsy review analyzer that turns customer feedback into specific, actionable improvements — in under 60 seconds</p>

          <div className="max-w-2xl mx-auto">
            <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm transition-colors ${heroUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
              <label htmlFor="hero-url" className="sr-only">Etsy product URL</label>
              <input id="hero-url" type="url" value={heroUrl} onChange={e => { setHeroUrl(e.target.value); setHeroUrlError('') }}
                onKeyDown={e => e.key === 'Enter' && analyzeHero()}
                placeholder="Paste your Etsy product URL..."
                className="flex-1 px-4 py-3 text-base bg-transparent outline-none placeholder:text-neutral-400" />
              <button onClick={analyzeHero} className="glow px-6 py-3 bg-black text-white font-medium rounded-xl whitespace-nowrap">Analyze →</button>
            </div>
            {heroUrlError && <p className="text-xs text-red-500 mt-2 text-left px-1">{heroUrlError}</p>}

            <div className="mt-4 text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={openCsv} className="text-sm text-neutral-500 hover:text-black underline underline-offset-4 transition-colors">or upload a reviews CSV</button>
                <span className="text-neutral-300">·</span>
                <CsvGuide show={showCsvGuide} onToggle={() => setShowCsvGuide(v => !v)} onClose={() => setShowCsvGuide(false)} />
              </div>
              <input id="csv-in" type="file" accept=".csv" onChange={onCsv} className="hidden" />
              {csvMsg && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="h-1 w-32 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-orange-600">{csvMsg}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-600">
              {['Free to try', 'No credit card required', 'Specific fixes, not guesses'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-500" />{t}
                </span>
              ))}
            </div>

            {/* ── Inline stats strip ── */}
            <InlineStats />
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
                <p className="text-xs text-neutral-400 mt-2 pl-6 not-italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>— what Voxrate gives you in under 60 seconds</p>
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
              <IconCoffee className={activeTab !== 'competitor' ? 'text-white' : 'text-neutral-500'} />
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
              <IconTarget className={activeTab === 'competitor' ? 'text-white' : 'text-neutral-500'} />
              Competitor analysis
            </button>
          </div>

          <div className="bg-[#FAF9F6] rounded-2xl border border-neutral-200 overflow-hidden">
            {activeTab !== 'competitor' ? (
              <>
                <div className="p-6 border-b border-neutral-200">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Demo product</p>
                      <h3 className="font-semibold text-lg">Handmade Ceramic Mug</h3>
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
                    { id: 'complaints', label: 'Problems' }, { id: 'strengths', label: 'Strengths' },
                    { id: 'improvements', label: 'Improvements' }, { id: 'seo', label: 'SEO' },
                    { id: 'marketing', label: 'Marketing copy' }, { id: 'breakdown', label: 'Star breakdown' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
                      {tab.label}
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
                            'Add "substantial and gift-worthy" as an Etsy tag — gift buyers who search this spend 40% more',
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
                  <IconTarget className="text-orange-500 flex-shrink-0" />
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

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 scroll-fade">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Everything you need</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">One tool. Every edge.</h2>
            <p className="text-sm text-neutral-500 max-w-xl mx-auto">From diagnosing why buyers leave to generating the copy that makes them stay — all in one dashboard</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {featureItems.map((f) => (
              <div key={f.title} className={`feat-card bg-white rounded-2xl border border-neutral-200 p-5 scroll-fade relative overflow-hidden ${f.soon ? 'opacity-80' : ''}`}>
                {f.soon && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded-full">Coming soon</div>
                )}
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed mb-3">{f.desc}</p>
                <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{f.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 bg-white border-y border-neutral-200">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-sm text-neutral-600 mb-14">From listing URL to full action plan in under 60 seconds</p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {[
              {
                n: 1,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                title: 'Paste your Etsy URL',
                body: "Drop in any Etsy product link or upload a CSV export of your reviews. No setup, no forms, no configuration.",
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
            <h2 className="text-3xl font-bold mb-3">Not all Etsy tools are equal</h2>
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
          <p className="text-xs text-neutral-400 text-center mt-3">"Others" refers to general Etsy SEO tools. Comparison based on publicly available features.</p>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-neutral-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Pay for what you use</h2>
            <p className="text-sm text-neutral-500 mb-6 max-w-xl mx-auto">No monthly lock-in. Buy credits when you need them — they never expire. Or subscribe and save.</p>
            <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
              {[{ id: 'packs', label: 'Credit packs' }, { id: 'subscription', label: 'Monthly subscription' }].map(t => (
                <button key={t.id} onClick={() => setPricingTab(t.id as any)}
                  className={`px-4 py-1.5 text-sm rounded-full transition-all ${pricingTab === t.id ? 'bg-white shadow-sm font-medium' : 'text-neutral-500'}`}>
                  {t.label}
                  {t.id === 'subscription' && <span className="text-orange-500 text-xs ml-1">Save 30%+</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── HOW CREDITS WORK ── */}
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
            <p className="text-xs text-neutral-400 text-center mt-3">Credits never expire · 1 analysis = 24 credits · Competitor analysis = 48 credits</p>
          </div>

          {pricingTab === 'packs' ? (
            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {[
                { name: 'Starter', id: 'starter_pack', credits: 120, price: 5.99, analyses: '≈ 5 analyses', desc: 'Try it out — no subscription', popular: false },
                { name: 'Standard', id: 'growth_pack', credits: 360, price: 14.99, analyses: '≈ 15 analyses', desc: 'Most popular for small shops', popular: true },
                { name: 'Pro Pack', id: 'pro_pack',    credits: 840, price: 29.99, analyses: '≈ 35 analyses', desc: 'Best value per credit', popular: false },
              ].map(pack => (
                <div key={pack.name} className={`pcard p-6 rounded-2xl border relative ${pack.popular ? 'bg-black text-white border-black' : 'bg-white border-neutral-200'}`}>
                  {pack.popular && <div className="absolute top-4 right-4 px-2 py-0.5 text-xs bg-orange-500 rounded-full text-white">Most popular</div>}
                  <h3 className={`font-semibold mb-1 ${pack.popular ? 'text-white' : ''}`}>{pack.name}</h3>
                  <p className={`text-xs mb-4 ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{pack.desc}</p>
                  <p className="text-4xl font-black mb-1">${pack.price}</p>
                  <p className={`text-xs mb-1 ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>one-time · never expires</p>
                  <div className={`my-4 p-3 rounded-xl ${pack.popular ? 'bg-white/10' : 'bg-orange-50'}`}>
                    <p className={`text-2xl font-black ${pack.popular ? 'text-orange-400' : 'text-orange-600'}`}>{pack.credits.toLocaleString()}</p>
                    <p className={`text-xs ${pack.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>credits · {pack.analyses}</p>
                  </div>
                  <ul className={`space-y-1.5 text-xs mb-6 ${pack.popular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {['All analysis features', 'Credits never expire', 'Top up anytime', 'All free tools included'].map(f => (
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
            <div className="grid md:grid-cols-2 gap-5 mb-8">
              {[
                {
                  name: 'Starter', price: 9.99, credits: 720, analyses: '≈ 30 analyses/mo',
                  desc: 'For sellers with a few active listings',
                  features: ['720 credits every month', 'Credits roll over (unused credits stack)', 'Buy extra credits anytime', 'All analysis features', 'Review monitoring (coming soon)', 'Competitor watchlist'],
                  popular: false, plan: 'starter'
                },
                {
                  name: 'Pro', price: 19.99, credits: 2400, analyses: '≈ 100 analyses/mo',
                  desc: 'For serious sellers managing multiple products',
                  features: ['2,400 credits every month', 'Credits roll over (unused credits stack)', 'Buy extra credits anytime', 'Re-analyze free (no credits)', 'Review monitoring (coming soon)', 'Competitor watchlist + alerts', 'Priority email support'],
                  popular: true, plan: 'pro'
                },
              ].map(sub => (
                <div key={sub.name} className={`pcard p-6 rounded-2xl border relative ${sub.popular ? 'bg-black text-white border-black' : 'bg-white border-neutral-200'}`}>
                  {sub.popular && <div className="absolute top-4 right-4 px-2 py-0.5 text-xs bg-orange-500 rounded-full text-white">Best value</div>}
                  <h3 className={`font-semibold mb-1 ${sub.popular ? 'text-white' : ''}`}>{sub.name}</h3>
                  <p className={`text-xs mb-4 ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{sub.desc}</p>
                  <div className="mb-1">
                    <span className="text-4xl font-black">${sub.price}</span>
                    <span className={`text-sm ml-1 ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>/month</span>
                  </div>
                  <div className={`my-4 p-3 rounded-xl ${sub.popular ? 'bg-white/10' : 'bg-orange-50'}`}>
                    <p className={`text-2xl font-black ${sub.popular ? 'text-orange-400' : 'text-orange-600'}`}>{sub.credits.toLocaleString()}</p>
                    <p className={`text-xs ${sub.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>credits/month · {sub.analyses}</p>
                  </div>
                  <ul className={`space-y-1.5 text-xs mb-6 ${sub.popular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {sub.features.map(f => (
                      <li key={f} className="flex gap-2"><span className={sub.popular ? 'text-orange-400' : 'text-green-500'}>✓</span>{f}</li>
                    ))}
                  </ul>
                  <CheckoutButton plan={sub.plan as any} billing="monthly" label={`Start ${sub.name} →`}
                    className="glow w-full py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer bg-black hover:bg-neutral-800 text-white"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Free tier note */}
          <div className="text-center mb-10">
            <p className="text-sm text-neutral-500">
              Not ready to pay?{' '}
              <button onClick={() => setShowAuthModal(true)} className="font-medium text-neutral-700 hover:text-black underline underline-offset-2 bg-transparent border-none cursor-pointer p-0">Start free</button>
              {' '}— 1 full analysis included, no credit card required.
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
                    <IconQuestionMark className="text-neutral-400 cursor-help" />
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
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Real results</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">What changes after one analysis</h2>
            <p className="text-sm text-neutral-500">A real listing, before and after acting on Voxrate's fixes</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 scroll-fade">
            {/* BEFORE */}
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <span className="text-sm font-bold text-red-700">Before Voxrate</span>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-neutral-500 mb-2">Health score</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-red-500">28</span>
                    <div className="flex-1 h-2 bg-red-100 rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: '28%' }} /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-2">Top complaints (187 of 1,000 reviews)</p>
                  <div className="space-y-1.5">
                    {['Handle snaps at the base after 3–6 weeks', 'Glaze color much darker than photos', 'No padding — arrived feeling fragile'].map(c => (
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
                  <p className="text-xs font-semibold text-neutral-500 mb-1">Avg. star rating</p>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-lg">★★½☆☆</span>
                    <span className="text-sm font-bold text-red-500">2.7</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AFTER */}
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="text-sm font-bold text-green-700">After acting on the fixes</span>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-neutral-500 mb-2">Health score</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-green-500">81</span>
                    <div className="flex-1 h-2 bg-green-100 rounded-full"><div className="h-full bg-green-400 rounded-full" style={{ width: '81%' }} /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 mb-2">After applying fixes</p>
                  <div className="space-y-1.5">
                    {['Switched to stoneware clay — handle complaints dropped to 0', 'Reshoot in natural light — color complaints eliminated', 'Added foam inserts — zero transit damage reports'].map(c => (
                      <div key={c} className="flex items-start gap-2 text-xs text-neutral-600">
                        <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-xs font-semibold text-neutral-500 mb-1">Avg. star rating</p>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-lg">★★★★½</span>
                    <span className="text-sm font-bold text-green-500">4.7</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-400 text-center mt-4">Illustrative example based on the demo listing — your results depend on your listing and review volume.</p>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ── */}
      <section className="py-24 px-6 bg-[#FAF9F6]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 scroll-fade">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Is this for you?</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Who gets the most out of Voxrate</h2>
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

        </div>
      </section>

      {/* ── SEO TEXT ── */}
      <section className="py-6 px-6 bg-[#FAF9F6]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl mx-auto">
            Voxrate is an Etsy review analysis tool that helps sellers understand exactly what buyers are saying about their products.
            Paste your Etsy listing URL or upload a CSV of your reviews to get a health score, complaint analysis with specific fixes,
            SEO keywords extracted from real buyer language, and marketing copy from your best reviews.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#FAF9F6] to-orange-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">Stop guessing.<br />Start selling smarter.</h2>
          <p className="text-neutral-600 text-sm mb-10">See exactly what your buyers love, what they complain about, and how to fix it — in under 60 seconds.</p>
          <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm max-w-xl mx-auto transition-colors ${ctaUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
            <input type="url" value={ctaUrl} onChange={e => { setCtaUrl(e.target.value); setCtaUrlError('') }}
              onKeyDown={e => e.key === 'Enter' && analyzeCta()}
              placeholder="Paste your Etsy product URL..."
              className="flex-1 px-4 py-3 text-base bg-transparent outline-none placeholder:text-neutral-400" />
            <button onClick={analyzeCta} className="glow px-6 py-3 bg-black text-white font-medium rounded-xl whitespace-nowrap">Analyze →</button>
          </div>
          {ctaUrlError && <p className="text-xs text-red-500 mt-2">{ctaUrlError}</p>}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src="/logo.png" alt="Voxrate" height={28} style={{ objectFit: 'contain', maxWidth: 130 }} className="mb-3" />
              <p className="text-xs text-neutral-400 leading-relaxed">The Etsy review analyzer that turns customer feedback into specific fixes. Free to try.</p>
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
              <p className="text-xs text-neutral-500 mb-3">New features, tips, and exclusive discounts for Etsy sellers.</p>
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
                  {['Jewelry & Accessories','Home & Living','Clothing & Apparel','Art & Collectibles','Craft Supplies & Tools','Weddings','Toys & Games','Paper & Party Supplies','Pet Supplies','Food & Drink','Bags & Purses','Other'].map(c => (
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
