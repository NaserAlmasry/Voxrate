'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'voxrate_onboarding_dismissed'

const TOUR_ITEMS = [
  {
    label: 'Analyze',
    href: '/dashboard',
    color: 'bg-orange-50 text-orange-500 border-orange-100',
    desc: 'Paste any Etsy listing URL and get a full health report with real customer insights.',
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    label: 'Competitor',
    href: '/dashboard/competitor',
    color: 'bg-blue-50 text-blue-500 border-blue-100',
    desc: 'Analyze any competitor listing and find exactly where they are weak.',
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    label: 'Compare',
    href: '/dashboard/compare',
    color: 'bg-purple-50 text-purple-500 border-purple-100',
    desc: 'Side-by-side breakdown — your listing vs theirs, complaint by complaint.',
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: 'Watchlist',
    href: '/dashboard/watchlist',
    color: 'bg-green-50 text-green-500 border-green-100',
    desc: 'Track competitors over time and get alerted the moment their score changes.',
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    label: 'Library',
    href: '/dashboard/library',
    color: 'bg-neutral-50 text-neutral-500 border-neutral-200',
    desc: 'Every product you\'ve analyzed, saved in one place. Jump back anytime.',
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
]

const STEPS = [
  {
    icon: (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    title: 'Analyze your first listing',
    description: 'Paste any Etsy listing URL and Voxrate reads thousands of real customer reviews to surface your listing\'s health score, top complaints, proven strengths, and the exact fixes that will move the needle.',
    highlights: ['Health score out of 100', 'Top customer complaints ranked by frequency', 'Proven strengths to double down on', 'One-click quick wins to act on today'],
    cta: 'Analyze a listing →',
    href: '/dashboard',
  },
  {
    icon: (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: 'Spy on your competitors',
    description: 'Run the same analysis on any competitor\'s listing. See their real weaknesses — the complaints their customers keep repeating — then compare side by side to find exactly where you have the edge and where they beat you.',
    highlights: ['Find their most complained-about problems', 'See which of their strengths you\'re missing', 'Compare scores side by side', 'Discover gaps in their listing you can exploit'],
    cta: 'Analyze a competitor →',
    href: '/dashboard/competitor',
  },
  {
    icon: (
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    title: 'Your dashboard at a glance',
    description: 'Everything you need is in the sidebar. Here\'s a quick map so you always know where to go.',
    highlights: [],
    cta: 'Start exploring →',
    href: '/dashboard',
    isTour: true,
  },
]

export default function OnboardingModal() {
  const [show, setShow]               = useState(false)
  const [step, setStep]               = useState(0)
  const [hoveredTour, setHoveredTour] = useState<number | null>(null)
  const userIdRef                     = useRef('')          // ref avoids stale closure in dismiss()
  const dismissingRef                 = useRef(false)       // prevent double-dismiss
  const supabase                      = useMemo(() => createClient(), [])
  const router                        = useRouter()
  const closeButtonRef                = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    let active = true

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active || !user) return
      userIdRef.current = user.id

      const { data: userData } = await supabase.from('users').select('onboarding_done').eq('id', user.id).single()

      if (!active) return
      if (userData?.onboarding_done) {
        localStorage.setItem(STORAGE_KEY, '1')
        return
      }
      setShow(true)
    })

    return () => { active = false }
  }, [supabase])

  // Focus close button when modal opens
  useEffect(() => {
    if (show) closeButtonRef.current?.focus()
  }, [show])

  // Escape key dismisses modal
  useEffect(() => {
    if (!show) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [show]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = async () => {
    if (dismissingRef.current) return
    dismissingRef.current = true
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
    const uid = userIdRef.current
    if (uid) {
      try {
        await supabase.from('users').update({ onboarding_done: true }).eq('id', uid)
      } catch {}
    }
    dismissingRef.current = false
  }

  const goToStep = async (href: string) => {
    await dismiss()
    router.push(href)
  }

  if (!show) return null

  const s = STEPS[step]
  if (!s) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ animation: 'onboardIn 0.3s ease forwards' }}
      >
        <style>{`@keyframes onboardIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* Header */}
        <div className="bg-black px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <span id="onboarding-title" className="text-lg font-black text-white tracking-tight">Welcome to Voxrate</span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={dismiss}
              aria-label="Close onboarding"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p className="text-xs text-neutral-400">Get the most out of Voxrate in 3 quick steps</p>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === step ? 'step' : undefined}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-orange-500' : i < step ? 'w-4 bg-orange-300' : 'w-4 bg-neutral-700'}`}
              />
            ))}
            <span className="ml-auto text-[11px] text-neutral-500" aria-live="polite">{step + 1} / {STEPS.length}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-4" aria-hidden="true">
            {s.icon}
          </div>
          <h2 className="text-base font-bold text-neutral-900 mb-2">Step {step + 1}: {s.title}</h2>
          <p className="text-sm text-neutral-500 leading-relaxed mb-4">{s.description}</p>

          {/* Highlights */}
          {s.highlights.length > 0 && (
            <ul className="space-y-1.5 mb-5" aria-label="What you get">
              {s.highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                  <span aria-hidden="true" className="w-4 h-4 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0">
                    <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Dashboard Tour */}
          {s.isTour && (
            <div className="space-y-1.5 mb-5" role="list" aria-label="Dashboard sections">
              {TOUR_ITEMS.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  onClick={() => goToStep(item.href)}
                  onMouseEnter={() => setHoveredTour(i)}
                  onMouseLeave={() => setHoveredTour(null)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl border transition-all text-left ${hoveredTour === i ? item.color : 'border-transparent hover:bg-neutral-50'}`}
                >
                  <span aria-hidden="true" className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">{item.label}</p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => goToStep(s.href)}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors mb-3"
          >
            {s.cta}
          </button>

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)} className="text-xs text-neutral-400 hover:text-black transition-colors">← Back</button>
            ) : <span />}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} className="text-xs text-neutral-400 hover:text-black transition-colors">Next step →</button>
            ) : (
              <button type="button" onClick={dismiss} className="text-xs text-neutral-400 hover:text-black transition-colors">Done, let me explore</button>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-neutral-100 text-center">
          <button type="button" onClick={dismiss} className="text-xs text-neutral-300 hover:text-neutral-500 transition-colors">
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  )
}
