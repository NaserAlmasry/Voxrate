'use client'

import CheckoutButton from '@/app/components/CheckoutButton'
import { Search, Crosshair, RefreshCw, Gift, HelpCircle } from 'lucide-react'

const creditItems: { action: string; cost: string; icon: React.ReactNode; free?: boolean }[] = [
  { action: 'Own product analysis',    cost: '20 credits', icon: <Search className="text-orange-500" size={18} /> },
  { action: 'Competitor analysis',     cost: '35 credits', icon: <Crosshair className="text-orange-500" size={18} /> },
  { action: 'Re-analyze listing',      cost: '20 credits', icon: <RefreshCw className="text-orange-500" size={18} /> },
  { action: 'All tools (rewrite, reply, grade, builder)', cost: 'FREE', icon: <Gift className="text-green-500" size={18} />, free: true },
]

type Props = {
  pricingTab: 'packs' | 'subscription'
  setPricingTab: (v: 'packs' | 'subscription') => void
  billingCycle: 'monthly' | 'annual'
  setBillingCycle: (v: 'monthly' | 'annual') => void
  calcProducts: number
  setCalcProducts: (v: number) => void
  calcFrequency: 'monthly' | 'quarterly'
  setCalcFrequency: (v: 'monthly' | 'quarterly') => void
  openAuthModal: () => void
}

export default function PricingSection({
  pricingTab, setPricingTab, billingCycle, setBillingCycle,
  calcProducts, setCalcProducts, calcFrequency, setCalcFrequency,
  openAuthModal,
}: Props) {
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

  return (
    <section id="pricing" className="py-24 px-6 bg-white border-t border-neutral-200">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Pay for what you use</h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-lg mx-auto">
            Subscribe monthly or buy credits once — they never expire. Start free, no card required.
          </p>
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
            {[{ id: 'subscription', label: 'Subscription' }, { id: 'packs', label: 'Pay as you go' }].map(t => (
              <button key={t.id} onClick={() => setPricingTab(t.id as any)}
                className={`px-4 py-1.5 text-sm rounded-full transition-all ${pricingTab === t.id ? 'bg-white shadow-sm font-medium' : 'text-neutral-500'}`}>
                {t.label}
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
                <p className={`text-sm font-medium mb-4 ${pack.popular ? 'text-orange-400' : 'text-orange-600'}`}>{pack.analyses}</p>
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
                  '1 competitor analysis per month — resets on the 1st',
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
                <p className={`text-sm font-medium mb-4 ${sub.popular ? 'text-orange-400' : 'text-orange-600'}`}>{sub.analyses}</p>
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
            <button onClick={openAuthModal} className="font-medium text-neutral-700 hover:text-black underline underline-offset-2 bg-transparent border-none cursor-pointer p-0">Start free</button>
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
  )
}
