'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500',    hex: '#ef4444', bg: 'bg-red-50',    border: 'border-red-200'    }
  if (n <= 65) return { text: 'text-orange-500', hex: '#f97316', bg: 'bg-orange-50', border: 'border-orange-200' }
  return               { text: 'text-green-500',  hex: '#22c55e', bg: 'bg-green-50',  border: 'border-green-200'  }
}

function safeArray(v: any): any[] { return Array.isArray(v) ? v : [] }

function WinnerBadge({ side }: { side: 'left' | 'right' | 'tie' }) {
  if (side === 'left')  return <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">You win</span>
  if (side === 'right') return <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">They win</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">Tied</span>
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
    </div>
  )
}

function CompareRow({ label, ownVal, compVal, higher = 'own' }: {
  label: string
  ownVal: number | string
  compVal: number | string
  higher?: 'own' | 'comp' | 'lower'
}) {
  const ownN  = typeof ownVal  === 'number' ? ownVal  : parseFloat(String(ownVal))  || 0
  const compN = typeof compVal === 'number' ? compVal : parseFloat(String(compVal)) || 0
  let winner: 'left' | 'right' | 'tie' = 'tie'
  if (ownN !== compN) {
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
    if (!ownId || !competitorId) { setError('Missing report IDs'); setLoading(false); return }

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

  // Complaint titles as sets for diff
  const ownComplaints  = new Set(safeArray(own.fr.complaints).map((c: any)  => c.title?.toLowerCase()))
  const compComplaints = new Set(safeArray(comp.fr.complaints).map((c: any) => c.title?.toLowerCase()))

  // Their weaknesses you don't share = your opportunity
  const theirWeaknesses = safeArray(comp.fr.complaints).filter((c: any) =>
    !ownComplaints.has(c.title?.toLowerCase())
  )
  // Your weaknesses they don't share = their advantage
  const yourWeaknesses = safeArray(own.fr.complaints).filter((c: any) =>
    !compComplaints.has(c.title?.toLowerCase())
  )
  // Shared complaints
  const sharedIssues = safeArray(own.fr.complaints).filter((c: any) =>
    compComplaints.has(c.title?.toLowerCase())
  )

  const overallWinner = ownScore > compScore ? 'you' : compScore > ownScore ? 'them' : 'tied'
  const scoreDiff     = Math.abs(ownScore - compScore)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-black flex items-center gap-1">
        ← Back
      </button>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Comparison report</h1>
        <p className="text-xs text-neutral-400 mt-1">Your product vs competitor — side by side</p>
      </div>

      {/* Verdict banner */}
      <div className={`rounded-2xl p-6 border ${
        overallWinner === 'you'  ? 'bg-green-50 border-green-200' :
        overallWinner === 'them' ? 'bg-red-50 border-red-100'     :
                                   'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Overall verdict</p>
            <h2 className="text-lg font-bold text-neutral-900">
              {overallWinner === 'you'  && `You're ahead by ${scoreDiff} points`}
              {overallWinner === 'them' && `Competitor leads by ${scoreDiff} points — here's how to close the gap`}
              {overallWinner === 'tied' && `Neck and neck — differentiation is your edge`}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              {overallWinner === 'you'  && `Your customers are more satisfied. Focus on the ${theirWeaknesses.length} issues they haven't fixed yet.`}
              {overallWinner === 'them' && `They score higher but you have ${theirWeaknesses.length} weaknesses of theirs to exploit.`}
              {overallWinner === 'tied' && `Both products score similarly. Small improvements in any area could tip the scales.`}
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
              <p className="text-sm font-semibold mt-1 leading-tight truncate">{ownReport.product_name || 'Your product'}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{ownReport.total_reviews_analyzed} reviews</p>
            </div>
            <div className={`text-center px-3 py-2 rounded-xl border ${ownSc.bg} ${ownSc.border} flex-shrink-0`}>
              <p className="text-[10px] text-neutral-400">Health</p>
              <p className={`text-2xl font-black ${ownSc.text}`}>{ownScore}</p>
            </div>
          </div>
          <div className="mt-3">
            <ScoreBar score={ownScore} color={ownSc.hex} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-orange-200 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Competitor</span>
              <p className="text-sm font-semibold mt-1 leading-tight truncate">{compReport.product_name || 'Competitor'}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{compReport.total_reviews_analyzed} reviews</p>
            </div>
            <div className={`text-center px-3 py-2 rounded-xl border ${compSc.bg} ${compSc.border} flex-shrink-0`}>
              <p className="text-[10px] text-neutral-400">Health</p>
              <p className={`text-2xl font-black ${compSc.text}`}>{compScore}</p>
            </div>
          </div>
          <div className="mt-3">
            <ScoreBar score={compScore} color={compSc.hex} />
          </div>
        </div>
      </div>

      {/* Key metrics comparison */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Key metrics</p>
        <div className="grid grid-cols-[1fr_auto_1fr] text-center text-[10px] text-neutral-400 font-semibold uppercase mb-2">
          <span className="text-right pr-3 text-green-600">You</span>
          <span className="min-w-[90px]">Metric</span>
          <span className="text-left pl-3 text-orange-600">Competitor</span>
        </div>
        <CompareRow label="Health score"     ownVal={ownScore}  compVal={compScore} />
        <CompareRow label="SEO score"        ownVal={own.fr.seo?.score  || '—'} compVal={comp.fr.seo?.score  || '—'} />
        <CompareRow label="Reviews analyzed" ownVal={ownReport.total_reviews_analyzed  || 0} compVal={compReport.total_reviews_analyzed || 0} />
        <CompareRow label="Problems found"   ownVal={safeArray(own.fr.complaints).length}  compVal={safeArray(comp.fr.complaints).length}  higher="lower" />
        <CompareRow label="Strengths found"  ownVal={safeArray(own.fr.strengths).length}   compVal={safeArray(comp.fr.strengths).length} />
      </div>

      {/* Their weaknesses = your opportunities */}
      {theirWeaknesses.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Their weaknesses — your opportunities ({theirWeaknesses.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Problems their customers complain about that yours don't mention. Highlight these in your listing.</p>
          <div className="space-y-2">
            {theirWeaknesses.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                  <p className="text-[10px] text-green-700 font-medium mt-1">You don't have this problem — use it as a selling point</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your weaknesses they don't have */}
      {yourWeaknesses.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Your unique weaknesses — fix these first ({yourWeaknesses.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Issues your customers raise that theirs don't. These are costing you sales to this competitor.</p>
          <div className="space-y-2">
            {yourWeaknesses.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                  {safeArray(c.fixes).length > 0 && (
                    <p className="text-[10px] text-orange-700 font-medium mt-1">
                      Fix: {c.fixes[0]?.simpleFix || c.fixes[0]?.advancedFix || ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared issues */}
      {sharedIssues.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
              Shared issues — industry-wide problems ({sharedIssues.length})
            </p>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Both products have these complaints. Fixing them won't beat the competitor but will improve your overall score.</p>
          <div className="space-y-2">
            {sharedIssues.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-yellow-500 mt-0.5 flex-shrink-0">~</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.title}</p>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
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
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* Action plan */}
      <div className="bg-black rounded-2xl p-6">
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">Your action plan</p>
        <div className="space-y-2">
          {theirWeaknesses.slice(0, 2).map((c: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">Add to your listing:</span> Mention that you don't have the "{c.title?.toLowerCase()}" problem your competitor does
              </p>
            </div>
          ))}
          {yourWeaknesses.slice(0, 2).map((c: any, i: number) => (
            <div key={theirWeaknesses.slice(0, 2).length + i} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-orange-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {theirWeaknesses.slice(0, 2).length + i + 1}
              </span>
              <p className="text-sm text-neutral-300">
                <span className="text-white font-semibold">Fix urgently:</span> "{c.title}" — your competitor doesn't have this complaint
              </p>
            </div>
          ))}
          {theirWeaknesses.length === 0 && yourWeaknesses.length === 0 && (
            <p className="text-sm text-neutral-400">Both products have similar complaint profiles. Focus on improving your overall health score above {Math.max(ownScore, compScore) + 5}.</p>
          )}
        </div>
      </div>

      {/* View individual reports */}
      <div className="grid grid-cols-2 gap-3">
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
