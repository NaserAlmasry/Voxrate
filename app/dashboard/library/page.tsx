'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100'    }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  }
}

function TrendBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <span className="text-[10px] text-neutral-400">First analysis</span>
  const diff = current - previous
  if (diff === 0) return <span className="text-[10px] text-neutral-400">No change</span>
  const up = diff > 0
  return (
    <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(diff)} pts
    </span>
  )
}

// Mini SVG sparkline for the last N health scores
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const W = 80, H = 32, pad = 4
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (W - pad * 2)
    const y = H - pad - ((s - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  const last = scores[scores.length - 1]
  const sc = scoreColor(last)
  const color = sc.text === 'text-green-500' ? '#22c55e' : sc.text === 'text-orange-500' ? '#f97316' : '#ef4444'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Last point dot */}
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" fill={color} />
    </svg>
  )
}

type Product = {
  listingKey: string
  productName: string
  productUrl: string
  latestReportId: string
  latestScore: number
  previousScore: number | null
  allScores: number[]
  lastAnalyzed: string
  reviewCount: number
  isCsv: boolean
  isCompetitor: boolean
  reportCount: number
}

export default function LibraryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [reanalyzing, setReanalyzing] = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: reports } = await supabase
        .from('reports')
        .select('id, product_name, product_url, health_score, total_reviews_analyzed, created_at, status, report_type')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (!reports) { setLoading(false); return }

      // Group by listing ID (or full URL for CSV)
      const map = new Map<string, typeof reports>()
      for (const r of reports) {
        const match = r.product_url?.match(/listing\/(\d+)/)
        const key = match ? match[1] : r.product_url
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(r)
      }

      const grouped: Product[] = []
      for (const [key, rows] of map.entries()) {
        // rows already sorted desc by created_at
        const latest   = rows[0]
        const previous = rows[1] ?? null
        const allScores = [...rows].reverse().map(r => r.health_score || 0)
        grouped.push({
          listingKey:     key,
          productName:    latest.product_name || 'Unnamed product',
          productUrl:     latest.product_url  || '',
          latestReportId: latest.id,
          latestScore:    latest.health_score || 0,
          previousScore:  previous ? (previous.health_score || 0) : null,
          allScores,
          lastAnalyzed:   latest.created_at,
          reviewCount:    latest.total_reviews_analyzed || 0,
          isCsv:          latest.report_type === 'csv' || (latest.product_url?.startsWith('csv:') ?? false),
          isCompetitor:   latest.report_type === 'competitor',
          reportCount:    rows.length,
        })
      }

      // Sort by last analyzed desc
      grouped.sort((a, b) => new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime())
      setProducts(grouped)
      setLoading(false)
    }
    load()
  }, [])

  const handleReanalyze = async (url: string, key: string) => {
    setReanalyzing(key)
    try {
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ productUrl: url, reAnalyze: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Analysis failed. Please try again.')
        setReanalyzing(null)
        return
      }
      router.push(`/dashboard/report/${data.reportId}`)
    } catch {
      alert('Something went wrong. Please try again.')
      setReanalyzing(null)
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold mb-6">Product library</h1>
      {[1,2,3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-4 bg-neutral-100 rounded w-48 mb-2" />
              <div className="h-3 bg-neutral-100 rounded w-32" />
            </div>
            <div className="h-12 w-16 bg-neutral-100 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )

  if (products.length === 0) return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Product library</h1>
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
        <svg className="mx-auto mb-3 text-neutral-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <p className="text-sm text-neutral-400 mb-1">No products yet</p>
        <p className="text-xs text-neutral-300 mb-4">Analyze your first listing to see it here</p>
        <a href="/dashboard" className="text-xs text-orange-600 font-medium hover:underline">Analyze a product →</a>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Product library</h1>
        <p className="text-xs text-neutral-400">{products.length} product{products.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {products.map(p => {
          const sc   = scoreColor(p.latestScore)
          const date = new Date(p.lastAnalyzed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          return (
            <div
              key={p.listingKey}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {p.isCsv && (
                      <span className="text-[10px] font-medium bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">CSV</span>
                    )}
                    {p.isCompetitor && (
                      <span className="text-[10px] font-medium bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Competitor</span>
                    )}
                    <h3
                      className="font-medium text-sm truncate cursor-pointer hover:text-orange-600 transition-colors"
                      onClick={() => router.push(`/dashboard/report/${p.latestReportId}`)}
                    >
                      {p.productName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                    <span>{date}</span>
                    {p.reviewCount > 0 && <><span>·</span><span>{p.reviewCount} reviews</span></>}
                    <span>·</span>
                    <span>{p.reportCount} analysis{p.reportCount !== 1 ? 'es' : ''}</span>
                  </div>

                  {/* Trend */}
                  <div className="flex items-center gap-3 mt-2">
                    <TrendBadge current={p.latestScore} previous={p.previousScore} />
                    {p.allScores.length >= 2 && <Sparkline scores={p.allScores} />}
                  </div>
                </div>

                {/* Score + actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className={`text-center px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                    <p className="text-[10px] text-neutral-400">Health</p>
                    <p className={`text-lg font-bold ${sc.text}`}>{p.latestScore}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => router.push(`/dashboard/report/${p.latestReportId}`)}
                      className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      View
                    </button>
                    {!p.isCsv && !p.isCompetitor && (
                      <button
                        onClick={() => handleReanalyze(p.productUrl, p.listingKey)}
                        disabled={reanalyzing === p.listingKey}
                        className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {reanalyzing === p.listingKey ? (
                          <>
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
                            </svg>
                            Analyzing...
                          </>
                        ) : 'Re-analyze'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
