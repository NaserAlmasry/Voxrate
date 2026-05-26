'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import CheckoutButton from '@/app/components/CheckoutButton'
import { useToast } from '@/app/components/Toast'

const CREDIT_PACKS = [
  { id: 'starter_pack', credits: 100, price: '$4.99',  analyses: '5 analyses',  label: 'Starter Pack' },
  { id: 'growth_pack',  credits: 300, price: '$12.99', analyses: '15 analyses', label: 'Growth Pack', popular: true },
  { id: 'pro_pack',     credits: 700, price: '$24.99', analyses: '35 analyses', label: 'Pro Pack' },
]

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('free')
  const [credits, setCredits] = useState<number | null>(null)
  const [joinedDate, setJoinedDate] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authProvider, setAuthProvider] = useState<string>('')
  const [renewalDate, setRenewalDate] = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [digestSaving, setDigestSaving] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current
  const toast    = useToast()

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    setName(user.user_metadata?.full_name ?? '')
    setAuthProvider(user.app_metadata?.provider ?? '')
    const date = new Date(user.created_at)
    setJoinedDate(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))

    const { data } = await supabase.from('users').select('plan, credits, is_admin, stripe_current_period_end, weekly_digest_enabled').eq('id', user.id).single()
    if (data?.plan) setPlan(data.plan)
    if (data?.credits != null) setCredits(data.credits)
    if (data?.is_admin) setIsAdmin(true)
    if (data?.weekly_digest_enabled != null) setWeeklyDigest(data.weekly_digest_enabled)
    if (data?.stripe_current_period_end) {
      setRenewalDate(new Date(data.stripe_current_period_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    }
  }

  useEffect(() => {
    loadUser()
    if (window.location.search.includes('upgraded=true')) {
      window.history.replaceState({}, '', '/dashboard/settings')
      const t = setTimeout(() => loadUser(), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  const openCustomerPortal = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
      else toast('Could not open billing portal. Please try again.', 'error')
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setPortalLoading(false)
    }
  }

  const toggleWeeklyDigest = async (val: boolean) => {
    setDigestSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ weekly_digest_enabled: val }).eq('id', user.id)
    }
    setWeeklyDigest(val)
    setDigestSaving(false)
    toast(val ? 'Weekly digest enabled' : 'Weekly digest disabled', 'success')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      {isAdmin && (
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
          <span className="text-orange-500">🔑</span>
          <p className="text-sm text-orange-700 font-medium">Admin account — full access, unlimited credits</p>
        </div>
      )}

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Name</p>
            <p className="text-sm font-medium">{name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Email</p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Member since</p>
            <p className="text-sm font-medium">{joinedDate}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Signed in with</p>
            <div className="flex items-center gap-2">
              {authProvider === 'google' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <p className="text-sm font-medium">Google</p>
                </>
              ) : (
                <p className="text-sm font-medium">{authProvider === 'email' ? 'Email / Password' : 'Email'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credits & Plan */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-700">Credits & Plan</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            isAdmin        ? 'bg-orange-100 text-orange-700' :
            plan === 'pro' ? 'bg-orange-100 text-orange-700' :
            plan === 'starter' ? 'bg-blue-50 text-blue-700' :
            'bg-neutral-100 text-neutral-500'
          }`}>
            {isAdmin ? 'Admin' : plan.charAt(0).toUpperCase() + plan.slice(1)}
          </span>
        </div>

        {/* Credit balance */}
        {!isAdmin && (
          <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100 mb-5">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{credits ?? '—'}</p>
              <p className="text-xs text-amber-600">credits remaining · 20 per analysis, 35 per competitor</p>
            </div>
          </div>
        )}

        {/* Subscription info */}
        {!isAdmin && plan !== 'free' && (
          <div className="rounded-xl border border-neutral-200 p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <p className="text-neutral-700 font-medium">{plan.charAt(0).toUpperCase() + plan.slice(1)} plan — monthly</p>
                <p className="text-neutral-400">
                  {plan === 'pro' ? '2,000' : plan === 'growth' ? '800' : '300'} credits refresh on{' '}
                  <span className="font-medium text-neutral-600">{renewalDate || '…'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
              <button
                onClick={openCustomerPortal}
                disabled={portalLoading}
                className="px-4 py-2 text-xs font-medium border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Opening…' : 'Manage billing'}
              </button>
              <button
                onClick={openCustomerPortal}
                disabled={portalLoading}
                className="px-4 py-2 text-xs font-medium border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Opening…' : 'Cancel subscription'}
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">Cancelling stops future charges. You keep access until {renewalDate || 'your billing date'}.</p>
          </div>
        )}

        {/* Upgrade CTA for free plan */}
        {!isAdmin && plan === 'free' && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <CheckoutButton
              plan="starter" billing="monthly"
              label="Starter · $9.99"
              className="py-2.5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
            />
            <CheckoutButton
              plan="growth" billing="monthly"
              label="Growth · $24.99"
              className="py-2.5 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
            />
            <CheckoutButton
              plan="pro" billing="monthly"
              label="Pro · $49.99"
              className="py-2.5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* Credit packs */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-1">Buy credit packs</h2>
          <p className="text-xs text-neutral-400 mb-4">One-time purchase, never expire. Stack on top of your subscription.</p>

          <div className="grid grid-cols-3 gap-3">
            {CREDIT_PACKS.map(p => (
              <div key={p.id} className={`relative border rounded-xl p-4 ${p.popular ? 'border-orange-300 bg-orange-50' : 'border-neutral-200'}`}>
                {p.popular && (
                  <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">BEST VALUE</span>
                )}
                <p className="text-sm font-bold">{p.price}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{p.credits} credits</p>
                <p className="text-xs text-neutral-400">≈ {p.analyses}</p>
                <CheckoutButton
                  pack={p.id as any}
                  label="Buy"
                  className={`mt-3 w-full py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                    p.popular
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-black text-white hover:bg-neutral-800'
                  }`}
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-neutral-400 mt-3">
            Credits cost: 20 credits per own listing analysis, 35 per competitor. AI tools (rewriter, grade, builder, reply) are free.
          </p>
        </div>
      )}

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Notifications</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-800">Weekly digest email</p>
            <p className="text-xs text-neutral-400 mt-0.5">Receive a Monday morning summary of your shop health, alerts, and an AI priority action.</p>
          </div>
          <button
            role="switch"
            aria-checked={weeklyDigest}
            disabled={digestSaving}
            onClick={() => toggleWeeklyDigest(!weeklyDigest)}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${weeklyDigest ? 'bg-orange-500' : 'bg-neutral-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${weeklyDigest ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Account actions */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Account actions</h2>
        <div className="flex flex-col gap-3">
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
            className="w-fit px-4 py-2 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            Sign out
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-fit px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              Delete account
            </button>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-medium text-red-700 mb-1">Are you sure?</p>
              <p className="text-xs text-red-500 mb-3">
                Your account and all data will be permanently deleted. Your subscription will be cancelled immediately. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/account/delete', {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                      })
                      if (res.ok) {
                        await supabase.auth.signOut()
                        window.location.href = '/?deleted=1'
                      } else {
                        const data = await res.json()
                        toast(data.error || 'Failed to delete account. Please contact support.', 'error')
                      }
                    } catch {
                      toast('Something went wrong. Please contact support.', 'error')
                    }
                  }}
                  className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, delete my account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
