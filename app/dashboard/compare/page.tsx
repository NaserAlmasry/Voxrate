'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/app/lib/supabase/client'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    hex: '#ef4444', bg: 'bg-red-50',    border: 'border-red-200'    }
  if (n <= 65) return { text: 'text-orange-500', hex: '#f97316', bg: 'bg-orange-50', border: 'border-orange-200' }
  return               { text: 'text-green-500',  hex: '#22c55e', bg: 'bg-green-50',  border: 'border-green-200'  }
}

function safeArray(v: any): any[] { return Array.isArray(v) ? v : [] }

// Fuzzy complaint matching — keyword overlap
const STOP = new Set(['the','and','but','for','not','are','was','with','this','from','they','that','have','been','will','just','also','into','over','your','their','were','about','item','very','some','when','does'])

function keywords(s: string): string[] {
  return (s || '').toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w))
}
function titlesOverlap(a: string, b: string): boolean {
  const ka = new Set(keywords(a))
  if (ka.size === 0) return false
  return keywords(b).some(w => ka.has(w))
}
function isMatchedBy(title: string, otherTitles: string[]): boolean {
  const tl = (title || '').toLowerCase()
  return otherTitles.some(o => o === tl || titlesOverlap(title, o))
}

function WinnerBadge({ side }: { side: 'left' | 'right' | 'tie' }) {
  if (side === 'left')  return <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">You win</span>
  if (side === 'right') return <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">They win</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">Tied</span>
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
    </div>
  )
}

function CompareRow({ label, ownVal, compVal, higher = 'own' }: {
  label: string; ownVal: number | string; compVal: number | string; higher?: 'own' | 'comp' | 'lower'
}) {
  const ownN  = typeof ownVal  === 'number' ? ownVal  : parseFloat(String(ownVal))
  const compN = typeof compVal === 'number' ? compVal : parseFloat(String(compVal))
  const bothValid = !isNaN(ownN) && !isNaN(compN)
  let winner: 'left' | 'right' | 'tie' = 'tie'
  if (bothValid && ownN !== compN) {
    const ownWins = higher === 'lower' ? ownN < compN : ownN > compN
    winner = ownWins ? 'left' : 'right'
  }
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 border-b border-neutral-100 last:border-0">
      <div className="text-right">
        <span className={`text-sm font-bold ${winner === 'left' ? 'text-green-600' : 'text-neutral-700'}`}>{ownVal}</span>
      </div>
      <div className="text-center min-w-[90px]">
        <p className="text-[10px] text-neutral-400 mb-1">{label}</p>
        <WinnerBadge side={winner} />
      </div>
      <div className="text-left">
        <span className={`text-sm font-bold ${winner === 'right' ? 'text-red-500' : 'text-neutral-700'}`}>{compVal}</span>
      </div>
    </div>
  )
}

