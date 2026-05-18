'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'

type Plan = 'free' | 'starter' | 'growth' | 'pro'
type Pack = 'starter_pack' | 'growth_pack' | 'pro_pack'
type Selection = { type: 'plan'; plan: Plan } | { type: 'pack'; pack: Pack }

const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Free',
    price: '$0',
    sub: '',
    badge: 'No credit card',
    badgeCls: 'bg-neutral-100 text-neutral-600',
    desc: '1 partial analysis included · expires in 7 days',
    features: ['20 credits (1 analysis)', 'Listing grader', 'AI rewriter', 'Reply generator'],
    highlight: false,
  },
  {
    id: 'starter' as Plan,
    name: 'Starter',
    price: '$9.99',
    sub: '/mo',
    badge: 'Monthly',
    badgeCls: 'bg-neutral-200 text-neutral-700',
    desc: '300 credits/month · ≈15 analyses',
    features: ['300 credits/month', '1 competitor analysis/month', 'Full own-listing reports', 'All free tools'],
    highlight: false,
  },
  {
    id: 'growth' as Plan,
    name: 'Growth',
    price: '$24.99',
    sub: '/mo',
    badge: 'Most popular',
    badgeCls: 'bg-orange-500 text-white',
    desc: '800 credits/month · ≈40 analyses',
    features: ['800 credits/month', '3 competitor analyses per product/mo', 'Side-by-side battle card', 'All free tools'],
    highlight: true,
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: '$49.99',
    sub: '/mo',
    badge: 'Best value',
    badgeCls: 'bg-neutral-200 text-neutral-700',
    desc: '2,000 credits/month · ≈100 analyses',
    features: ['2,000 credits/month', '10 competitor analyses per product/mo', 'Priority support', 'All free tools'],
    highlight: false,
  },
]

