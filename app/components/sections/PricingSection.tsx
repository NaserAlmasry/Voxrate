'use client'

import CheckoutButton from '@/app/components/CheckoutButton'
import { RotateCcw, HelpCircle, Zap, Shield, TrendingUp, Check, Minus, Clock } from 'lucide-react'

type Props = {
  billingCycle: 'monthly' | 'annual'
  setBillingCycle: (v: 'monthly' | 'annual') => void
  calcProducts: number
  setCalcProducts: (v: number) => void
  calcFrequency: 'monthly' | 'quarterly'
  setCalcFrequency: (v: 'monthly' | 'quarterly') => void
  openAuthModal: () => void
}

const PLANS = [
  {
    name:         'Starter',
    plan:         'starter',
    monthlyPrice: 14.99,
    annualPrice:  12.50,
    annualTotal:  149.99,
    icon:         <Zap size={16} className="text-blue-500" />,
    badge:        null,
    popular:      false,
    totalAnalyses: 35,
    rollover:     '2 months',
    highlights: [
      '35 analyses/month — own or competitor',
      'Rollover unused analyses (up to 2 months)',
      '5-ASIN watchlist',
      'Weekly digest email',
      'Unlimited AI tools',
      'Chrome extension included',
    ],
    btnLabel: 'Start Starter →',
  },
  {
    name:         'Growth',
    plan:         'growth',
    monthlyPrice: 39.99,
    annualPrice:  32.50,
    annualTotal:  389.99,
    icon:         <TrendingUp size={16} className="text-orange-500" />,
    badge:        'Most popular',
    popular:      true,
    totalAnalyses: 80,
    rollover:     '2 months',
    highlights: [
      '80 analyses/month — own or competitor',
      'Rollover unused analyses (up to 2 months)',
      '20-ASIN watchlist',
      'Hijacker & listing change alerts',
      'Sentiment alerts — weekly',
      'Bulk analyze 5 at once',
    ],
    btnLabel: 'Start Growth →',
  },
  {
    name:         'Pro',
    plan:         'pro',
    monthlyPrice: 59.99,
    annualPrice:  49.17,
    annualTotal:  589.99,
    icon:         <Shield size={16} className="text-purple-500" />,
    badge:        'Best value',
    popular:      false,
    totalAnalyses: 220,
    rollover:     '3 months',
    highlights: [
      '220 analyses/month — own or competitor',
      'Rollover unused analyses (up to 3 months)',
      'Unlimited ASIN watchlist',
      '⚡ Priority queue — skip the line',
      'Seller Central scanner (exclusive)',
      'Bulk analyze 10 at once',
    ],
    btnLabel: 'Start Pro →',
  },
]

