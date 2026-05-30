'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import CheckoutButton from '@/app/components/CheckoutButton'
import { useToast } from '@/app/components/Toast'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('free')
  const [ownRemaining, setOwnRemaining] = useState<number | null>(null)
  const [competitorRemaining, setCompetitorRemaining] = useState<number | null>(null)
  const [joinedDate, setJoinedDate] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authProvider, setAuthProvider] = useState<string>('')
  const [renewalDate, setRenewalDate] = useState('')
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [digestFrequency, setDigestFrequency] = useState<'weekly' | 'daily'>('weekly')
  const [digestSaving, setDigestSaving] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [amazonConnected, setAmazonConnected] = useState(false)
  const [amazonPartnerId, setAmazonPartnerId] = useState<string | null>(null)
  const [amazonConnectedAt, setAmazonConnectedAt] = useState<string | null>(null)
  const [amazonDisconnecting, setAmazonDisconnecting] = useState(false)
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

    const { data } = await supabase.from('users').select('plan, own_analyses_remaining, competitor_analyses_remaining, is_admin, stripe_current_period_end, weekly_digest_enabled, digest_frequency, trial_ends_at, webhook_url, slack_webhook_url').eq('id', user.id).single()
    if (data?.plan) setPlan(data.plan)
    if (data?.own_analyses_remaining != null) setOwnRemaining(data.own_analyses_remaining)
    if (data?.competitor_analyses_remaining != null) setCompetitorRemaining(data.competitor_analyses_remaining)
    if (data?.is_admin) setIsAdmin(true)
    if (data?.weekly_digest_enabled != null) setWeeklyDigest(data.weekly_digest_enabled)
    if (data?.digest_frequency) setDigestFrequency(data.digest_frequency as 'weekly' | 'daily')
    if (data?.webhook_url) setWebhookUrl(data.webhook_url)
    if (data?.slack_webhook_url) setSlackWebhookUrl(data.slack_webhook_url)

    if (data?.stripe_current_period_end) {
      setRenewalDate(new Date(data.stripe_current_period_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    }
    if (data?.trial_ends_at) {
      setTrialEndsAt(data.trial_ends_at)
      const daysLeft = Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / 86400000)
      setTrialDaysLeft(daysLeft > 0 ? daysLeft : 0)
    }
  }

  useEffect(() => {
    loadUser()
    fetch('/api/amazon/status', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.connected) {
          setAmazonConnected(true)
          setAmazonPartnerId(d.selling_partner_id)
          setAmazonConnectedAt(d.connected_at)
        }
      })
      .catch(() => {})
    if (window.location.search.includes('amazon_connected=true')) {
      setAmazonConnected(true)
      window.history.replaceState({}, '', '/dashboard/settings')
      toast('Amazon account connected successfully', 'success')
    }
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
    toast(val ? 'Digest enabled' : 'Digest disabled', 'success')
  }

  const saveWebhooks = async () => {
    setWebhookSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const trimmed = webhookUrl.trim()
      const slackTrimmed = slackWebhookUrl.trim()
      if (trimmed && !trimmed.startsWith('https://')) {
        toast('Webhook URL must start with https://', 'error')
        setWebhookSaving(false)
        return
      }
      if (slackTrimmed && !slackTrimmed.startsWith('https://hooks.slack.com/')) {
        toast('Slack webhook must be a hooks.slack.com URL', 'error')
        setWebhookSaving(false)
        return
      }
      await supabase.from('users').update({
        webhook_url:       trimmed || null,
        slack_webhook_url: slackTrimmed || null,
      }).eq('id', user.id)
    }
    setWebhookSaving(false)
    toast('Webhook settings saved', 'success')
  }

  const disconnectAmazon = async () => {
    setAmazonDisconnecting(true)
    try {
      const res = await fetch('/api/amazon/connect', {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (res.ok) {
        setAmazonConnected(false)
        setAmazonPartnerId(null)
        setAmazonConnectedAt(null)
        toast('Amazon account disconnected', 'success')
      } else {
        toast('Failed to disconnect. Please try again.', 'error')
      }
    } catch {
      toast('Something went wrong.', 'error')
    } finally {
      setAmazonDisconnecting(false)
    }
  }

  const setDigestFreq = async (freq: 'weekly' | 'daily') => {
    setDigestSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ digest_frequency: freq }).eq('id', user.id)
    }
    setDigestFrequency(freq)
    setDigestSaving(false)
    toast(`Digest set to ${freq}`, 'success')
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

      {/* Plan & Analyses */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-700">Plan & Analyses</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            isAdmin        ? 'bg-orange-100 text-orange-700' :
            plan === 'pro' ? 'bg-purple-100 text-purple-700' :
            plan === 'growth' ? 'bg-orange-100 text-orange-700' :
            plan === 'starter' ? 'bg-blue-50 text-blue-700' :
            'bg-neutral-100 text-neutral-500'
          }`}>
            {isAdmin ? 'Admin' : plan.charAt(0).toUpperCase() + plan.slice(1)}
          </span>
        </div>

        {/* Analyses remaining */}
        {!isAdmin && plan !== 'free' && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
              <p className="text-2xl font-black text-orange-700">{ownRemaining ?? '—'}</p>
              <p className="text-xs text-orange-600 mt-0.5">own analyses left this month</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-2xl font-black text-blue-700">{competitorRemaining ?? '—'}</p>
              <p className="text-xs text-blue-600 mt-0.5">competitor analyses left</p>
            </div>
          </div>
        )}

        {!isAdmin && plan !== 'free' && (
          <p className="text-xs text-neutral-400 mb-5">
            ↩ Unused analyses roll over automatically — up to {plan === 'pro' ? '3 months' : '2 months'} banked.
            Renews on <span className="font-medium text-neutral-600">{renewalDate || '…'}</span>
          </p>
        )}

        {/* Subscription management */}
        {!isAdmin && plan !== 'free' && (
          <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
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
        )}
        {!isAdmin && plan !== 'free' && (
          <p className="text-[11px] text-neutral-400 mt-2">Cancelling stops future charges. You keep access until {renewalDate || 'your billing date'}.</p>
        )}

        {/* Upgrade CTA for free plan */}
        {!isAdmin && plan === 'free' && (
          <>
            {trialDaysLeft !== null && trialDaysLeft > 0 && trialEndsAt && (
              <div className={`flex items-center justify-between p-3 rounded-xl border mb-4 ${trialDaysLeft <= 2 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                <div>
                  <p className={`text-xs font-semibold ${trialDaysLeft <= 2 ? 'text-red-700' : 'text-orange-700'}`}>
                    Free trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Trial ends {new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                <a href="/#pricing" className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${trialDaysLeft <= 2 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                  Upgrade →
                </a>
              </div>
            )}
            <p className="text-xs text-neutral-400 mb-4">You have 1 lifetime analysis. Upgrade to unlock monthly analyses with rollover.</p>
            <div className="grid grid-cols-3 gap-2">
              <CheckoutButton
                plan="starter" billing="monthly"
                label="Starter · $14.99"
                className="py-2.5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
              />
              <CheckoutButton
                plan="growth" billing="monthly"
                label="Growth · $39.99"
                className="py-2.5 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
              />
              <CheckoutButton
                plan="pro" billing="monthly"
                label="Pro · $59.99"
                className="py-2.5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
              />
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Notifications</h2>

        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-medium">Weekly digest email</p>
            <p className="text-xs text-neutral-400 mt-0.5">Get a weekly summary of your product health scores and top complaints</p>
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

        {/* Frequency — Pro only */}
        {plan === 'pro' && weeklyDigest && (
          <div className="pt-4 border-t border-neutral-100">
            <p className="text-xs font-semibold text-neutral-600 mb-2">Digest frequency <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">Pro</span></p>
            <div className="grid grid-cols-2 gap-2">
              {(['weekly', 'daily'] as const).map(freq => (
                <button
                  key={freq}
                  disabled={digestSaving}
                  onClick={() => setDigestFreq(freq)}
                  className={`p-3 text-left rounded-xl border transition-colors text-xs disabled:opacity-50 ${digestFrequency === freq ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700'}`}
                >
                  <p className="font-semibold capitalize">{freq}</p>
                  <p className={`text-[10px] mt-0.5 ${digestFrequency === freq ? 'text-neutral-400' : 'text-neutral-400'}`}>
                    {freq === 'weekly' ? 'Every Monday morning' : 'Every morning'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {plan !== 'pro' && (
          <p className="text-xs text-neutral-400 pt-3 border-t border-neutral-100">Daily digest available on Pro plan.</p>
        )}
      </div>

      {/* Webhooks — Starter and above */}
      {(plan !== 'free' || isAdmin) && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-1">Webhooks &amp; integrations</h2>
          <p className="text-xs text-neutral-400 mb-4">Receive alerts in your own system or Slack when a score drops or a new 1★ review appears.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Custom webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400"
              />
              <p className="text-[11px] text-neutral-400 mt-1">We&apos;ll POST JSON with event, ASIN, product name, score, and review text.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Slack incoming webhook URL</label>
              <input
                type="url"
                value={slackWebhookUrl}
                onChange={e => setSlackWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400"
              />
              <p className="text-[11px] text-neutral-400 mt-1">Get formatted Slack messages. <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="underline">How to create one</a>.</p>
            </div>
            <button
              onClick={saveWebhooks}
              disabled={webhookSaving}
              className="px-4 py-2 text-xs font-medium bg-black text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {webhookSaving ? 'Saving…' : 'Save webhook settings'}
            </button>
          </div>
        </div>
      )}


      {/* Amazon SP-API */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-700">Amazon Account Health</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Pro</span>
        </div>
        <p className="text-xs text-neutral-400 mb-4">Connect your Amazon Selling Partner account to monitor your Account Health Rating via Amazon&apos;s official SP-API. No scraping — direct API access.</p>

        {amazonConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-800">Connected</p>
                {amazonPartnerId && <p className="text-[10px] text-green-600 mt-0.5 font-mono truncate">{amazonPartnerId}</p>}
                {amazonConnectedAt && <p className="text-[10px] text-green-500 mt-0.5">Since {new Date(amazonConnectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              </div>
            </div>
            <button
              onClick={disconnectAmazon}
              disabled={amazonDisconnecting}
              className="px-4 py-2 text-xs font-medium border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {amazonDisconnecting ? 'Disconnecting…' : 'Disconnect Amazon account'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-neutral-300 flex-shrink-0" />
              <p className="text-xs text-neutral-500">Not connected</p>
            </div>
            {plan === 'pro' || isAdmin ? (
              <a
                href="/api/amazon/connect"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Connect Amazon account →
              </a>
            ) : (
              <p className="text-xs text-neutral-400">Available on <a href="/#pricing" className="underline font-medium text-neutral-600">Pro plan</a>.</p>
            )}
          </div>
        )}
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
