'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-50 text-green-600 border-green-200',
    B: 'bg-green-50 text-green-500 border-green-100',
    C: 'bg-orange-50 text-orange-500 border-orange-200',
    D: 'bg-red-50 text-red-500 border-red-200',
    F: 'bg-red-100 text-red-600 border-red-300',
  }
  return (
    <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl font-black ${colors[grade] || 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
      {grade}
    </div>
  )
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct   = Math.round((score / max) * 100)
  const color = score >= 66 ? 'bg-green-400' : score >= 38 ? 'bg-orange-400' : 'bg-red-400'
  return (
    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ShopHealthPage() {
  const [data, setData]     = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/shop-health', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(r => r.json())
      .then(d => {
        if (d.error && !d.empty) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold mb-6">Shop health</h1>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse h-24" />
      ))}
    </div>
  )

  if (data?.empty) return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Shop health</h1>
      <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
        <svg className="mx-auto mb-3 text-neutral-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <p className="text-sm text-neutral-500 mb-4">No analyzed listings yet — analyze your first product to see your shop health score</p>
        <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors">
          Analyze a listing →
        </button>
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-red-500">{error}</p>
    </div>
  )

  const scoreColor = data.shopScore >= 66 ? 'text-green-500' : data.shopScore >= 38 ? 'text-orange-500' : 'text-red-500'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shop health</h1>
        <p className="text-xs text-neutral-400 mt-1">Overall performance across all {data.totalListings} analyzed listing{data.totalListings !== 1 ? 's' : ''}</p>
      </div>

      {/* Overall score card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-6">
          <GradeBadge grade={data.grade} />
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-5xl font-black ${scoreColor}`}>{data.shopScore}</span>
              <span className="text-sm text-neutral-400">/100</span>
            </div>
            <p className="text-xs text-neutral-500">Overall shop health score</p>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>
                <span className="text-neutral-600">{data.healthyCount} healthy</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>
                <span className="text-neutral-600">{data.warningCount} warning</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>
                <span className="text-neutral-600">{data.criticalCount} critical</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top priorities */}
      {data.priorities?.length > 0 && (
        <div className="bg-black rounded-2xl p-5">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Top priorities</p>
          <div className="space-y-2.5">
            {data.priorities.map((p: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-white leading-snug">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Needs attention */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Needs attention</p>
          <div className="space-y-3">
            {data.weakest.map((r: any) => (
              <button
                key={r.id}
                onClick={() => router.push(`/dashboard/report/${r.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium truncate flex-1">{r.product_name || 'Unnamed'}</p>
                  <span className={`text-xs font-bold flex-shrink-0 ${(r.health_score || 0) < 38 ? 'text-red-500' : 'text-orange-500'}`}>{r.health_score}</span>
                </div>
                <ScoreBar score={r.health_score || 0} />
              </button>
            ))}
          </div>
        </div>

        {/* Top performers */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Top performers</p>
          <div className="space-y-3">
            {data.strongest.map((r: any) => (
              <button
                key={r.id}
                onClick={() => router.push(`/dashboard/report/${r.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium truncate flex-1">{r.product_name || 'Unnamed'}</p>
                  <span className="text-xs font-bold flex-shrink-0 text-green-500">{r.health_score}</span>
                </div>
                <ScoreBar score={r.health_score || 0} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recurring complaints */}
      {data.topComplaints?.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Recurring complaints across your shop</p>
          <div className="space-y-2.5">
            {data.topComplaints.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-neutral-700">{c.title}</p>
                </div>
                <span className="text-xs text-red-400 font-semibold flex-shrink-0">
                  {c.count} listing{c.count > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring strengths */}
      {data.topStrengths?.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">What your shop does well</p>
          <div className="space-y-2.5">
            {data.topStrengths.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" className="flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-sm text-neutral-700 flex-1">{s.title}</p>
                <span className="text-xs text-green-500 font-semibold flex-shrink-0">{s.count} listing{s.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All listings */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">All listings</p>
        <div className="space-y-3">
          {data.allListings.map((r: any) => (
            <button
              key={r.id}
              onClick={() => router.push(`/dashboard/report/${r.id}`)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-medium truncate flex-1">{r.product_name || 'Unnamed'}</p>
                <span className={`text-xs font-bold flex-shrink-0 ${(r.health_score || 0) >= 66 ? 'text-green-500' : (r.health_score || 0) >= 38 ? 'text-orange-500' : 'text-red-500'}`}>
                  {r.health_score}
                </span>
              </div>
              <ScoreBar score={r.health_score || 0} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