// ── Full comparison table ────────────────────────────────────────
type Cell = string | boolean | 'soon'
const COMPARISON: { category: string; rows: { label: string; tip?: string; starter: Cell; growth: Cell; pro: Cell }[] }[] = [
  {
    category: 'Analyses',
    rows: [
      { label: 'Monthly pool',         starter: '35',        growth: '80',         pro: '220'       },
      { label: 'Own or competitor',     starter: true,        growth: true,         pro: true        },
      { label: 'Rollover',              starter: '2 months',  growth: '2 months',   pro: '3 months'  },
      { label: 'Burst rate',            tip: 'Max analyses per 30 minutes', starter: '5 / 30 min', growth: '10 / 30 min', pro: '20 / 30 min' },
      { label: 'Re-analyze cooldown',   starter: '7 days',    growth: '3 days',     pro: 'None'      },
      { label: 'Priority queue',        tip: 'Pro jobs run first when the system is busy', starter: false, growth: false, pro: '⚡ First' },
    ],
  },
  {
    category: 'Chrome Extension',
    rows: [
      { label: 'Competitor sidebar overlay',  starter: true,  growth: true,  pro: true  },
      { label: 'Listing velocity monitor',    starter: true,  growth: true,  pro: true  },
      { label: 'Review collector',            starter: true,  growth: true,  pro: true  },
      { label: 'Hijacker & listing alerts',   starter: false, growth: true,  pro: true  },
      { label: 'Seller Central scanner',      tip: 'Account health, returns, stranded inventory — pulled automatically when you visit Seller Central', starter: false, growth: false, pro: true },
    ],
  },
  {
    category: 'Monitoring & Alerts',
    rows: [
      { label: 'ASIN watchlist',          starter: '5 ASINs',   growth: '20 ASINs',  pro: 'Unlimited' },
      { label: 'Bulk analyze',            starter: '3 at once', growth: '5 at once', pro: '10 at once'},
      { label: 'Sentiment alerts',        starter: false,       growth: 'Weekly',    pro: 'Daily or weekly' },
      { label: 'Digest email',            starter: 'Weekly',    growth: 'Weekly',    pro: 'Daily or weekly' },
    ],
  },
  {
    category: 'AI Tools (all unlimited)',
    rows: [
      { label: 'Listing health score',      starter: true, growth: true, pro: true },
      { label: 'Review complaint analysis', starter: true, growth: true, pro: true },
      { label: 'AI description rewriter',   starter: true, growth: true, pro: true },
      { label: 'Listing grader',            starter: true, growth: true, pro: true },
      { label: 'Review reply generator',    starter: true, growth: true, pro: true },
      { label: 'Listing builder',           starter: true, growth: true, pro: true },
    ],
  },
  {
    category: 'Reports & Data',
    rows: [
      { label: 'Report history',    starter: '60 days',   growth: '6 months',  pro: 'Unlimited' },
      { label: 'PDF / CSV export',  starter: false,       growth: 'soon',      pro: 'soon'      },
      { label: 'Team seats',        starter: false,       growth: false,       pro: 'soon'      },
    ],
  },
]

function CellValue({ val, popular }: { val: Cell; popular: boolean }) {
  if (val === true)   return <Check size={15} className={popular ? 'text-orange-400 mx-auto' : 'text-green-500 mx-auto'} />
  if (val === false)  return <Minus size={14} className="text-neutral-300 mx-auto" />
  if (val === 'soon') return <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">Soon</span>
  return <span className={`text-xs font-medium ${popular ? 'text-white' : 'text-neutral-700'}`}>{val}</span>
}

