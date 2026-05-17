'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100'    }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return               { text: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  }
}

function CompetitorPage() {
  const [url, setUrl]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [plan, setPlan]             = useState('free')
  const [pastReports, setPastReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const controllerRef               = useRef<AbortController | null>(null)
  const cancelledRef                = useRef(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: userData } = await supabase
        .from('users').select('plan').eq('id', user.id).single()
      setPlan(userData?.plan || 'free')

      const { data: reports } = await supabase
        .from('reports')
        .select('id, product_name, product_url, health_score, created_at, total_reviews_analyzed')
        .eq('user_id', user.id)
        .eq('report_type', 'competitor')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20)

      setPastReports(reports || [])
      setReportsLoading(false)

      const preUrl = searchParams.get('url')
      if (preUrl) setUrl(decodeURIComponent(preUrl))
    }
    init()
  }, [])

  const handleAnalyze = async () => {
    if (!url.trim()) return
    if (!url.includes('amazon.com') && !/^[A-Z0-9]{10}$/i.test(url.trim())) {
      setError('Please paste a valid Amazon URL or ASIN')
      return
    }
    cancelledRef.current = false
    setLoading(true)
    setError('')

    try {
      const controller = new AbortController()
      controllerRef.current = controller
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ productUrl: url, reportType: 'competitor' }),
        signal:  controller.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Analysis failed.')
        setLoading(false)
        return
      }
      router.push(`/dashboard/report/${data.reportId}`)
    } catch (err: any) {
      if (!cancelledRef.current && err?.name !== 'AbortError') {
        setError('Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }

  const isPaid = plan === 'starter' || plan === 'pro'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Competitor spy</h1>
        <p className="text-xs text-neutral-400 mt-1">Analyze any Amazon listing — uncover their weaknesses before buyers do</p>
      </div>

      {!isPaid ? (
        /* Upgrade gate */
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f05a1e" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-2">Starter & Pro feature</h2>
          <p className="text-sm text-neutral-500 mb-1">See exactly what your competitors' customers complain about.</p>
          <p className="text-xs text-neutral-400 mb-6">Identify gaps they haven't fixed — and make them your selling points.</p>
          <a
            href="/#pricing"
            className="inline-block px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Upgrade to unlock →
          </a>
        </div>
      ) : (
        <>
          {/* How it works */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: '1', label: 'Paste any Amazon listing URL or ASIN' },
              { n: '2', label: 'We analyze their reviews with AI' },
              { n: '3', label: 'See their weaknesses & your edge' },
            ].map(step => (
              <div key={step.n} className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                <div className="w-7 h-7 bg-black text-white rounded-full text-xs font-bold flex items-center justify-center mx-auto mb-2">{step.n}</div>
                <p className="text-xs text-neutral-500">{step.label}</p>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-600 block mb-2">Competitor Amazon listing URL or ASIN</label>
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
                placeholder="Paste competitor's Amazon URL or ASIN"
                className="w-full text-sm border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{error}</p>
                {error.includes('upgrade') || error.includes('Starter') ? (
                  <a href="/#pricing" className="text-xs text-orange-600 font-medium underline ml-auto flex-shrink-0">Upgrade →</a>
                ) : null}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
                  </svg>
                  Analyzing competitor... (2-4 min)
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  Spy on this listing
                </>
              )}
            </button>
            {loading && (
              <button
                onClick={() => { cancelledRef.current = true; controllerRef.current?.abort(); setLoading(false) }}
                className="w-full py-2 text-xs text-neutral-400 hover:text-red-500 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Past competitor reports */}
          {!reportsLoading && pastReports.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Previous competitor analyses</p>
              <div className="space-y-2">
                {pastReports.map(r => {
                  const sc   = scoreColor(r.health_score || 0)
                  const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-neutral-200 p-4 hover:border-neutral-300 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/dashboard/report/${r.id}`)}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Competitor</span>
                          <p className="text-sm font-medium truncate">{r.product_name || 'Unnamed product'}</p>
                        </div>
                        <p className="text-xs text-neutral-400">{date} · {r.total_reviews_analyzed} reviews</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`text-center px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                          <p className="text-[10px] text-neutral-400">Health</p>
                          <p className={`text-base font-bold ${sc.text}`}>{r.health_score || '—'}</p>
                        </div>
                        <button
                          onClick={() => router.push(`/dashboard/compare?competitor=${r.id}`)}
                          className="px-3 py-1.5 text-xs font-medium border border-purple-200 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          Compare →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CompetitorPageWrapper() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    }>
      <CompetitorPage />
    </Suspense>
  )
}
