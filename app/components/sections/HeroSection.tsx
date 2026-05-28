'use client'

import { useState, useEffect } from 'react'

const HERO_HEADLINES = [
  {
    top: 'Your listing is leaking sales',
    accent: 'right now.',
    sub: "Your customers already wrote down exactly why — you just haven't seen it yet.",
  },
  {
    top: 'Your buyers already told you',
    accent: 'what to fix.',
    sub: 'The answers are buried in your reviews. Now you can read them.',
  },
  {
    top: 'Every complaint is a return',
    accent: "you didn't have to get.",
    sub: 'Find them before your next buyer does.',
  },
]

function HeroHeadline() {
  const [idx, setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % HERO_HEADLINES.length)
        setVisible(true)
      }, 600)
    }, 5_000)
    return () => clearInterval(timer)
  }, [])

  const h = HERO_HEADLINES[idx]
  return (
    <div className="mb-5" style={{ transition: 'opacity 0.6s ease', opacity: visible ? 1 : 0 }}>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-normal leading-[1.15] text-center">
        {h.top}<br />
        <span className="text-orange-500">{h.accent}</span>
      </h1>
      <p className="text-base md:text-lg text-neutral-500 text-center mt-4 max-w-lg mx-auto leading-relaxed">
        {h.sub}
      </p>
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
          <span className="text-[10px] text-neutral-400 ml-2 font-mono">voxrate.app</span>
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
          <p className="text-xs font-semibold text-white leading-snug">Add &ldquo;leak-proof lid&rdquo; to your title — fixes 43% of 1-star reviews</p>
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

function InlineStats() {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 scroll-fade">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-neutral-300">avg. ~1 min 20 sec per analysis</span>
      </div>
    </div>
  )
}

type Props = {
  heroUrl: string
  heroUrlError: string
  setHeroUrl: (v: string) => void
  setHeroUrlError: (v: string) => void
  analyzeHero: () => void
}

export default function HeroSection({ heroUrl, heroUrlError, setHeroUrl, setHeroUrlError, analyzeHero }: Props) {
  return (
    <section className="pt-28 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
          {/* Left: text + input */}
          <div className="flex-1 text-center">
            <div className="bdg inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-700 mb-3 cursor-default select-none">
              <span className="bdot w-1.5 h-1.5 rounded-full bg-orange-500" />
              TURN REVIEWS INTO REVENUE
            </div>
            <HeroHeadline />

            <div className="max-w-lg mx-auto w-full">
              <div className={`flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-2xl border shadow-sm transition-colors ${heroUrlError ? 'border-red-300' : 'border-neutral-200'}`}>
                <label htmlFor="hero-url" className="sr-only">Amazon product URL or ASIN</label>
                <input id="hero-url" type="url" value={heroUrl} onChange={e => { setHeroUrl(e.target.value); setHeroUrlError('') }}
                  onKeyDown={e => e.key === 'Enter' && analyzeHero()}
                  placeholder="Paste your Amazon URL or ASIN..."
                  className="flex-1 px-4 py-3 text-sm bg-transparent outline-none placeholder:text-neutral-400" />
                <button onClick={analyzeHero} className="glow-orange btn-press px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl whitespace-nowrap text-sm shadow-sm">
                  <span className="block leading-tight">Analyze →</span>
                  <span className="block text-[10px] text-orange-200 font-normal leading-tight mt-0.5">First analysis free</span>
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
  )
}
