'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Frequency = 'biweekly' | 'monthly'

const FREQ_LABEL: Record<Frequency, string> = {
  biweekly: 'Every 2 weeks',
  monthly:  'Monthly',
}

const FREQ_CREDITS: Record<Frequency, number> = {
  biweekly: 10,
  monthly:  15,
}

const FREQ_PER_LABEL: Record<Frequency, string> = {
  biweekly: '2 weeks',
  monthly:  'month',
}

interface Alert {
  id: string
  asin: string
  product_name: string | null
  marketplace: string
  frequency: Frequency
  active: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SentimentAlertsPage() {
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [plan, setPlan]           = useState('free')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [busy, setBusy]           = useState<string | null>(null)
  const [error, setError]         = useState('')

  // form
  const [asin, setAsin]               = useState('')
  const [productName, setProductName] = useState('')
  const [marketplace, setMarketplace] = useState('amazon.com')
  const [frequency, setFrequency]     = useState<Frequency>('biweekly')
  const [submitting, setSubmitting]     = useState(false)
  const [userReports, setUserReports]   = useState<{ asin: string; product_name: string }[]>([])
  const [manualAsin, setManualAsin]     = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: userData }, alertsRes, { data: reports }] = await Promise.all([
      supabase.from('users').select('plan').eq('id', user.id).single(),
      fetch('/api/sentiment-alerts', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()),
      supabase.from('reports').select('asin, product_name').eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(30),
    ])

    setPlan(userData?.plan || 'free')
    setAlerts(alertsRes.alerts || [])
    // deduplicate by asin
    const seen = new Set<string>()
    const unique = (reports || []).filter((r: any) => r.asin && !seen.has(r.asin) && seen.add(r.asin))
    setUserReports(unique)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const isEligible = plan === 'growth' || plan === 'pro'

  const resetForm = () => {
    setAsin(''); setProductName(''); setMarketplace('amazon.com'); setFrequency('biweekly'); setError(''); setManualAsin(false)
  }

  const submit = async () => {
    setError('')
    const cleanAsin = asin.trim().toUpperCase()
    if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) {
      setError('Enter a valid 10-character ASIN.')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/sentiment-alerts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ asin: cleanAsin, product_name: productName || null, marketplace, frequency }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'Failed to create alert'); return }
    setShowModal(false)
    resetForm()
    await load()
  }

  const togglePause = async (a: Alert) => {
    setBusy(a.id)
    await fetch('/api/sentiment-alerts', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id: a.id, active: !a.active }),
    })
    setBusy(null)
    await load()
  }

  const remove = async (a: Alert) => {
    if (!confirm(`Delete alert for ${a.product_name || a.asin}?`)) return
    setBusy(a.id)
    await fetch(`/api/sentiment-alerts?id=${encodeURIComponent(a.id)}`, {
      method:  'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    setBusy(null)
    await load()
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Sentiment alerts</h1>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sentiment alerts</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Get an email digest of new 1★ and 2★ reviews for your products, every 2 weeks or monthly.
          </p>
        </div>
        {isEligible && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Set up new alert
          </button>
        )}
      </div>

      {!isEligible ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-2">Growth & Pro feature</h2>
          <p className="text-sm text-neutral-500 mb-1">Get scheduled email digests when new 1★ or 2★ reviews appear.</p>
          <p className="text-xs text-neutral-400 mb-6">Catch sentiment dips early — react before they tank your conversion.</p>
          <a href="/#pricing" className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            Upgrade to unlock →
          </a>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <h2 className="text-base font-semibold mb-2">No alerts set up yet</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Choose a product and how often Voxrate should scan for new negative reviews.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-block px-6 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Set up your first alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.active ? 'bg-green-400 animate-pulse' : 'bg-neutral-300'}`} />
                    <p className="text-sm font-semibold truncate">{a.product_name || a.asin}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {a.active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    <span className="font-mono text-neutral-400">{a.asin}</span>
                    <span>·</span>
                    <span>{a.marketplace}</span>
                    <span>·</span>
                    <span>{FREQ_LABEL[a.frequency]}</span>
                    <span>·</span>
                    <span className="text-orange-600 font-semibold">1 analysis / {FREQ_PER_LABEL[a.frequency]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 mt-2">
                    <span>Last run: {fmtDate(a.last_run_at)}</span>
                    <span>·</span>
                    <span>Next run: {a.active ? fmtDate(a.next_run_at) : '— paused'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePause(a)}
                    disabled={busy === a.id}
                    className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    {busy === a.id ? '...' : a.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => remove(a)}
                    disabled={busy === a.id}
                    className="px-3 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEligible && (
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">How sentiment alerts work</p>
          <div className="space-y-2">
            {[
              'On your chosen schedule, Voxrate scans your ASIN for new 1★ and 2★ reviews',
              'You get an email digest with the rating, title and a snippet of each new negative review',
              '1 analysis is used each time the scan actually runs',
              'Pause anytime — paused alerts stop using analyses immediately',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-neutral-500">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Set up new alert modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Set up sentiment alert</h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-neutral-400 hover:text-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Product</label>
                {userReports.length > 0 && !manualAsin ? (
                  <>
                    <select
                      className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-white outline-none focus:border-orange-400"
                      value={asin}
                      onChange={e => {
                        const r = userReports.find(r => r.asin === e.target.value)
                        if (r) { setAsin(r.asin); setProductName(r.product_name || '') }
                        else { setAsin(''); setProductName('') }
                      }}
                    >
                      <option value="">— select a product —</option>
                      {userReports.map(r => (
                        <option key={r.asin} value={r.asin}>{r.product_name || r.asin} ({r.asin})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Don't see your product?{' '}
                      <button type="button" className="text-orange-500 underline" onClick={() => { setManualAsin(true); setAsin(''); setProductName('') }}>
                        Enter ASIN manually
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={asin}
                      onChange={e => setAsin(e.target.value)}
                      placeholder="B0XXXXXXXX"
                      maxLength={10}
                      className="w-full px-3 py-2 text-sm font-mono border border-neutral-200 rounded-xl focus:outline-none focus:border-black uppercase"
                    />
                    {userReports.length > 0 && (
                      <p className="text-[10px] text-neutral-400 mt-1">
                        <button type="button" className="text-orange-500 underline" onClick={() => { setManualAsin(false); setAsin(''); setProductName('') }}>
                          ← Back to product list
                        </button>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Marketplace</label>
                <select
                  value={marketplace}
                  onChange={e => setMarketplace(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-black bg-white"
                >
                  <option value="amazon.com">amazon.com (US)</option>
                  <option value="amazon.co.uk">amazon.co.uk (UK)</option>
                  <option value="amazon.ca">amazon.ca (CA)</option>
                  <option value="amazon.de">amazon.de (DE)</option>
                  <option value="amazon.fr">amazon.fr (FR)</option>
                  <option value="amazon.it">amazon.it (IT)</option>
                  <option value="amazon.es">amazon.es (ES)</option>
                  <option value="amazon.com.au">amazon.com.au (AU)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-2">Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['biweekly', 'monthly'] as Frequency[]).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`py-2.5 text-xs font-medium rounded-xl border transition-colors text-left px-3 ${
                        frequency === f ? 'border-black bg-black text-white' : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="block font-semibold">{FREQ_LABEL[f]}</span>
                      <span className="block text-[10px] opacity-70 mt-0.5">1 analysis / run</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 bg-neutral-50 rounded-lg p-3 leading-relaxed">
                1 analysis is used when the alert actually runs. You won't be charged on setup.
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting || !asin.trim()}
                className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create alert (1 analysis per run)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
