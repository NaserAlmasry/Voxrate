'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import EmptyState from '@/app/components/EmptyState'
import { ComparePageSkeleton } from '@/app/components/Skeleton'

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

// ── Opportunity Summary ───────────────────────────────────────────────────────
function OpportunitySummary({ ownScore, compScore, scoreDiff, overallWinner, yourWeaknesses, theirWeaknesses, sharedIssues, ownStrengths, compStrengths, ownReviews, compReviews }: any) {
  const lines: string[] = []

  // Score context
  if (overallWinner === 'you') {
    lines.push(`Your listing scores ${scoreDiff} points higher than this competitor${scoreDiff >= 15 ? ' — a significant lead' : ''}.`)
  } else if (overallWinner === 'them') {
    lines.push(`This competitor leads you by ${scoreDiff} points${scoreDiff >= 15 ? ' — a meaningful gap worth closing' : ' — a small gap you can close quickly'}.`)
  } else {
    lines.push(`You and this competitor are evenly matched on overall score.`)
  }

  // Complaint gaps
  if (theirWeaknesses.length > 0 && yourWeaknesses.length === 0) {
    lines.push(`You have no unique weaknesses — but they have ${theirWeaknesses.length}. Lead with "${theirWeaknesses[0]?.title}" in your listing to pull their dissatisfied buyers.`)
  } else if (yourWeaknesses.length > 0 && theirWeaknesses.length === 0) {
    lines.push(`You have ${yourWeaknesses.length} unique complaint${yourWeaknesses.length > 1 ? 's' : ''} they don't — fixing "${yourWeaknesses[0]?.title}" alone could close the gap.`)
  } else if (theirWeaknesses.length > 0 && yourWeaknesses.length > 0) {
    lines.push(`You both have unique issues: fix your "${yourWeaknesses[0]?.title}" problem while promoting that they struggle with "${theirWeaknesses[0]?.title?.toLowerCase()}".`)
  } else if (sharedIssues.length > 0) {
    lines.push(`All complaints are shared — whoever fixes "${sharedIssues[0]?.title?.toLowerCase()}" first gains the edge across the whole niche.`)
  }

  // Strengths gap
  const missedStrengths = compStrengths.filter((cs: any) =>
    !ownStrengths.some((os: any) => { const w = (cs.title || '').toLowerCase().split(' ')[0]; return w.length > 2 && (os.title || '').toLowerCase().includes(w) })
  )
  if (missedStrengths.length > 0) {
    lines.push(`Their customers praise "${missedStrengths[0]?.title}" — a quality your listing doesn't highlight yet.`)
  }

  const bg = overallWinner === 'you' ? 'from-green-50 to-white border-green-200' :
             overallWinner === 'them' ? 'from-red-50 to-white border-red-100' :
             'from-blue-50 to-white border-blue-100'
  const dot = overallWinner === 'you' ? 'bg-green-500' : overallWinner === 'them' ? 'bg-red-500' : 'bg-blue-500'

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Strategic summary</p>
      </div>
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 leading-relaxed">
            <span className="text-neutral-300 mt-0.5 flex-shrink-0">→</span>
            {line}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-neutral-400 mt-3">Based on {ownReviews + compReviews} total reviews analyzed across both listings.</p>
    </div>
  )
}