const PACKS = [
  { id: 'starter_pack' as Pack, name: 'Starter Pack', price: '$4.99', credits: '100 credits', analyses: '≈5 analyses' },
  { id: 'growth_pack' as Pack, name: 'Growth Pack', price: '$12.99', credits: '300 credits', analyses: '≈15 analyses', popular: true },
  { id: 'pro_pack' as Pack, name: 'Pro Pack', price: '$24.99', credits: '700 credits', analyses: '≈35 analyses' },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

interface Props {
  onClose: () => void
  initialStep?: 'plan' | 'auth'
  initialAuthMode?: 'signup' | 'login'
}

export default function AuthModal({ onClose, initialStep = 'plan', initialAuthMode = 'signup' }: Props) {
  const supabase = createClient()

  const [tab, setTab]             = useState<'subscription' | 'packs'>('subscription')
  const [step, setStep]           = useState<'plan' | 'auth'>(initialStep)
  const [authMode, setAuthMode]   = useState<'signup' | 'login'>(initialAuthMode)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const redirectUrl = (sel: Selection) => {
    const base = window.location.origin
    if (sel.type === 'plan' && sel.plan === 'free') return `${base}/auth/callback`
    if (sel.type === 'plan') return `${base}/auth/callback?pendingPlan=${sel.plan}&pendingBilling=monthly`
    return `${base}/auth/callback?pendingPack=${sel.pack}`
  }

  const handleGoogle = async () => {
    const redirect = selection ? redirectUrl(selection) : `${window.location.origin}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirect,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
  }

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) return
    if (authMode === 'signup' && !selection) { setError('Please select a plan first.'); return }
    setError('')
    setLoading(true)
    if (authMode === 'signup' && selection) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectUrl(selection) },
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      if (data.session) {
        // Email confirmations off — session granted immediately
        window.location.href = redirectUrl(selection).replace(window.location.origin, '') || '/dashboard'
      } else {
        setEmailSent(true)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setLoading(false)
      if (error) { setError('Invalid email or password.'); return }
      window.location.href = '/dashboard'
    }
  }

  const selectPlan = (sel: Selection) => { setSelection(sel); setStep('auth') }

  const selLabel = selection
    ? selection.type === 'plan'
      ? PLANS.find(p => p.id === selection.plan)?.name + ' plan'
      : PACKS.find(p => p.id === selection.pack)?.name
    : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100 shrink-0">
          <div>
            <p className="font-semibold text-sm">
              {step === 'plan' ? 'Get started with Voxrate' : authMode === 'login' && !selection ? 'Sign in to Voxrate' : `Continue — ${selLabel}`}
            </p>
            {step === 'auth' && selection && (
              <button onClick={() => { setStep('plan'); setError('') }}
                className="text-xs text-neutral-400 hover:text-black mt-0.5 block">← Back to plans</button>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-black text-lg">×</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">

          {/* ── STEP 1: Plan picker ── */}
          {!emailSent && step === 'plan' && (
            <>
              <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-4">
                {(['subscription', 'packs'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === t ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}>
                    {t === 'subscription' ? 'Monthly plans' : 'One-time packs'}
                  </button>
                ))}
              </div>

              {tab === 'subscription' && (
                <div className="space-y-2.5">
                  {PLANS.map(p => (
                    <button key={p.id} onClick={() => selectPlan({ type: 'plan', plan: p.id })}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${p.highlight ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-black'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{p.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.badgeCls}`}>{p.badge}</span>
                        </div>
                        <span className="font-bold text-sm">{p.price}<span className={`text-xs font-normal ${p.highlight ? 'text-neutral-400' : 'text-neutral-400'}`}>{p.sub}</span></span>
                      </div>
                      <p className={`text-xs mb-2 ${p.highlight ? 'text-neutral-400' : 'text-neutral-500'}`}>{p.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {p.features.map(f => (
                          <span key={f} className={`text-xs flex items-center gap-1 ${p.highlight ? 'text-neutral-300' : 'text-neutral-500'}`}>
                            <span className={p.highlight ? 'text-orange-400' : 'text-green-500'}>✓</span>{f}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'packs' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-neutral-500 mb-3">One-time purchase · credits never expire · no subscription needed</p>
                  {PACKS.map(p => (
                    <button key={p.id} onClick={() => selectPlan({ type: 'pack', pack: p.id })}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${p.popular ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-black'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{p.name}</span>
                          {p.popular && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Popular</span>}
                        </div>
                        <span className="font-bold text-sm">{p.price}</span>
                      </div>
                      <p className={`text-xs ${p.popular ? 'text-neutral-400' : 'text-neutral-500'}`}>{p.credits} · {p.analyses} · never expire</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-neutral-100 text-center">
                <span className="text-xs text-neutral-400">Already have an account?{' '}</span>
                <button
                  onClick={() => { setStep('auth'); setAuthMode('login'); setError('') }}
                  className="text-xs font-medium text-black hover:underline"
                >
                  Sign in
                </button>
              </div>
            </>
          )}

          {/* ── Email sent confirmation ── */}
          {emailSent && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h2 className="text-base font-bold text-neutral-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-neutral-500 mb-1">We sent a confirmation link to</p>
              <p className="text-sm font-semibold text-neutral-800 mb-4">{email}</p>
              <p className="text-xs text-neutral-400">Click the link in the email to activate your account. Check your spam folder if you don't see it.</p>
            </div>
          )}

          {/* ── STEP 2: Auth ── */}
          {!emailSent && step === 'auth' && (
            <>
              {/* Google */}
              <button onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 border-2 border-neutral-200 rounded-xl text-sm font-medium hover:border-black transition-all mb-4">
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">or with email</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>

              {/* Email + Password */}
              <div className="space-y-3">
                <input
                  type="email" placeholder="Email address" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                />
                <input
                  type="password" placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  onClick={handleEmailAuth}
                  disabled={loading || !email.trim() || !password}
                  className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  {loading ? 'Please wait…' : authMode === 'signup' ? 'Create account →' : 'Sign in →'}
                </button>
              </div>

              {/* Forgot password — email login mode */}
              {authMode === 'login' && (
                <p className="text-center text-xs text-neutral-400 mt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email.trim()) { setError('Enter your email address above first.'); return }
                      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                        redirectTo: `${window.location.origin}/auth/callback`,
                      })
                      setError(error ? error.message : 'Password reset email sent — check your inbox.')
                    }}
                    className="text-neutral-400 hover:text-black hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </p>
              )}

              {/* Login-only: link to plans */}
              {authMode === 'login' && !selection && (
                <p className="text-center text-xs text-neutral-400 mt-3">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { onClose(); setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                    className="font-medium text-black hover:underline"
                  >
                    See plans →
                  </button>
                </p>
              )}

              {/* Signup: link back to plans */}
              {authMode === 'signup' && selection && (
                <p className="text-center text-xs text-neutral-400 mt-4">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError('') }}
                    className="font-medium text-black hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
