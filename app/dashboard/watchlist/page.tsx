'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/Toast'
import EmptyState from '@/app/components/EmptyState'
import { WatchlistCardSkeleton } from '@/app/components/Skeleton'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100'    }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  }
}

function DeltaBadge({ initial, current }: { initial: number | null; current: number }) {
  if (initial === null || initial === undefined) return null
  const delta = current - initial
  if (delta === 0) return <span className="text-[10px] text-neutral-400 font-medium">No change</span>
  // For competitors: score going UP is bad for seller (they're getting better), score DOWN is good (opportunity)
  const isGood = delta < 0
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  )
}

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <span className="text-[10px] text-neutral-300">—</span>
  const w = 72, h = 22, pad = 2
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = h - pad - ((s - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = scores[scores.length - 1]
  const first = scores[0]
  const color = last < first ? '#22c55e' : last > first ? '#ef4444' : '#a3a3a3'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').at(-1)?.split(',')[0]} cy={pts.split(' ').at(-1)?.split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}

export default function WatchlistPage() {
  const toast = useToast()
  const [items, setItems]                 = useState<any[]>([])
  const [competitors, setCompetitors]     = useState<any[]>([])
  const [plan, setPlan]                   = useState('free')
  const [loading, setLoading]             = useState(true)
  const [removing, setRemoving]           = useState<string | null>(null)
  const [showPicker, setShowPicker]       = useState(false)
  const [selected, setSelected]           = useState<any | null>(null)
  const [note, setNote]                   = useState('')
  const [adding, setAdding]               = useState(false)
  const [error, setError]                 = useState('')
  const [editingNote, setEditingNote]     = useState<string | null>(null)
  const [editNoteVal, setEditNoteVal]     = useState('')
  const [savingNote, setSavingNote]       = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: userData }, watchRes, compRes] = await Promise.all([
      supabase.from('users').select('plan').eq('id', user.id).single(),
      fetch('/api/watchlist', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()),
      supabase
        .from('reports')
        .select('id, product_name, product_url, health_score, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('report_type', 'competitor')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setPlan(userData?.plan || 'free')
    setItems(watchRes.items || [])
    setCompetitors(compRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addToWatchlist = async () => {
    if (!selected) return
    setAdding(true)
    setError('')
    const res  = await fetch('/api/watchlist', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ reportId: selected.id, note }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setAdding(false); toast(data.error || 'Failed to add', 'error'); return }
    setShowPicker(false)
    setSelected(null)
    setNote('')
    setAdding(false)
    toast('Added to watchlist!')
    await load()
  }

  const remove = async (id: string) => {
    setRemoving(id)
    await fetch('/api/watchlist', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id }),
    })
    setRemoving(null)
    toast('Removed from watchlist', 'info')
    await load()
  }

  const saveNote = async (id: string) => {
    setSavingNote(true)
    await fetch('/api/watchlist', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({ id, note: editNoteVal }),
    })
    setSavingNote(false)
    setEditingNote(null)
    await load()
  }

  const isPaid = plan === 'starter' || plan === 'growth' || plan === 'pro'

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold mb-6">Competitor watchlist</h1>
      {[1, 2, 3].map(i => <WatchlistCardSkeleton key={i} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Competitor watchlist</h1>
          <p className="text-xs text-neutral-400 mt-1">Voxrate tracks competitor scores over time and emails you when they drop — so you can move fast when they slip up</p>
        </div>
        {isPaid && (
          <button
            onClick={() => setShowPicker(true)}
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add competitor
          </button>
        )}
      </div>

      {!isPaid ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-2">Starter, Growth & Pro feature</h2>
          <p className="text-sm text-neutral-500 mb-1">Track competitors and get alerted when their scores drop — that's your opportunity.</p>
          <p className="text-xs text-neutral-400 mb-6">Know before anyone else when a competitor loses trust with buyers.</p>
          <a href="/#pricing" className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            Upgrade to unlock →
          </a>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
          title="No competitors tracked yet"
          description="Add competitor listings here and Voxrate will track their score over time — so you know the moment they improve or slip."
          action={{ label: 'Analyze a competitor', onClick: () => router.push('/dashboard/competitor') }}
          secondaryAction={competitors.length > 0 ? { label: 'Add existing', onClick: () => setShowPicker(true) } : undefined}
          tip="Track up to 5 competitors on the Pro plan to stay ahead of the market."
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const sc   = scoreColor(item.last_score || 0)
            const date = item.last_checked_at
              ? new Date(item.last_checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Never'
            const isEditingThisNote = editingNote === item.id
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold truncate">{item.product_name || 'Unnamed competitor'}</p>
                      <DeltaBadge initial={item.initial_score ?? null} current={item.last_score || 0} />
                    </div>
                    {item.top_complaint && (
                      <p className="text-xs text-orange-500 mb-1.5">Top complaint: {item.top_complaint}</p>
                    )}
                    {/* Note display / edit */}
                    {isEditingThisNote ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          value={editNoteVal}
                          onChange={e => setEditNoteVal(e.target.value)}
                          maxLength={300}
                          className="flex-1 text-xs border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:border-black"
                          onKeyDown={e => { if (e.key === 'Enter') saveNote(item.id); if (e.key === 'Escape') setEditingNote(null) }}
                          autoFocus
                        />
                        <button onClick={() => saveNote(item.id)} disabled={savingNote}
                          className="text-xs font-medium text-white bg-black rounded-lg px-2 py-1 disabled:opacity-50">
                          {savingNote ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingNote(null)} className="text-xs text-neutral-400 hover:text-black">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.note
                          ? <p className="text-xs text-neutral-400 italic">"{item.note}"</p>
                          : <p className="text-xs text-neutral-300">No note</p>
                        }
                        <button
                          onClick={() => { setEditingNote(item.id); setEditNoteVal(item.note || '') }}
                          className="text-neutral-300 hover:text-neutral-600 transition-colors"
                          title="Edit note"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-neutral-400 mt-1.5">Last checked {date}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`text-center px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                        <p className="text-[10px] text-neutral-400">Score</p>
                        <p className={`text-base font-bold ${sc.text}`}>{item.last_score ?? '—'}</p>
                      </div>
                    </div>
                    {/* Sparkline */}
                    {item.history && item.history.length >= 2 && (
                      <div className="flex flex-col items-end">
                        <Sparkline scores={item.history} />
                        <p className="text-[9px] text-neutral-300 mt-0.5">{item.history.length} data points</p>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => router.push(`/dashboard/report/${item.report_id}`)}
                        className="px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/competitor?url=${encodeURIComponent(item.product_url)}`)}
                        className="px-2.5 py-1.5 text-xs border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Re-analyze this competitor to get fresh data"
                      >
                        Re-check
                      </button>
                      <button
                        onClick={() => remove(item.id)}
                        disabled={removing === item.id}
                        className="px-2.5 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {removing === item.id ? '…' : 'Remove'}
                      </button>
                    </div>
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
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">How competitor tracking works</p>
          <div className="space-y-2">
            {[
              "We re-check competitor listings weekly to detect score changes",
              "Score drops 5+ points on their side = your opportunity to step in",
              "Score increases on their side = they're raising the bar, watch closely",
              "Use 'Re-check' to manually get fresh data at any time (uses 1 analysis)",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-neutral-500">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add picker modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Track a competitor</h3>
              <button onClick={() => setShowPicker(false)} className="text-neutral-400 hover:text-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {competitors.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-neutral-500 mb-3">No competitor analyses yet</p>
                <button
                  onClick={() => { setShowPicker(false); router.push('/dashboard/competitor') }}
                  className="text-xs text-orange-600 font-medium hover:underline"
                >
                  Analyze a competitor first →
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
                  {competitors.map(r => {
                    const sc  = r.health_score <= 37 ? 'text-red-500' : r.health_score <= 65 ? 'text-orange-500' : 'text-green-500'
                    const sel = selected?.id === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`w-full flex items-center justify-between gap-3 p-3 border rounded-xl transition-colors text-left ${sel ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.product_name || 'Unnamed'}</p>
                          <p className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${sc}`}>{r.health_score}</span>
                        {sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    )
                  })}
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Note <span className="font-normal text-neutral-400">(optional)</span></label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Main competitor in jewelry niche"
                    maxLength={300}
                    className="w-full text-sm border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-black"
                  />
                </div>

                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                <button
                  onClick={addToWatchlist}
                  disabled={adding || !selected}
                  className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Start tracking'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
