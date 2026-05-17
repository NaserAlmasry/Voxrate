'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100',    hex: '#ef4444' }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', hex: '#f05a1e' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100',  hex: '#22c55e' }
}

function severityConfig(s: string) {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return { label: 'Critical', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200'    }
    case 'MEDIUM':   return { label: 'Medium',   bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    default:         return { label: 'Low',       bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200' }
  }
}

function safeArray(v: any): any[]         { return Array.isArray(v) ? v : [] }
function safeStr(v: any, fb = '—'): string { return typeof v === 'string' && v.trim() ? v : fb }

export default function PublicReportPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const params = useParams()
  const reportId = params?.id as string

  useEffect(() => {
    if (!reportId) return
    fetch(`/api/report/${reportId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setReport(data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }, [reportId])

  if (loading) return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin w-10 h-10 text-orange-500 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p className="text-sm text-neutral-500">Loading report...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium mb-4">{error === 'Unauthorized' ? 'This report is private or no longer shared.' : error}</p>
        <a href="/" className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-neutral-800 transition-colors">
          Go to Voxrate →
        </a>
      </div>
    </div>
  )

  if (!report) return null

  const fr  = report.full_report || {}
  const sc  = scoreColor(report.health_score || 0)
  const complaints = safeArray(fr.complaints)
  const strengths  = safeArray(fr.strengths)

  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Top bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Voxrate" height={24} style={{ objectFit: 'contain', maxWidth: 120 }} />
        </a>
        <a
          href="/"
          className="px-4 py-1.5 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Analyze your product →
        </a>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Shared badge */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <p className="text-xs text-blue-700 font-medium">Shared report — view only</p>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">{safeStr(report.product_name, 'Amazon Product')}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {report.total_reviews_analyzed} reviews analyzed · {new Date(report.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className={`text-center px-4 py-2 rounded-xl border ${sc.bg} ${sc.border} flex-shrink-0`}>
            <p className="text-xs text-neutral-400">Health</p>
            <p className={`text-2xl font-bold ${sc.text}`}>
              {report.health_score}<span className="text-sm text-neutral-400">/100</span>
            </p>
          </div>
        </div>

        {/* Summary */}
        {fr.summary && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Summary</p>
            <p className="text-sm text-neutral-700 leading-relaxed">{fr.summary}</p>
          </div>
        )}

        {/* Complaints */}
        {complaints.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">
              Top complaints ({complaints.length} shown)
            </p>
            <div className="space-y-3">
              {complaints.map((c: any, i: number) => {
                const sev = severityConfig(c.severity)
                return (
                  <div key={i} className={`p-4 rounded-xl border ${sev.border}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>{sev.label}</span>
                      <span className="text-xs text-neutral-400">{c.frequency}</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                    {c.description && <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{c.description}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">
              Strengths ({strengths.length} shown)
            </p>
            <div className="space-y-3">
              {strengths.map((s: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border border-green-200 bg-green-50">
                  <p className="text-sm font-semibold text-neutral-800">{s.title}</p>
                  {s.marketingAngle && (
                    <p className="text-xs text-green-700 mt-1">Use in listing: "{s.marketingAngle}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {fr._isLimited && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
            <p className="text-sm font-bold text-neutral-800 mb-1">Want the full report for your products?</p>
            <p className="text-xs text-neutral-500 mb-4">All complaints, fixes, SEO keywords, marketing copy and more.</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Try Voxrate free →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
