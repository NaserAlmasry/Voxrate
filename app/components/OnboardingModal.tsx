'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    title: 'Analyze your first listing',
    description: 'Paste any Etsy listing URL to get a health score, complaints, strengths, and SEO keywords — in under 60 seconds.',
    cta: 'Analyze a listing →',
    href: '/dashboard',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    title: 'Spy on a competitor',
    description: 'Analyze a competitor\'s listing to see their weaknesses and opportunities you can exploit — then compare side by side.',
    cta: 'Analyze a competitor →',
    href: '/dashboard/competitor',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    title: 'Rewrite your description',
    description: 'Use AI to rewrite your listing description with your SEO keywords and review insights automatically woven in.',
    cta: 'Try description rewriter →',
    href: '/dashboard/rewrite',
  },
]

const STORAGE_KEY = 'voxrate_onboarding_dismissed'

export default function OnboardingModal() {
  const [show, setShow]       = useState(false)
  const [step, setStep]       = useState(0)
  const [userId, setUserId]   = useState('')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    // Check localStorage first for instant response
    if (localStorage.getItem(STORAGE_KEY)) return

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      // Check if user has dismissed onboarding or already has reports
      const [{ data: userData }, { count }] = await Promise.all([
        supabase.from('users').select('onboarding_done').eq('id', user.id).single(),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      if (userData?.onboarding_done || (count && count > 0)) {
        localStorage.setItem(STORAGE_KEY, '1')
        return
      }

      setShow(true)
    })
  }, [])

  const dismiss = async () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
    if (userId) {
      await supabase.from('users').update({ onboarding_done: true }).eq('id', userId)
    }
  }

  const goToStep = async (href: string) => {
    await dismiss()
    router.push(href)
  }

  if (!show) return null

  const s = STEPS[step]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-black px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-lg font-black text-white">Welcome to Voxrate</span>
            <button onClick={dismiss} className="text-neutral-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p className="text-xs text-neutral-400">Let's get you started in 3 quick steps</p>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-orange-500' : 'w-1.5 bg-neutral-600'}`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-6">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
            {s.icon}
          </div>
          <h2 className="text-base font-bold text-neutral-900 mb-2">
            Step {step + 1}: {s.title}
          </h2>
          <p className="text-sm text-neutral-500 leading-relaxed mb-6">{s.description}</p>

          <button
            onClick={() => goToStep(s.href)}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors mb-3"
          >
            {s.cta}
          </button>

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} className="text-xs text-neutral-400 hover:text-black transition-colors">← Back</button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="text-xs text-neutral-400 hover:text-black transition-colors">Next step →</button>
            ) : (
              <button onClick={dismiss} className="text-xs text-neutral-400 hover:text-black transition-colors">Done, let me explore</button>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-neutral-100 text-center">
          <button onClick={dismiss} className="text-xs text-neutral-300 hover:text-neutral-500 transition-colors">
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  )
}
