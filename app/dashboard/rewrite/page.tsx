'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RewritePage() {
  const [reports, setReports]         = useState<any[]>([])
  const [selectedReport, setSelected] = useState<any | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading]         = useState(true)
  const [rewriting, setRewriting]     = useState(false)
  const [result, setResult]           = useState<any | null>(null)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('reports')
        .select('id, product_name, product_url, health_score, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .or('report_type.eq.own,report_type.is.null')
        .order('created_at', { ascending: false })
        .limit(30)

      setReports(data || [])
      setLoading(false)
    })()
  }, [])

  const rewrite = async () => {
    if (!description.trim()) return
    setRewriting(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/rewrite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body:    JSON.stringify({
        description,
        reportId:    selectedReport?.id   || null,
        productName: selectedReport?.product_name || '',
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to rewrite'); setRewriting(false); return }
    setResult(data)
    setRewriting(false)
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold mb-6">Description rewriter</h1>
      {[1, 2].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse h-20" />
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Description rewriter</h1>
        <p className="text-xs text-neutral-400 mt-1">Paste your current Etsy listing description and get an SEO-optimized rewrite in seconds</p>
      </div>

      {/* Optional: link to a report */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-600 mb-2">
          Link to a report <span className="font-normal text-neutral-400">(optional — uses your SEO keywords & review insights)</span>
        </p>
        {reports.length === 0 ? (
          <p className="text-xs text-neutral-400">No analyzed products yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {reports.map(r => {
              const sc  = r.health_score <= 37 ? 'text-red-500' : r.health_score <= 65 ? 'text-orange-500' : 'text-green-500'
              const sel = selectedReport?.id === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(sel ? null : r)}
                  className={`w-full flex items-center justify-between gap-3 p-3 border rounded-xl transition-colors text-left ${
                    sel ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.product_name || 'Unnamed'}</p>
                    <p className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${sc}`}>{r.health_score}</span>
                  {sel && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black flex-shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {selectedReport && (
          <p className="text-xs text-green-600 mt-2 font-medium">
            Using SEO keywords and insights from: {selectedReport.product_name}
          </p>
        )}
      </div>

      {/* Description input */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Current description</p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Paste your current Etsy listing description here..."
          rows={8}
          maxLength={3000}
          className="w-full text-sm border border-neutral-200 rounded-xl p-3 resize-none focus:outline-none focus:border-black transition-colors"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-neutral-400">{description.length}/3000</p>
          <button
            onClick={rewrite}
            disabled={rewriting || !description.trim()}
            className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {rewriting ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
                </svg>
                Rewriting…
              </>
            ) : 'Rewrite →'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-600">Rewritten description</p>
              <button
                onClick={() => copy(result.rewritten)}
                className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{result.rewritten}</p>
          </div>

          {result.changes?.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-xs font-semibold text-neutral-600 mb-3">What changed</p>
              <ul className="space-y-2">
                {result.changes.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-green-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                    <p className="text-xs text-neutral-600">{c}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.keywordsUsed?.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <p className="text-xs font-semibold text-neutral-600 mb-3">SEO keywords woven in</p>
              <div className="flex flex-wrap gap-2">
                {result.keywordsUsed.map((kw: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-orange-50 border border-orange-100 text-orange-700 text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={rewrite}
            disabled={rewriting}
            className="w-full py-3 border border-neutral-200 text-sm text-neutral-600 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Regenerate →
          </button>
        </div>
      )}
    </div>
  )
}
