'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'
import EmptyState from '@/app/components/EmptyState'
import { MonitorCardSkeleton } from '@/app/components/Skeleton'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100'    }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  }
}

export default function MonitorPage() {
  const [monitored, setMonitored]       = useState<any[]>([])
  const [ownReports, setOwnReports]     = useState<any[]>([])
  const [plan, setPlan]                 = useState('free')
  const [loading, setLoading]           = useState(true)
  const [adding, setAdding]             = useState(false)
  const [removing, setRemoving]         = useState<string | null>(null)
  const [showPicker, setShowPicker]     = useState(false)
  const [pickerFreq, setPickerFreq]     = useState<'daily' | 'weekly'>('weekly')
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [error, setError]               = useState('')
  const router  = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: userData }, monRes, reportsRes] = await Promise.all([
      supabase.from('users').select('plan').eq('id', user.id).single(),
      fetch('/api/monitor', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()),
      supabase
        .from('reports')
        .select('id, product_name, product_url, health_score, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .or('report_type.eq.own,report_type.is.null')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setPlan(userData?.plan || 'free')
    setMonitored(monRes.listings || [])
    setOwnReports(reportsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addMonitor = async () => {
    if (!selectedReport) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/monitor', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ reportId: selectedReport.id, checkFrequency: pickerFreq }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to add monitor'); setAdding(false); return }
    setShowPicker(false)
    setSelectedReport(null)
    setAdding(false)
    await load()
  }

  const removeMonitor = async (id: string) => {
    setRemoving(id)
    await fetch('/api/monitor', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id }),
    })
    setRemoving(null)
    await load()
  }

  const isPaid = plan === 'starter' || plan === 'growth' || plan === 'pro'

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold mb-6">Review monitoring</h1>
      {[1, 2, 3].map(i => <MonitorCardSkeleton key={i} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Review monitoring</h1>
          <p className="text-xs text-neutral-400 mt-1">Voxrate re-analyzes your listings automatically and emails you if the score drops or new complaints appear</p>
        </div>
        {isPaid && (
          <button
            onClick={() => setShowPicker(true)}
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add listing
          </button>
        )}
      </div>

      {!isPaid ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-2">Starter, Growth & Pro feature</h2>
          <p className="text-sm text-neutral-500 mb-1">Get automatic email alerts when your product health drops.</p>
          <p className="text-xs text-neutral-400 mb-6">Never miss a new complaint pattern — catch problems before they cost you sales.</p>
          <a href="/#pricing" className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            Upgrade to unlock →
          </a>
        </div>
      ) : monitored.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
          title="No listings monitored yet"
          description="Add your listings here and get alerted the moment your score drops — before it costs you sales."
          action={{ label: 'Add your first listing', onClick: () => setShowPicker(true) }}
          tip="When Voxrate detects a score drop of 5+ points or new complaints, it sends you an email alert with a breakdown of what changed."
        />
      ) : (
        <div className="space-y-3">
          {monitored.map(m => {
            const sc   = scoreColor(m.last_score || 0)
            const date = m.last_checked_at
              ? new Date(m.last_checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Never'
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                      <p className="text-sm font-semibold truncate">{m.product_name || 'Unnamed product'}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span>Checked {date}</span>
                      <span>·</span>
                      <span className="capitalize">{m.check_frequency}</span>
                      <span>·</span>
                      <span className="text-green-600">Email alert on change</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`text-center px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                      <p className="text-[10px] text-neutral-400">Score</p>
                      <p className={`text-base font-bold ${sc.text}`}>{m.last_score ?? '—'}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/report/${m.report_id}`)}
                      className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => removeMonitor(m.id)}
                      disabled={removing === m.id}
                      className="px-3 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {removing === m.id ? '...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* How it works */}
      {isPaid && (
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">How monitoring works</p>
          <div className="space-y-2">
            {[
              'We re-analyze your listing daily or weekly automatically',
              'If health score drops 5+ points, you get an email immediately',
              'If new customer complaints appear, you get an email with details',
              'Click the email link to see what changed and how to fix it',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-neutral-500">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add listing picker modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Monitor a listing</h3>
              <button onClick={() => setShowPicker(false)} className="text-neutral-400 hover:text-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Frequency */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-neutral-600 mb-2">Check frequency</p>
              <div className="grid grid-cols-2 gap-2">
                {(['weekly', 'daily'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPickerFreq(f)}
                    className={`py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                      pickerFreq === f ? 'border-black bg-black text-white' : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    {f === 'weekly' ? 'Weekly' : 'Daily'}
                    <span className="block text-[10px] font-normal opacity-60">{f === 'weekly' ? 'Recommended' : 'Pro plan'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Product picker */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-neutral-600 mb-2">Select product</p>
              {ownReports.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No analyzed products yet — run an analysis first.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {ownReports.map(r => {
                    const sc  = r.health_score <= 37 ? 'text-red-500' : r.health_score <= 65 ? 'text-orange-500' : 'text-green-500'
                    const sel = selectedReport?.id === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedReport(r)}
                        className={`w-full flex items-center justify-between gap-3 p-3 border rounded-xl transition-colors text-left ${
                          sel ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.product_name || 'Unnamed'}</p>
                          <p className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-base font-bold flex-shrink-0 ${sc}`}>{r.health_score}</span>
                        {sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <button
              onClick={addMonitor}
              disabled={adding || !selectedReport}
              className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Start monitoring'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