// ── Own-report picker (shown when ?own param is missing) ──────────────────────
function OwnReportPicker({ competitorId }: { competitorId: string }) {
  const router   = useRouter()
  const supabase = createClient()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('reports')
        .select('id, product_name, health_score, created_at, total_reviews_analyzed')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .neq('report_type', 'competitor')
        .order('created_at', { ascending: false })
        .limit(20)
      setReports(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-black flex items-center gap-1">← Back</button>
      <div>
        <h1 className="text-xl font-semibold">Select your product to compare</h1>
        <p className="text-xs text-neutral-400 mt-1">Pick which of your products to stack against this competitor</p>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-neutral-100 rounded-2xl animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center">
          <p className="text-sm text-neutral-500 mb-3">No product analyses yet</p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-orange-600 font-medium hover:underline">
            Analyze your product first →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => {
            const sc = scoreColor(r.health_score || 0)
            const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <button
                key={r.id}
                onClick={() => router.push(`/dashboard/compare?own=${r.id}&competitor=${competitorId}`)}
                className="w-full flex items-center justify-between gap-4 bg-white rounded-2xl border-2 border-neutral-200 hover:border-black p-4 text-left transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-black">{r.product_name || 'Unnamed product'}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{date} · {r.total_reviews_analyzed ?? 0} reviews analyzed</p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl border text-center ${sc.bg} ${sc.border} flex-shrink-0`}>
                  <p className="text-[10px] text-neutral-400">Health</p>
                  <p className={`text-base font-bold ${sc.text}`}>{r.health_score ?? '—'}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main compare view ─────────────────────────────────────────────────────────
function ComparePage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const ownId        = searchParams.get('own')
  const competitorId = searchParams.get('competitor')

  const [ownReport,  setOwnReport]  = useState<any>(null)
  const [compReport, setCompReport] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!ownId || !competitorId) { setLoading(false); return }

    Promise.all([
      fetch(`/api/report/${ownId}`,        { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()),
      fetch(`/api/report/${competitorId}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(r => r.json()),
    ]).then(([own, comp]) => {
      if (own.error || comp.error) { setError(own.error || comp.error); setLoading(false); return }
      setOwnReport(own)
      setCompReport(comp)
      setLoading(false)
    }).catch(() => { setError('Failed to load reports'); setLoading(false) })
  }, [ownId, competitorId])

  // Missing own param — show picker
  if (!loading && !ownId && competitorId) {
    return <OwnReportPicker competitorId={competitorId} />
  }

  if (!competitorId) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <p className="text-sm text-neutral-500 mb-4">No competitor selected.</p>
      <button onClick={() => router.push('/dashboard/competitor')} className="px-4 py-2 bg-black text-white text-sm rounded-xl">
        Go to Competitor Spy →
      </button>
    </div>
  )

  if (loading) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <svg className="animate-spin w-10 h-10 text-orange-500 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <p className="text-sm text-neutral-500">Building your comparison...</p>
    </div>
  )

  if (error || !ownReport || !compReport) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <p className="text-red-500 mb-4">{error || 'Reports not found'}</p>
      <button onClick={() => router.back()} className="px-4 py-2 bg-black text-white text-sm rounded-xl">Go back</button>
    </div>
  )

  const own  = { report: ownReport,  fr: ownReport.full_report  || {} }
  const comp = { report: compReport, fr: compReport.full_report || {} }

  const ownScore  = ownReport.health_score  || 0
  const compScore = compReport.health_score || 0
  const ownSc     = scoreColor(ownScore)
  const compSc    = scoreColor(compScore)

  const ownTitles  = safeArray(own.fr.complaints).map((c: any) => (c.title || '').toLowerCase())
  const compTitles = safeArray(comp.fr.complaints).map((c: any) => (c.title || '').toLowerCase())

  const theirWeaknesses = safeArray(comp.fr.complaints).filter((c: any) => !isMatchedBy(c.title || '', ownTitles))
  const yourWeaknesses  = safeArray(own.fr.complaints).filter((c: any)  => !isMatchedBy(c.title || '', compTitles))
  const sharedIssues    = safeArray(own.fr.complaints).filter((c: any)  =>  isMatchedBy(c.title || '', compTitles))

  const overallWinner = ownScore > compScore ? 'you' : compScore > ownScore ? 'them' : 'tied'
  const scoreDiff     = Math.abs(ownScore - compScore)

  const ownDate  = ownReport.created_at  ? new Date(ownReport.created_at).toLocaleDateString('en-US',  { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const compDate = compReport.created_at ? new Date(compReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  const ownReviewsOk  = (ownReport.total_reviews_analyzed  || 0) > 0
  const compReviewsOk = (compReport.total_reviews_analyzed || 0) > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-black flex items-center gap-1">← Back</button>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Comparison report</h1>
        <p className="text-xs text-neutral-400 mt-1">Your product vs competitor — every gap, every opportunity</p>
      </div>

      {/* Stale data warnings */}
      {(!ownReviewsOk || !compReviewsOk) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs text-yellow-800 font-medium">
            ⚠ {!ownReviewsOk && !compReviewsOk ? 'Both reports have no reviews analyzed' : !ownReviewsOk ? 'Your product report has no reviews analyzed' : 'Competitor report has no reviews analyzed'} — results may be limited. Re-analyze for better data.
          </p>
        </div>
      )}

      {/* Verdict banner */}
      <div className={`rounded-2xl p-6 border ${
        overallWinner === 'you'  ? 'bg-green-50 border-green-200' :
        overallWinner === 'them' ? 'bg-red-50 border-red-100'     :
                                   'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Overall verdict</p>
            <h2 className="text-lg font-bold text-neutral-900">
              {overallWinner === 'you'  && (scoreDiff === 0 ? `You're tied — any improvement tips the scales` : `You're ahead by ${scoreDiff} points`)}
              {overallWinner === 'them' && `Competitor leads by ${scoreDiff} points — here's your game plan`}
              {overallWinner === 'tied' && `Neck and neck — differentiation is your edge`}
            </h2>
            <p className="text-sm text-neutral-600 mt-1.5">
              {overallWinner === 'you'  && theirWeaknesses.length > 0 && `You're winning — but ${theirWeaknesses.length} competitor weakness${theirWeaknesses.length > 1 ? 'es' : ''} you're not promoting yet. Highlight them.`}
              {overallWinner === 'you'  && theirWeaknesses.length === 0 && yourWeaknesses.length === 0 && `Your customers are more satisfied. Both products have similar complaint profiles — focus on SEO and listing quality.`}
              {overallWinner === 'them' && yourWeaknesses.length > 0 && `Fix your ${yourWeaknesses.length} unique weakness${yourWeaknesses.length > 1 ? 'es' : ''} first — that's exactly where you're losing sales to them.`}
              {overallWinner === 'them' && yourWeaknesses.length === 0 && theirWeaknesses.length > 0 && `Scores differ but complaints are similar. Focus on listing optimization and promoting their ${theirWeaknesses.length} weak point${theirWeaknesses.length > 1 ? 's' : ''}.`}
              {overallWinner === 'tied' && `Small improvements in any area could tip the scales. Focus on the issues below.`}
            </p>
          </div>
          <div className={`text-3xl font-black flex-shrink-0 ${
            overallWinner === 'you' ? 'text-green-600' : overallWinner === 'them' ? 'text-red-500' : 'text-neutral-400'
          }`}>
            {overallWinner === 'you' ? '▲' : overallWinner === 'them' ? '▼' : '='}{scoreDiff}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-green-200 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Your product</span>
              <p className="text-sm font-semibold mt-1 leading-tight line-clamp-2">{ownReport.product_name || 'Your product'}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{ownReport.total_reviews_analyzed ?? 0} reviews analyzed</p>
              {ownDate && <p className="text-[10px] text-neutral-300 mt-0.5">Report: {ownDate}</p>}
            </div>
            <div className={`text-center px-3 py-2 rounded-xl border ${ownSc.bg} ${ownSc.border} flex-shrink-0`}>
              <p className="text-[10px] text-neutral-400">Health</p>
              <p className={`text-2xl font-black ${ownSc.text}`}>{ownScore}</p>
            </div>
          </div>
          <div className="mt-3"><ScoreBar score={ownScore} color={ownSc.hex} /></div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-orange-200 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Competitor</span>
              <p className="text-sm font-semibold mt-1 leading-tight line-clamp-2">{compReport.product_name || 'Competitor'}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{compReport.total_reviews_analyzed ?? 0} reviews analyzed</p>
              {compDate && <p className="text-[10px] text-neutral-300 mt-0.5">Report: {compDate}</p>}
            </div>
            <div className={`text-center px-3 py-2 rounded-xl border ${compSc.bg} ${compSc.border} flex-shrink-0`}>
              <p className="text-[10px] text-neutral-400">Health</p>
              <p className={`text-2xl font-black ${compSc.text}`}>{compScore}</p>
            </div>
          </div>
          <div className="mt-3"><ScoreBar score={compScore} color={compSc.hex} /></div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Key metrics</p>
        <div className="grid grid-cols-[1fr_auto_1fr] text-center text-[10px] text-neutral-400 font-semibold uppercase mb-2">
          <span className="text-right pr-3 text-green-600">You</span>
          <span className="min-w-[90px]">Metric</span>
          <span className="text-left pl-3 text-orange-600">Competitor</span>
        </div>
        <CompareRow label="Health score"     ownVal={ownScore}  compVal={compScore} />
        <CompareRow label="SEO score"        ownVal={own.fr.seo?.score  ?? '—'} compVal={comp.fr.seo?.score ?? '—'} />
        <CompareRow label="Reviews analyzed" ownVal={ownReport.total_reviews_analyzed  ?? 0} compVal={compReport.total_reviews_analyzed ?? 0} />
        <CompareRow label="Problems found"   ownVal={safeArray(own.fr.complaints).length}  compVal={safeArray(comp.fr.complaints).length}  higher="lower" />
        <CompareRow label="Strengths found"  ownVal={safeArray(own.fr.strengths).length}   compVal={safeArray(comp.fr.strengths).length} />
      </div>

      {/* Their weaknesses = your opportunities */}
      {theirWeaknesses.length > 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Their weaknesses — your selling points ({theirWeaknesses.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Problems their buyers complain about that your buyers don't mention. Highlight these gaps in your listing to win those customers.</p>
          <div className="space-y-2">
            {theirWeaknesses.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-500 mt-0.5 flex-shrink-0 font-bold">✓</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                  <p className="text-[10px] text-green-700 font-medium mt-1.5 bg-green-100 rounded px-1.5 py-0.5 inline-block">
                    Add to your listing: "Unlike competitors, our product doesn't have this issue"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : safeArray(comp.fr.complaints).length > 0 ? (
        <div className="bg-white rounded-2xl border border-green-200 p-5">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-bold text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800">No unique competitor weaknesses found</p>
              <p className="text-xs text-neutral-500 mt-0.5">Your product shares all the same complaint areas — focus on fixing shared issues to outpace them.</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Your weaknesses they don't have */}
      {yourWeaknesses.length > 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Your unique weaknesses — fix these first ({yourWeaknesses.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Issues your buyers raise that theirs don't. Every one of these is a reason a buyer would choose your competitor over you right now.</p>
          <div className="space-y-2">
            {yourWeaknesses.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-400 mt-0.5 flex-shrink-0 font-bold">!</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                  {safeArray(c.fixes).length > 0 && (
                    <p className="text-[10px] text-orange-700 font-medium mt-1.5 bg-orange-50 rounded px-1.5 py-0.5 inline-block">
                      Fix: {c.fixes[0]?.simpleFix || c.fixes[0]?.advancedFix || ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : safeArray(own.fr.complaints).length > 0 ? (
        <div className="bg-white rounded-2xl border border-green-200 p-5">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-bold text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800">No unique weaknesses vs this competitor</p>
              <p className="text-xs text-neutral-500 mt-0.5">All your complaint areas are shared with the competitor — neither of you has a unique disadvantage here.</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Shared issues */}
      {sharedIssues.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Shared issues — industry-wide problems ({sharedIssues.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Both products have these complaints — fixing them won't beat this competitor directly, but will improve your overall score and appeal to all buyers.</p>
          <div className="space-y-2">
            {sharedIssues.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-yellow-500 mt-0.5 flex-shrink-0">~</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                  <p className="text-[10px] text-yellow-700 font-medium mt-1.5 bg-yellow-100 rounded px-1.5 py-0.5 inline-block">
                    Industry-wide — whoever fixes this first gains a real edge
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zero complaints on both — no meaningful diff possible */}
      {safeArray(own.fr.complaints).length === 0 && safeArray(comp.fr.complaints).length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-center">
          <p className="text-sm font-semibold text-neutral-700 mb-1">No complaint data to compare</p>
          <p className="text-xs text-neutral-400">Neither report has complaint data. This usually means the products don't have enough reviews yet. Re-analyze once more reviews are available.</p>
        </div>
      )}

      {/* Strengths comparison */}
      {(safeArray(own.fr.strengths).length > 0 || safeArray(comp.fr.strengths).length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">Your strengths</p>
            {safeArray(own.fr.strengths).length === 0
              ? <p className="text-xs text-neutral-400">No strengths detected yet</p>
              : safeArray(own.fr.strengths).map((s: any, i: number) => (
                  <div key={i} className="mb-2 pb-2 border-b border-neutral-100 last:border-0 last:mb-0 last:pb-0">
                    <p className="text-xs font-semibold text-neutral-800">{s.title}</p>
                    {s.description && <p className="text-[10px] text-neutral-500 mt-0.5">{s.description}</p>}
                  </div>
                ))
            }
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">Their strengths</p>
            {safeArray(comp.fr.strengths).length === 0
              ? <p className="text-xs text-neutral-400">No strengths detected</p>
              : safeArray(comp.fr.strengths).map((s: any, i: number) => (
                  <div key={i} className="mb-2 pb-2 border-b border-neutral-100 last:border-0 last:mb-0 last:pb-0">
                    <p className="text-xs font-semibold text-neutral-800">{s.title}</p>
                    {s.description && <p className="text-[10px] text-neutral-500 mt-0.5">{s.description}</p>}
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* Action plan */}
      <div className="bg-black rounded-2xl p-6">
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Your action plan</p>
        <p className="text-xs text-neutral-500 mb-4">
          {overallWinner === 'you'  && `You're leading — lock in the advantage`}
          {overallWinner === 'them' && `Close the ${scoreDiff}-point gap with these moves`}
          {overallWinner === 'tied' && `Break the tie — pick one of these and act this week`}
        </p>
        <div className="space-y-3">
          {yourWeaknesses.slice(0, 3).map((c: any, i: number) => (
            <div key={`fix-${i}`} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">Fix urgently:</span> "{c.title}" — your competitor doesn't have this complaint. Every day it exists you're losing buyers.
              </p>
            </div>
          ))}
          {theirWeaknesses.slice(0, 3 - Math.min(yourWeaknesses.length, 3)).map((c: any, i: number) => (
            <div key={`opp-${i}`} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{Math.min(yourWeaknesses.length, 3) + i + 1}</span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">Promote this gap:</span> Their buyers complain about "{c.title?.toLowerCase()}" — yours don't. Add this to your listing as a differentiator.
              </p>
            </div>
          ))}
          {sharedIssues.slice(0, Math.max(0, 3 - Math.min(yourWeaknesses.length, 3) - Math.min(theirWeaknesses.length, 3 - Math.min(yourWeaknesses.length, 3)))).map((c: any, i: number) => (
            <div key={`shared-${i}`} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-yellow-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{Math.min(yourWeaknesses.length, 3) + Math.min(theirWeaknesses.length, 3 - Math.min(yourWeaknesses.length, 3)) + i + 1}</span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">First-mover opportunity:</span> "{c.title}" affects both products — whoever fixes it first wins buyers from the whole niche.
              </p>
            </div>
          ))}
          {yourWeaknesses.length === 0 && theirWeaknesses.length === 0 && sharedIssues.length === 0 && (
            <p className="text-sm text-neutral-400">Both products have similar complaint profiles with no clear differentiation areas. Focus on improving your health score above {Math.max(ownScore, compScore) + 5} through listing optimization.</p>
          )}
          {yourWeaknesses.length === 0 && theirWeaknesses.length === 0 && sharedIssues.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 bg-yellow-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">First-mover opportunity:</span> All issues are shared — whoever resolves "{sharedIssues[0]?.title?.toLowerCase()}" first gains the edge across the niche.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* View individual reports */}
      <div className="grid grid-cols-2 gap-3 pb-6">
        <button
          onClick={() => router.push(`/dashboard/report/${ownId}`)}
          className="py-3 border border-neutral-200 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors"
        >
          View your full report →
        </button>
        <button
          onClick={() => router.push(`/dashboard/report/${competitorId}`)}
          className="py-3 border border-orange-200 text-sm font-medium text-orange-600 rounded-xl hover:bg-orange-50 transition-colors"
        >
          View competitor's full report →
        </button>
      </div>
    </div>
  )
}

export default function ComparePageWrapper() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    }>
      <ComparePage />
    </Suspense>
  )
}