// ── Strengths You're Missing ──────────────────────────────────────────────────
function StrengthsYoureMissing({ ownStrengths, compStrengths }: { ownStrengths: any[]; compStrengths: any[] }) {
  if (compStrengths.length === 0) return null

  const ownTitles = ownStrengths.map((s: any) => (s.title || '').toLowerCase())
  const missing = compStrengths.filter((cs: any) => {
    const word = (cs.title || '').toLowerCase().split(' ')[0]
    return word.length > 2 && !ownTitles.some(t => t.includes(word))
  })

  if (missing.length === 0) return (
    <div className="bg-white rounded-2xl border border-green-200 p-5 flex items-center gap-3">
      <span className="text-green-500 font-bold text-lg">✓</span>
      <div>
        <p className="text-sm font-semibold text-neutral-800">You match all their strengths</p>
        <p className="text-xs text-neutral-400 mt-0.5">Everything their customers praise, yours praise too. No blind spots found.</p>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-purple-500" />
        <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
          Strengths you're missing ({missing.length})
        </p>
      </div>
      <p className="text-xs text-neutral-400 mb-4">Their customers love these qualities — yours don't mention them. Either you have them and aren't promoting them, or you need to add them.</p>
      <div className="space-y-2">
        {missing.map((s: any, i: number) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-100 rounded-xl">
            <span className="text-purple-400 mt-0.5 flex-shrink-0">★</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800">{s.title}</p>
              {s.description && <p className="text-xs text-neutral-500 mt-0.5">{s.description}</p>}
              <p className="text-[10px] text-purple-700 font-medium mt-1.5 bg-purple-100 rounded px-1.5 py-0.5 inline-block">
                Add to listing or photos if you already offer this
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Battle Card ───────────────────────────────────────────────────────────────
function BattleCard({ ownName, compName, ownScore, compScore, overallWinner, scoreDiff, yourWeaknesses, theirWeaknesses, ownStrengths, compStrengths }: any) {
  const [copied, setCopied] = useState(false)

  const copyCard = () => {
    const lines = [
      `BATTLE CARD — Voxrate`,
      ``,
      `YOUR PRODUCT: ${ownName}`,
      `  Health score: ${ownScore}/100`,
      `  Strengths: ${ownStrengths.slice(0, 3).map((s: any) => s.title).join(', ') || 'N/A'}`,
      `  Unique weaknesses: ${yourWeaknesses.length === 0 ? 'None' : yourWeaknesses.slice(0, 3).map((c: any) => c.title).join(', ')}`,
      ``,
      `COMPETITOR: ${compName}`,
      `  Health score: ${compScore}/100`,
      `  Strengths: ${compStrengths.slice(0, 3).map((s: any) => s.title).join(', ') || 'N/A'}`,
      `  Unique weaknesses: ${theirWeaknesses.length === 0 ? 'None' : theirWeaknesses.slice(0, 3).map((c: any) => c.title).join(', ')}`,
      ``,
      `VERDICT: ${overallWinner === 'you' ? `You lead by ${scoreDiff} points` : overallWinner === 'them' ? `They lead by ${scoreDiff} points` : 'Tied'}`,
      ``,
      `TOP ACTIONS:`,
      ...yourWeaknesses.slice(0, 2).map((c: any) => `  • Fix: "${c.title}"`),
      ...theirWeaknesses.slice(0, 2).map((c: any) => `  • Promote: Their buyers hate "${c.title?.toLowerCase()}"`),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-neutral-900 overflow-hidden">
      {/* Card header */}
      <div className="bg-neutral-900 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 9H17v1.5c0 .83-.67 1.5-1.5 1.5S14 11.33 14 10.5 14.67 9 15.5 9z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 15H7v-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <p className="text-xs font-bold text-white tracking-wide uppercase">Battle Card</p>
        </div>
        <button
          type="button"
          onClick={copyCard}
          className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors"
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 divide-x divide-neutral-100">
        {/* You */}
        <div className="p-5">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1">You</p>
          <p className="text-xs font-semibold text-neutral-800 line-clamp-1 mb-3">{ownName}</p>
          <div className="flex items-baseline gap-1 mb-3">
            <span className={`text-3xl font-black ${ownScore > compScore ? 'text-green-600' : ownScore < compScore ? 'text-red-500' : 'text-neutral-700'}`}>{ownScore}</span>
            <span className="text-xs text-neutral-400">/100</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase">Top strengths</p>
            {ownStrengths.slice(0, 3).length > 0
              ? ownStrengths.slice(0, 3).map((s: any, i: number) => (
                  <p key={i} className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <span className="text-green-400 flex-shrink-0">✓</span>{s.title}
                  </p>
                ))
              : <p className="text-xs text-neutral-300">No strengths detected</p>
            }
          </div>
          {yourWeaknesses.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase">Fix urgently</p>
              {yourWeaknesses.slice(0, 2).map((c: any, i: number) => (
                <p key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                  <span className="flex-shrink-0">!</span>{c.title}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Competitor */}
        <div className="p-5">
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1">Competitor</p>
          <p className="text-xs font-semibold text-neutral-800 line-clamp-1 mb-3">{compName}</p>
          <div className="flex items-baseline gap-1 mb-3">
            <span className={`text-3xl font-black ${compScore > ownScore ? 'text-green-600' : compScore < ownScore ? 'text-red-500' : 'text-neutral-700'}`}>{compScore}</span>
            <span className="text-xs text-neutral-400">/100</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase">Their strengths</p>
            {compStrengths.slice(0, 3).length > 0
              ? compStrengths.slice(0, 3).map((s: any, i: number) => (
                  <p key={i} className="text-xs text-neutral-600 flex items-center gap-1.5">
                    <span className="text-orange-400 flex-shrink-0">✓</span>{s.title}
                  </p>
                ))
              : <p className="text-xs text-neutral-300">No strengths detected</p>
            }
          </div>
          {theirWeaknesses.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase">Their weak spots</p>
              {theirWeaknesses.slice(0, 2).map((c: any, i: number) => (
                <p key={i} className="text-xs text-green-700 flex items-center gap-1.5">
                  <span className="flex-shrink-0">→</span>{c.title}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Verdict footer */}
      <div className={`px-5 py-3 border-t border-neutral-100 flex items-center justify-between ${
        overallWinner === 'you' ? 'bg-green-50' : overallWinner === 'them' ? 'bg-red-50' : 'bg-neutral-50'
      }`}>
        <p className="text-xs font-semibold text-neutral-700">
          {overallWinner === 'you'  && `You lead by ${scoreDiff} pts — keep the pressure on`}
          {overallWinner === 'them' && `Close ${scoreDiff} pts — start with your unique weaknesses`}
          {overallWinner === 'tied' && `Tied — first to improve wins the buyers`}
        </p>
        <span className={`text-lg font-black ${
          overallWinner === 'you' ? 'text-green-600' : overallWinner === 'them' ? 'text-red-500' : 'text-neutral-400'
        }`}>
          {overallWinner === 'you' ? '▲' : overallWinner === 'them' ? '▼' : '='}
        </span>
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
    const loadReports = async () => {
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
    loadReports()
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-xs text-neutral-400 hover:text-black flex items-center gap-1">← Back</button>
      <div>
        <h1 className="text-xl font-semibold">Select your product to compare</h1>
        <p className="text-xs text-neutral-400 mt-1">Pick which of your products to stack against this competitor</p>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 animate-pulse flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2"><div className="h-4 bg-neutral-100 rounded w-2/5"/><div className="h-3 bg-neutral-100 rounded w-1/4"/></div>
            <div className="h-10 w-12 bg-neutral-100 rounded-xl"/>
          </div>
        ))}</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
          title="Nothing to compare yet"
          description="First analyze your own product, then come back here to see how it stacks up against any competitor."
          action={{ label: 'Analyze your product', onClick: () => router.push('/dashboard') }}
          tip="Compare mode reveals exactly where competitors beat you — and where you have the advantage."
        />
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

  if (loading) return <ComparePageSkeleton />

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

      {/* ── OPPORTUNITY SUMMARY ── */}
      <OpportunitySummary
        ownScore={ownScore}
        compScore={compScore}
        scoreDiff={scoreDiff}
        overallWinner={overallWinner}
        yourWeaknesses={yourWeaknesses}
        theirWeaknesses={theirWeaknesses}
        sharedIssues={sharedIssues}
        ownStrengths={safeArray(own.fr.strengths)}
        compStrengths={safeArray(comp.fr.strengths)}
        ownReviews={ownReport.total_reviews_analyzed || 0}
        compReviews={compReport.total_reviews_analyzed || 0}
      />

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

      {/* ── STRENGTHS YOU'RE MISSING ── */}
      <StrengthsYoureMissing ownStrengths={safeArray(own.fr.strengths)} compStrengths={safeArray(comp.fr.strengths)} />

      {/* ── BATTLE CARD ── */}
      <BattleCard
        ownName={ownReport.product_name || 'Your product'}
        compName={compReport.product_name || 'Competitor'}
        ownScore={ownScore}
        compScore={compScore}
        overallWinner={overallWinner}
        scoreDiff={scoreDiff}
        yourWeaknesses={yourWeaknesses}
        theirWeaknesses={theirWeaknesses}
        ownStrengths={safeArray(own.fr.strengths)}
        compStrengths={safeArray(comp.fr.strengths)}
      />

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