export default function PricingSection({
  billingCycle, setBillingCycle, calcProducts, setCalcProducts, calcFrequency, setCalcFrequency, openAuthModal,
}: Props) {
  const ownNeeded        = calcFrequency === 'monthly' ? calcProducts : Math.ceil(calcProducts / 3)
  const competitorNeeded = calcFrequency === 'monthly' ? Math.ceil(calcProducts * 0.2) : Math.ceil(calcProducts * 0.2 / 3)
  const totalNeeded      = ownNeeded + competitorNeeded
  const recommended      = totalNeeded <= 35 ? 'starter' : totalNeeded <= 80 ? 'growth' : 'pro'

  return (
    <section id="pricing" className="py-24 px-6 bg-white border-t border-neutral-200">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple. Generous. No credits.</h2>
          <p className="text-sm text-neutral-500 max-w-lg mx-auto mb-2">
            One pool of analyses per month — use them on your own listings or competitors. Unused ones roll over automatically.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
            <RotateCcw size={12} /> Unused analyses roll over — the only Amazon tool that does this
          </p>
        </div>

        {/* Billing toggle */}
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
            <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">Save up to 19%</span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-4">
          {PLANS.map(p => {
            const price       = billingCycle === 'annual' ? p.annualPrice : p.monthlyPrice
            const annualSaving = (p.monthlyPrice * 12 - p.annualTotal).toFixed(0)
            return (
              <div key={p.name} className={`p-6 rounded-2xl border relative flex flex-col ${p.popular ? 'bg-black text-white border-black ring-2 ring-orange-500 ring-offset-2 scale-[1.03] z-10' : 'bg-white border-neutral-200'}`}>
                {p.badge && (
                  <div className="absolute top-4 right-4 px-2 py-0.5 text-xs bg-orange-500 rounded-full text-white">{p.badge}</div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  {p.icon}
                  <h3 className={`font-semibold ${p.popular ? 'text-white' : ''}`}>{p.name}</h3>
                </div>

                <div className="mb-1">
                  <span className="text-4xl font-black">${price}</span>
                  <span className={`text-sm ml-1 ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>/month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className={`text-xs mb-1 ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    ${p.annualTotal}/year — <span className="text-orange-400 font-medium">save ${annualSaving}</span>
                  </p>
                )}

                {/* Pool at-a-glance */}
                <div className={`flex gap-3 my-4 p-3 rounded-xl ${p.popular ? 'bg-white/10' : 'bg-neutral-50 border border-neutral-100'}`}>
                  <div className="text-center flex-1">
                    <p className={`text-2xl font-black ${p.popular ? 'text-orange-400' : 'text-orange-600'}`}>{p.totalAnalyses}</p>
                    <p className={`text-[10px] ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>analyses/mo</p>
                  </div>
                  <div className={`w-px ${p.popular ? 'bg-white/20' : 'bg-neutral-200'}`} />
                  <div className="text-center flex-1">
                    <p className={`text-xs font-bold ${p.popular ? 'text-green-400' : 'text-green-600'}`}>↺ {p.rollover}</p>
                    <p className={`text-[10px] ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>rollover</p>
                  </div>
                </div>

                {/* Highlights */}
                <ul className={`space-y-1.5 text-xs mb-6 flex-1 ${p.popular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  {p.highlights.map(f => (
                    <li key={f} className="flex gap-2 items-start">
                      <span className={`mt-0.5 flex-shrink-0 ${p.popular ? 'text-orange-400' : 'text-green-500'}`}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <CheckoutButton
                  plan={p.plan as any} billing={billingCycle} label={p.btnLabel}
                  className={`w-full py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${p.popular ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-black hover:bg-neutral-800 text-white'}`}
                />
              </div>
            )
          })}
        </div>

        {/* Free tier note */}
        <div className="text-center mb-10 mt-6">
          <p className="text-sm text-neutral-500">
            Not ready to pay?{' '}
            <button onClick={openAuthModal} className="font-medium text-neutral-700 hover:text-black underline underline-offset-2 bg-transparent border-none cursor-pointer p-0">Start free</button>
            {' '}— 14-day trial · 5 analyses included · no credit card required.
          </p>
        </div>

        {/* ── Full comparison table ── */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-center mb-6">Full feature comparison</h3>
          <div className="rounded-2xl border border-neutral-200 overflow-hidden">

            {/* Table header */}
            <div className="grid grid-cols-4 bg-neutral-50 border-b border-neutral-200">
              <div className="p-4" />
              {PLANS.map(p => (
                <div key={p.name} className={`p-4 text-center border-l border-neutral-200 ${p.popular ? 'bg-black' : ''}`}>
                  <p className={`text-sm font-bold ${p.popular ? 'text-white' : 'text-neutral-800'}`}>{p.name}</p>
                  <p className={`text-xs mt-0.5 ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    ${billingCycle === 'annual' ? p.annualPrice : p.monthlyPrice}/mo
                  </p>
                </div>
              ))}
            </div>

            {/* Categories & rows */}
            {COMPARISON.map((section, si) => (
              <div key={section.category}>
                {/* Category header */}
                <div className="grid grid-cols-4 bg-neutral-50 border-b border-t border-neutral-200">
                  <div className="px-4 py-2 col-span-4">
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">{section.category}</p>
                  </div>
                </div>

                {/* Rows */}
                {section.rows.map((row, ri) => (
                  <div key={row.label} className={`grid grid-cols-4 border-b border-neutral-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}`}>
                    {/* Label */}
                    <div className="px-4 py-3 flex items-center gap-1.5">
                      <span className="text-xs text-neutral-700">{row.label}</span>
                      {row.tip && (
                        <div className="relative group flex-shrink-0">
                          <HelpCircle size={12} className="text-neutral-400 cursor-help" />
                          <div className="absolute left-0 bottom-5 w-52 bg-neutral-900 text-white text-xs rounded-xl p-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20">
                            <div className="absolute -bottom-1.5 left-2 w-3 h-3 bg-neutral-900 rotate-45" />
                            {row.tip}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Starter */}
                    <div className="px-4 py-3 border-l border-neutral-100 flex items-center justify-center">
                      <CellValue val={row.starter} popular={false} />
                    </div>
                    {/* Growth */}
                    <div className="px-4 py-3 border-l border-neutral-100 flex items-center justify-center bg-black/[0.02]">
                      <CellValue val={row.growth} popular={true} />
                    </div>
                    {/* Pro */}
                    <div className="px-4 py-3 border-l border-neutral-100 flex items-center justify-center">
                      <CellValue val={row.pro} popular={false} />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* CTA row */}
            <div className="grid grid-cols-4 bg-neutral-50 border-t border-neutral-200">
              <div className="p-4" />
              {PLANS.map(p => (
                <div key={p.name} className={`p-3 border-l border-neutral-200 ${p.popular ? 'bg-black' : ''}`}>
                  <CheckoutButton
                    plan={p.plan as any} billing={billingCycle} label={p.btnLabel}
                    className={`w-full py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${p.popular ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-black hover:bg-neutral-800 text-white'}`}
                  />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Rollover explainer */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <RotateCcw size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-neutral-800 mb-1">How rollover works</p>
              <p className="text-xs text-neutral-600 leading-relaxed">
                If you don't use all your analyses this month, they carry forward automatically. Growth gets 80/month with up to 160 banked. Pro gets 220/month with up to 660 banked. Going through a product launch? Use 40 in one day. Quiet month? Bank the rest. No other Amazon tool does this.
              </p>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
          <p className="text-sm font-semibold mb-1">Not sure which plan? Use the calculator</p>
          <p className="text-xs text-neutral-500 mb-5">Tell us about your shop and we'll recommend the best fit</p>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-700">How many products do you have?</label>
                <span className="text-sm font-bold text-orange-600">{calcProducts} products</span>
              </div>
              <input type="range" min={1} max={50} value={calcProducts} onChange={e => setCalcProducts(Number(e.target.value))}
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
                    <p className="font-semibold mb-1">Monthly vs Quarterly</p>
                    <p className="text-neutral-300 mb-1"><strong className="text-white">Monthly:</strong> best for active shops updating listings regularly.</p>
                    <p className="text-neutral-300"><strong className="text-white">Quarterly:</strong> good for stable shops that don't change listings often.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'monthly', label: 'Monthly', sub: 'Stay on top of changes' }, { id: 'quarterly', label: 'Quarterly', sub: 'Stable shop' }].map(f => (
                  <button key={f.id} onClick={() => setCalcFrequency(f.id as any)}
                    className={`p-3 text-left rounded-xl border transition-colors ${calcFrequency === f.id ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                    <p className={`text-xs font-semibold ${calcFrequency === f.id ? 'text-white' : ''}`}>{f.label}</p>
                    <p className={`text-[10px] mt-0.5 ${calcFrequency === f.id ? 'text-neutral-400' : 'text-neutral-400'}`}>{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-2 border-orange-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Recommended plan</p>
                <p className="text-lg font-black text-neutral-900">{recommended.charAt(0).toUpperCase() + recommended.slice(1)}</p>
                <p className="text-xs text-neutral-400">~{totalNeeded} analyses/mo needed ({ownNeeded} own + {competitorNeeded} competitor)</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-orange-600">
                  ${billingCycle === 'annual'
                    ? PLANS.find(p => p.plan === recommended)!.annualPrice
                    : PLANS.find(p => p.plan === recommended)!.monthlyPrice}
                </p>
                <p className="text-xs text-neutral-400">/month</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
