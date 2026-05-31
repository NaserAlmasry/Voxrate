'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GeoPage {
  id: string
  slug: string
  product_title: string
  health_score: number
  published: boolean
  published_at: string
  last_snapshot_at: string
  view_count: number
  asin: string | null
  report_id: string
}

interface StatusData {
  viewCount: number
  sourceCounts: Record<string, number>
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}/100</span>
}

function SourceBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const colors: Record<string, string> = {
    perplexity: 'bg-teal-500',
    google: 'bg-blue-500',
    reddit: 'bg-orange-500',
    linkedin: 'bg-blue-700',
    direct: 'bg-neutral-400',
    other: 'bg-neutral-300',
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-xs text-neutral-500 capitalize">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colors[label] || 'bg-neutral-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-400 w-6 text-right">{count}</span>
    </div>
  )
}

export default function GeoDashboardPage() {
  const [pages, setPages]   = useState<GeoPage[]>([])
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<Record<string, StatusData>>({})

  useEffect(() => {
    fetch('/api/geo/pages', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setPages(d.pages || [])
        setLoading(false)
        // Fetch status for each page
        for (const p of d.pages || []) {
          fetch(`/api/geo/status/${p.report_id}`, { credentials: 'include' })
            .then(r => r.json())
            .then(s => setStatuses(prev => ({ ...prev, [p.id]: s })))
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Published GEO Pages</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Pages visible to AI models and search engines. Each page boosts your product&apos;s AI citation probability.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Dashboard
        </Link>
      </div>

      {pages.length === 0 ? (
        <div className="text-center py-16 border border-neutral-200 rounded-2xl">
          <p className="text-4xl mb-4">🌐</p>
          <p className="font-semibold text-neutral-800 mb-1">No published pages yet</p>
          <p className="text-sm text-neutral-500 mb-6">Go to any completed report and click &quot;Publish GEO Page&quot; to get started.</p>
          <Link href="/dashboard" className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors">
            Go to reports →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map(page => {
            const status     = statuses[page.id]
            const totalViews = status?.viewCount ?? page.view_count
            const sources    = status?.sourceCounts ?? {}
            const topSources = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 4)
            const pageUrl    = `https://voxrate.app/product/${page.slug}`

            return (
              <div key={page.id} className="border border-neutral-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-neutral-900 truncate">{page.product_title}</h2>
                      <HealthBadge score={page.health_score} />
                      {page.published
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Live</span>
                        : <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">Unpublished</span>
                      }
                    </div>
                    {page.asin && <p className="text-xs text-neutral-400 mt-0.5">ASIN: {page.asin}</p>}
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Last updated {new Date(page.last_snapshot_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-neutral-900">{totalViews.toLocaleString()}</p>
                    <p className="text-xs text-neutral-400">views</p>
                  </div>
                </div>

                {/* Source breakdown */}
                {topSources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Traffic sources (30 days)</p>
                    {topSources.map(([src, count]) => (
                      <SourceBar key={src} label={src} count={count} total={totalViews} />
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-sm border border-neutral-200 py-2 rounded-xl hover:bg-neutral-50 transition-colors"
                  >
                    View page →
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(pageUrl)}
                    className="px-4 py-2 text-sm border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                  >
                    Copy link
                  </button>
                  <Link
                    href={`/dashboard/report/${page.report_id}`}
                    className="px-4 py-2 text-sm border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
