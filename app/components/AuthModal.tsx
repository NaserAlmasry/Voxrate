'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'

type Plan = 'free' | 'starter' | 'pro'

const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Free',
    price: '$0',
    sub: 'No credit card required',
    credits: '24 credits',
    analyses: '1 full analysis',
    features: ['1 own-listing analysis', 'Listing grader', 'AI rewriter', 'Reply generator'],
    cta: 'Start free',
    highlight: false,
  },
  {
    id: 'starter' as Plan,
    name: 'Starter',
    price: '$9.99',
    sub: '/month',
    credits: '720 credits/mo',
    analyses: '≈ 30 analyses',
    features: ['720 credits/month', 'All analysis features', 'Competitor watchlist', 'Credits roll over'],
    cta: 'Start Starter',
    highlight: false,
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: '$19.99',
    sub: '/month',
    credits: '2,400 credits/mo',
    analyses: '≈ 100 analyses',
    features: ['2,400 credits/month', 'All analysis features', 'Competitor watchlist + alerts', 'Priority support'],
    cta: 'Start Pro',
    highlight: true,
  },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

interface AuthModalProps {
  onClose: () => void
  defaultPlan?: Plan
}

export default function AuthModal({ onClose, defaultPlan }: AuthModalProps) {
  const [step, setStep] = useState<'plan' | 'auth'>(defaultPlan ? 'auth' : 'plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan || 'free')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const supabase = createClient()

  const googleOAuthOptions = (plan: Plan) => ({
    redirectTo: plan === 'free'
      ? `${window.location.origin}/auth/callback`
      : `${window.location.origin}/auth/callback?pendingPlan=${plan}&pendingBilling=monthly`,
    queryParams: { access_type: 'offline', prompt: 'consent' },
  })

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: googleOAuthOptions(selectedPlan),
    })
  }

  const handleEmail = async () => {
    setError('')
    setLoading(true)
    try {
      if (authMode === 'signup') {
        const redirectTo = selectedPlan === 'free'
          ? `${window.location.origin}/auth/callback`
          : `${window.location.origin}/auth/callback?pendingPlan=${selectedPlan}&pendingBilling=monthly`
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirectTo },
        })
        if (error) { setError(error.message); return }
        setEmailSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        window.location.href = '/dashboard'
      }
    } finally {
      setLoading(false)
    }
  }

  const selectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setStep('auth')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="font-semibold text-base">
              {step === 'plan' ? 'Choose your plan' : `${authMode === 'signup' ? 'Create account' : 'Sign in'} — ${PLANS.find(p => p.id === selectedPlan)?.name} plan`}
            </h2>
            {step === 'auth' && (
              <button onClick={() => setStep('plan')} className="text-xs text-neutral-400 hover:text-black mt-0.5">← Change plan</button>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-black text-xl leading-none">×</button>
        </div>

        <div className="p-6">
          {/* Step 1 — Plan selection */}
          {step === 'plan' && (
            <div className="space-y-3">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => selectPlan(plan.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:border-black ${plan.highlight ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${plan.highlight ? 'text-white' : ''}`}>{plan.name}</span>
                      {plan.highlight && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Best value</span>}
                      {plan.id === 'free' && <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">No credit card</span>}
                    </div>
                    <span className={`font-bold text-sm ${plan.highlight ? 'text-white' : ''}`}>{plan.price}<span className={`text-xs font-normal ml-0.5 ${plan.highlight ? 'text-neutral-400' : 'text-neutral-400'}`}>{plan.sub}</span></span>
                  </div>
                  <p className={`text-xs mb-2 ${plan.highlight ? 'text-neutral-400' : 'text-neutral-500'}`}>{plan.credits} · {plan.analyses}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {plan.features.map(f => (
                      <span key={f} className={`text-xs flex items-center gap-1 ${plan.highlight ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        <span className={plan.highlight ? 'text-orange-400' : 'text-green-500'}>✓</span>{f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Auth */}
          {step === 'auth' && (
            <div>
              {emailSent ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">📧</div>
                  <p className="font-semibold mb-1">Check your email</p>
                  <p className="text-sm text-neutral-500">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
                </div>
              ) : (
                <>
                  {/* Google button */}
                  <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors mb-4">
                    <GoogleIcon /> Continue with Google
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-neutral-200" />
                    <span className="text-xs text-neutral-400">or</span>
                    <div className="flex-1 h-px bg-neutral-200" />
                  </div>

                  {/* Email form */}
                  <div className="space-y-3">
                    <input
                      type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black"
                    />
                    <input
                      type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEmail()}
                      className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black"
                    />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button
                      onClick={handleEmail} disabled={loading || !email || !password}
                      className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}
                    </button>
                  </div>

                  <p className="text-center text-xs text-neutral-500 mt-4">
                    {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                    <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError('') }} className="text-black font-medium hover:underline">
                      {authMode === 'signup' ? 'Sign in' : 'Sign up'}
                    </button>
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
