'use client'

// ============================================================
// DASHBOARD HOME — voxrate/app/dashboard/page.tsx
// ============================================================

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { AlertTriangle, Lightbulb, TrendingUp, Crosshair, Dumbbell, BarChart2, Sparkles, Zap, RotateCcw, Clock } from 'lucide-react'

export const SIMULATE_USER_KEY = 'voxrate_simulate_user'

function DashboardHomeInner() {
  const searchParams = useSearchParams()
  const [url, setUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      return p.get('url') || ''
    }
    return ''
  })
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [cachedReport, setCachedReport] = useState<{ id: string; productName: string } | null>(null)
  const [analysesCount, setAnalysesCount] = useState(0)
  const [credits, setCredits] = useState<number | null>(null)
  const [planRenewalDate, setPlanRenewalDate] = useState<string | null>(null)
  const [latestReport, setLatestReport] = useState<any>(null)
  const [simulatingUser, setSimulatingUser] = useState(false)
  const [userPlan, setUserPlan] = useState('free')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null)
  const [showSpyPanel, setShowSpyPanel] = useState(false)
  const [spyUrl, setSpyUrl] = useState('')
  const [spyOwnReportId, setSpyOwnReportId] = useState('')
  const [spyLoading, setSpyLoading] = useState(false)
  const [spyError, setSpyError] = useState('')
  const [ownReports, setOwnReports] = useState<{ id: string; product_name: string }[]>([])
  const [competitorCounts, setCompetitorCounts] = useState<Record<string, number>>({})
  const inputRef    = useRef<HTMLInputElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase    = supabaseRef.current
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Abort any in-flight request on unmount
  useEffect(() => () => {
    controllerRef.current?.abort()
    if (bulkPollRef.current) clearInterval(bulkPollRef.current)
  }, [])

  // Detect extension install via postMessage handshake
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'VOXRATE_EXTENSION_INSTALLED') {
        setExtensionInstalled(true)
        window.removeEventListener('message', handler)
      }
    }
    window.addEventListener('message', handler)
    setTimeout(() => {
      setExtensionInstalled(prev => prev === null ? false : prev)
      window.removeEventListener('message', handler)
    }, 1500)
  }, [])
  const [showCancelWarning, setShowCancelWarning] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkAsins, setBulkAsins] = useState(['', '', '', '', ''])
  const [bulkMarketplace, setBulkMarketplace] = useState('amazon.com')
  const [bulkJobs, setBulkJobs] = useState<{ asin: string; jobId: string; status: string; reportId?: string; error?: string }[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const bulkPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)
  // Returns the ISO date of the Monday of the current week — used as a stable weekly dismissal key
  const getWeekKey = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10)
  }

  const [weeklyDigest, setWeeklyDigest] = useState<{ productName: string; score: number; topComplaint: string | null; prevScore: number | null } | null>(null)
  const [digestDismissed, setDigestDismissed] = useState(false)
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false)
  const [velocityData, setVelocityData] = useState<any[]>([])
  const [scScanData, setScScanData] = useState<any[]>([])
  const [velocityExpanded, setVelocityExpanded] = useState(false)
  const [scExpanded, setScExpanded] = useState(false)

  const toggleSimulation = (val: boolean) => {
    setSimulatingUser(val)
    localStorage.setItem(SIMULATE_USER_KEY, val ? 'true' : 'false')
  }

  const checkCache = async (inputUrl: string) => {
    const trimmed = inputUrl.trim()
    const asinFromPath = trimmed.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
    const asinBare     = /^[A-Z0-9]{10}$/i.test(trimmed) ? trimmed : null
    const asin         = (asinFromPath?.[1] || asinBare)?.toUpperCase()
    if (!asin) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('reports')
      .select('id, product_name')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .ilike('product_url', `%${asin}%`)
      .order('created_at', { ascending: false })
      .limit(1)
    setCachedReport(data && data.length > 0
      ? { id: data[0].id, productName: data[0].product_name || 'this product' }
      : null)
  }

  // ── Effects ──────────────────────────────────────────────

  // Show "account verified" toast when landing here with ?verified=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verified') === 'true') {
      setShowVerifiedBanner(true)
      // Clean param from URL without reload
      const cleanSearch = params.toString().replace(/[&?]?verified=true/, '').replace(/^&/, '')
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + (window.location.hash || '')
      window.history.replaceState(null, '', cleanUrl)
      const t = setTimeout(() => setShowVerifiedBanner(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  // Referral attribution — if this user landed via /?ref=CODE before signup,
  // associate them with the referrer now (idempotent server-side).
  useEffect(() => {
    try {
      const refCode = localStorage.getItem('voxrate_ref_code')
      if (!refCode) return
      fetch('/api/referral/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ referral_code: refCode }),
      })
        .catch(() => {})
        .finally(() => {
          try { localStorage.removeItem('voxrate_ref_code') } catch {}
        })
    } catch {}
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(SIMULATE_USER_KEY)
    if (saved === 'true') setSimulatingUser(true)

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
        setUserName(name)

        // Feature 1: Fetch velocity and SC scan data
        fetch('/api/toolkit/velocity', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.data) setVelocityData(d.data) })
          .catch(() => {})

        fetch('/api/toolkit/sc-scan', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.data) setScScanData(d.data) })
          .catch(() => {})
      }
    })

    // Auto-analyze URL saved before auth (user pasted URL on landing page while logged out)
    const pendingUrl = localStorage.getItem('pendingUrl')
    if (pendingUrl) {
      localStorage.removeItem('pendingUrl')
      setUrl(pendingUrl)
      // Small delay so state settles before triggering
      const pendingTimer = setTimeout(() => {
        const isAmazonUrl = /amazon\.(com|co\.uk|de|co\.jp|ca|com\.au|fr|it|es|com\.mx|nl|se|pl)(\/|$)/.test(pendingUrl)
        if (!isAmazonUrl && !/^[A-Z0-9]{10}$/i.test(pendingUrl.trim())) return
        cancelledRef.current = false
        setLoading(true); setError('')
        const controller = new AbortController()
        controllerRef.current = controller
        fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ productUrl: pendingUrl }),
          signal: controller.signal,
        })
          .then(r => r.json().then(data => ({ ok: r.ok, data })))
          .then(({ ok, data }) => {
            if (!ok) { setError(data.error || 'Analysis failed.'); setLoading(false); return }
            window.location.href = `/dashboard/report/${data.reportId}`
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') { setError('Something went wrong.'); setLoading(false) }
          })
      }, 300)
      return () => clearTimeout(pendingTimer)
    }

  }, [])

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) { setLoading(false); return }

        const { data: userData } = await supabase
          .from('users').select('analyses_count, plan, is_admin, own_analyses_remaining, competitor_analyses_remaining, stripe_current_period_end, trial_ends_at').eq('id', user.id).single()

        if (userData) {
          setAnalysesCount(userData.analyses_count || 0)
          setCredits((userData.own_analyses_remaining ?? 0) + (userData.competitor_analyses_remaining ?? 0))
          setPlanRenewalDate(userData.stripe_current_period_end ?? userData.trial_ends_at ?? null)
          if (userData.plan) setUserPlan(userData.plan)
          if (userData.is_admin === true) setIsAdminUser(true)
        }

        const { data: reportData } = await supabase
          .from('reports')
          .select('id, product_name, health_score, top_complaint, top_strength, total_reviews_analyzed')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (reportData && reportData.length > 0) setLatestReport(reportData[0])

        // Load all own completed reports for spy dropdown
        const { data: ownReportData } = await supabase
          .from('reports')
          .select('id, product_name')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('report_type', 'own')
          .order('created_at', { ascending: false })
          .limit(20)
        if (ownReportData) setOwnReports(ownReportData)

        // Load weekly digest: most recently monitored listing with a score change
        try {
          const dismissed = localStorage.getItem('voxrate_digest_week')
          const _wd = new Date(); _wd.setDate(_wd.getDate() - _wd.getDay() + 1)
          const thisWeek  = _wd.toISOString().slice(0, 10)
          if (dismissed !== thisWeek) {
            const { data: monData } = await supabase
              .from('monitored_listings')
              .select('product_name, last_score')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .order('last_checked_at', { ascending: false })
              .limit(1)
            if (monData && monData.length > 0) {
              const m = monData[0]
              setWeeklyDigest({
                productName: m.product_name || 'your listing',
                score: m.last_score ?? 0,
                prevScore: null,
                topComplaint: null,
              })
            }
          }
        } catch {}

        // Load competitor usage counts for this month per product
        const now        = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const { data: usageData } = await supabase
          .from('competitor_usage')
          .select('own_report_id')
          .eq('user_id', user.id)
          .gte('created_at', monthStart)
        if (usageData) {
          const counts: Record<string, number> = {}
          for (const row of usageData) {
            const key = row.own_report_id ?? '__total__'
            counts[key] = (counts[key] ?? 0) + 1
          }
          setCompetitorCounts(counts)
        }
      } catch (err) {
        console.error('[Dashboard] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadUserData()
  }, [])

  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  // ── Event Handlers ───────────────────────────────────────

  const handleSpyAnalyze = async () => {
    if (!spyUrl.trim()) { setSpyError('Paste a competitor Amazon URL or ASIN'); return }
    if (!spyOwnReportId) { setSpyError('Select which of your products this competes with'); return }
    setSpyError('')
    setSpyLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ productUrl: spyUrl.trim(), reportType: 'competitor', ownReportId: spyOwnReportId }),
      })
      const data = await res.json()
      if (!res.ok) { setSpyError(data.error || 'Analysis failed.'); setSpyLoading(false); return }
      window.location.href = `/dashboard/report/${data.reportId}`
    } catch {
      setSpyError('Something went wrong. Please try again.')
      setSpyLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!url.trim()) return
    const isValidAmazon = /amazon\.(com|co\.uk|de|co\.jp|ca|com\.au|fr|it|es|com\.mx|nl|se|pl)(\/|$)/.test(url) || /^[A-Z0-9]{10}$/i.test(url.trim())
    if (!isValidAmazon) { setError('Please paste a valid Amazon URL or ASIN (e.g. B073JYC4XM)'); return }
    // Paid users need the extension installed to scrape reviews
    if (!isAdminUser && userPlan !== 'free' && extensionInstalled === false) {
      setError('__EXTENSION_REQUIRED__')
      return
    }
    cancelledRef.current = false
    await checkCache(url)
    setLoading(true); setError(''); setShowCancelWarning(false)
    try {
      const controller = new AbortController()
      controllerRef.current = controller
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ productUrl: url }),
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Analysis failed.'); setLoading(false); return }
      window.location.href = `/dashboard/report/${data.reportId}`
    } catch (err: any) {
      if (!cancelledRef.current && err?.name !== 'AbortError') setError('Something went wrong.')
      setLoading(false)
    }
  }

  const handleCancel = () => setShowCancelWarning(true)
  const confirmCancel = () => {
    cancelledRef.current = true
    controllerRef.current?.abort()
    setShowCancelWarning(false)
    setLoading(false)
    setError('Analysis cancelled.')
  }

  const handleBulkAnalyze = async () => {
    const filled = bulkAsins.filter(a => a.trim())
    if (filled.length === 0) { setBulkError('Enter at least one ASIN'); return }
    setBulkError('')
    setBulkLoading(true)
    setBulkJobs([])
    if (bulkPollRef.current) clearInterval(bulkPollRef.current)

    try {
      const res = await fetch('/api/bulk-analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body:    JSON.stringify({ asins: filled, marketplace: bulkMarketplace }),
      })
      const data = await res.json()
      if (!res.ok) { setBulkError(data.error || 'Failed to queue jobs.'); setBulkLoading(false); return }

      const initialJobs = (data.jobs as { asin: string; jobId: string }[]).map(j => ({
        ...j, status: 'pending',
      }))
      setBulkJobs(initialJobs)

      const jobIds = initialJobs.map(j => j.jobId)
      bulkPollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/bulk-analyze/status?jobIds=${jobIds.join(',')}`)
          const sd = await sr.json()
          if (!sr.ok) return
          setBulkJobs(prev => prev.map(j => {
            const found = sd.statuses?.find((s: { jobId: string }) => s.jobId === j.jobId)
            if (!found) return j
            return { ...j, status: found.status, reportId: found.reportId ?? undefined, error: found.error ?? undefined }
          }))
          const allDone = sd.statuses?.every((s: { status: string }) =>
            ['completed', 'partial', 'failed', 'amazon_not_logged_in'].includes(s.status)
          )
          if (allDone) {
            if (bulkPollRef.current) clearInterval(bulkPollRef.current)
            setBulkLoading(false)
          }
        } catch {}
      }, 4000)
    } catch {
      setBulkError('Something went wrong. Please try again.')
      setBulkLoading(false)
    }
  }

  const getLoadingMessage = (secs: number) => {
    return secs < 20 ? 'Connecting to Amazon...' : secs < 60 ? 'Reading customer reviews...' : secs < 120 ? 'Finding patterns...' : 'Building your report...'
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60); const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const insightsToShow = latestReport ? [
    { icon: <TrendingUp size={14} />, color: 'text-green-600 bg-green-50', text: `Health score: ${latestReport.health_score}/100` },
    { icon: <AlertTriangle size={14} />, color: 'text-red-500 bg-red-50', text: latestReport.top_complaint || 'No major complaints found' },
    { icon: <Sparkles size={14} />, color: 'text-orange-500 bg-orange-50', text: latestReport.top_strength || 'No strengths found' },
    { icon: <BarChart2 size={14} />, color: 'text-blue-500 bg-blue-50', text: `${latestReport.total_reviews_analyzed} reviews analyzed` },
  ] : [
    { icon: <AlertTriangle size={14} />, color: 'text-red-500 bg-red-50', text: 'Most products have 2–4 fixable complaints' },
    { icon: <Lightbulb size={14} />, color: 'text-amber-500 bg-amber-50', text: 'Sellers who fix top complaints see faster growth' },
    { icon: <TrendingUp size={14} />, color: 'text-green-600 bg-green-50', text: 'Better listing copy can double click-through rate' },
    { icon: <Crosshair size={14} />, color: 'text-blue-500 bg-blue-50', text: 'Paste your URL above to see real insights' },
  ]

  const showBlur = userPlan === 'free' && analysesCount === 0 && !simulatingUser

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="max-w-2xl mx-auto pb-20 space-y-5">

      {/* ── Account verified toast ── */}
      {showVerifiedBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 bg-green-600 text-white text-sm font-medium rounded-2xl shadow-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Account verified! Welcome to Voxrate.
          <button onClick={() => setShowVerifiedBanner(false)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Admin Toggle ── */}
      {isAdminUser && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium ${simulatingUser ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
          <span>{simulatingUser ? 'User view active' : 'Admin mode'}</span>
          <button onClick={() => toggleSimulation(!simulatingUser)} className="px-3 py-1 bg-black text-white rounded-lg text-xs">Switch</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Hey, <span className="text-orange-500">{userName || '...'}</span>
        </h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          {analysesCount === 0 ? 'Ready to analyze your first product?' : `You've run ${analysesCount} ${analysesCount === 1 ? 'analysis' : 'analyses'} so far.`}
        </p>
      </div>

      {/* ── Free trial warning ── */}
      {userPlan === 'free' && !simulatingUser && credits !== null && credits < 1 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
            <p className="text-xs text-orange-800">
              <span className="font-semibold">You've used all your free analyses.</span> Upgrade to keep analyzing.
            </p>
          </div>
          <a href="/#pricing" className="flex-shrink-0 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-colors">
            Upgrade →
          </a>
        </div>
      )}

      {/* ── Usage card ── */}
      {credits !== null && userPlan !== 'free' && !simulatingUser && (() => {
        const PLAN_POOL: Record<string, number> = { trial: 5, starter: 35, growth: 80, pro: 220 }
        const PLAN_BURST: Record<string, number> = { trial: 2, starter: 3, growth: 5, pro: 8 }
        const pool  = PLAN_POOL[userPlan]  ?? 35
        const burst = PLAN_BURST[userPlan] ?? 3
        const used  = Math.max(0, pool - credits)
        const pct   = Math.min(100, Math.round((used / pool) * 100))
        const renewLabel = planRenewalDate
          ? new Date(planRenewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'next billing date'
        const barColor = pct >= 90 ? 'bg-red-500' : pct >= 65 ? 'bg-orange-500' : 'bg-green-500'
        return (
          <div className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-orange-500" />
                <p className="text-sm font-semibold text-neutral-800">Analyses this month</p>
              </div>
              <span className="text-xs text-neutral-400 capitalize">{userPlan} plan</span>
            </div>

            {/* Progress bar */}
            <div className="mb-1.5">
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
              <span><span className="font-semibold text-neutral-800">{credits}</span> remaining of {pool}</span>
              <span>{pct}% used</span>
            </div>

            {/* Two stat pills */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2.5">
                <Clock size={13} className="text-neutral-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-neutral-400">Burst limit</p>
                  <p className="text-xs font-semibold text-neutral-700">{burst} per 30 min</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2.5">
                <RotateCcw size={13} className="text-neutral-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-neutral-400">Resets</p>
                  <p className="text-xs font-semibold text-neutral-700">{renewLabel}</p>
                </div>
              </div>
            </div>

            {credits < 5 && (
              <div className="mt-3 flex items-center justify-between gap-2 p-2.5 bg-orange-50 border border-orange-100 rounded-xl">
                <p className="text-xs text-orange-700">Running low — unused analyses roll over next month.</p>
                <a href="/#pricing" className="flex-shrink-0 text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2">Upgrade</a>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Weekly digest card ── */}
      {weeklyDigest && !digestDismissed && (
        <div className="bg-white border border-orange-200 rounded-2xl p-4 flex items-start gap-4">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-700 mb-0.5">
              This week's snapshot — <span className="text-orange-600">{weeklyDigest.productName}</span>
            </p>
            <p className="text-xs text-neutral-500">
              Health score: <span className={`font-semibold ${weeklyDigest.score <= 37 ? 'text-red-500' : weeklyDigest.score <= 65 ? 'text-orange-500' : 'text-green-500'}`}>{weeklyDigest.score}/100</span>
              {weeklyDigest.prevScore !== null && weeklyDigest.prevScore !== weeklyDigest.score && (
                <span className={`ml-1.5 font-medium ${weeklyDigest.score > weeklyDigest.prevScore ? 'text-green-500' : 'text-red-500'}`}>
                  {weeklyDigest.score > weeklyDigest.prevScore ? `↑ up ${weeklyDigest.score - weeklyDigest.prevScore} pts` : `↓ down ${weeklyDigest.prevScore - weeklyDigest.score} pts`} since you started monitoring
                </span>
              )}
            </p>
            {weeklyDigest.topComplaint && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Top complaint still open: <span className="text-neutral-600 font-medium">{weeklyDigest.topComplaint}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => { setDigestDismissed(true); const _d = new Date(); _d.setDate(_d.getDate() - _d.getDay() + 1); localStorage.setItem('voxrate_digest_week', _d.toISOString().slice(0, 10)) }}
            className="text-neutral-300 hover:text-neutral-500 flex-shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Main Input ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden ring-1 ring-orange-100">
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100 bg-gradient-to-r from-orange-50/60 to-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest">New analysis</p>
            <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
              <button
                onClick={() => setBulkMode(false)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${!bulkMode ? 'bg-white shadow text-neutral-800' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                Single
              </button>
              <button
                onClick={() => setBulkMode(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${bulkMode ? 'bg-white shadow text-neutral-800' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                Bulk
              </button>
            </div>
          </div>

          {!bulkMode && (error === '__EXTENSION_REQUIRED__' ? (
            <div className="mb-4 p-3.5 bg-orange-50 border border-orange-200 rounded-xl text-xs">
              <p className="font-semibold text-orange-800 mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} className="flex-shrink-0" />
                Chrome extension required
              </p>
              <p className="text-orange-700 mb-2.5">You need to install the Voxrate Chrome extension to analyze products. It scrapes Amazon reviews using your own logged-in session.</p>
              <a href="/dashboard/settings/extension" className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                Download extension →
              </a>
            </div>
          ) : error ? (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              <AlertTriangle size={13} />
              {error}
            </div>
          ) : null)}

          {!bulkMode && cachedReport && !loading && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              You already analyzed <strong>{cachedReport.productName}</strong>.{' '}
              <a href={`/dashboard/report/${cachedReport.id}`} className="underline font-medium">View that report →</a>
            </div>
          )}

          {!bulkMode && loading && !showCancelWarning && (
            <div className="mb-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <p className="text-xs text-orange-700 font-medium">{getLoadingMessage(elapsed)}</p>
                </div>
                <button onClick={handleCancel} className="text-xs text-orange-400 hover:text-orange-600 underline">Cancel</button>
              </div>
              <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((elapsed / 240) * 100, 95)}%` }} />
              </div>
              <p className="text-[10px] text-orange-400 mt-2">{formatTime(elapsed)} elapsed</p>
            </div>
          )}

          {!bulkMode && showCancelWarning && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs">
              <p className="font-medium text-red-700 mb-2">Cancel this analysis?</p>
              <div className="flex gap-2">
                <button onClick={confirmCancel} className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium">Yes, cancel</button>
                <button onClick={() => setShowCancelWarning(false)} className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-600">Keep going</button>
              </div>
            </div>
          )}

          {bulkMode ? (
            <div className="space-y-3">
              {bulkError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  <AlertTriangle size={13} />{bulkError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Marketplace</label>
                <select
                  value={bulkMarketplace}
                  onChange={e => setBulkMarketplace(e.target.value)}
                  disabled={bulkLoading}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 bg-white disabled:opacity-50"
                >
                  {['amazon.com','amazon.co.uk','amazon.de','amazon.ca','amazon.com.au','amazon.fr','amazon.it','amazon.es','amazon.co.jp'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {bulkAsins.map((asin, i) => (
                  <input
                    key={i}
                    type="text"
                    value={asin}
                    onChange={e => setBulkAsins(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`ASIN ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                    disabled={bulkLoading}
                    maxLength={10}
                    className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors bg-neutral-50 disabled:opacity-50 font-mono tracking-wider"
                  />
                ))}
              </div>
              <button
                onClick={handleBulkAnalyze}
                disabled={bulkLoading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
              >
                {bulkLoading ? 'Queuing…' : `Analyze all →`}
              </button>
              {bulkJobs.length > 0 && (
                <div className="space-y-2 pt-1">
                  {bulkJobs.map(job => {
                    const isDone = ['completed','partial'].includes(job.status)
                    const isFailed = ['failed','amazon_not_logged_in'].includes(job.status)
                    const isPending = job.status === 'pending'
                    const isProcessing = job.status === 'processing'
                    return (
                      <div key={job.jobId} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        <p className="text-sm font-mono font-medium text-neutral-700">{job.asin}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isDone ? 'text-green-600' : isFailed ? 'text-red-500' : isProcessing ? 'text-orange-500' : 'text-neutral-400'}`}>
                            {isPending ? 'Queued' : isProcessing ? 'Scraping…' : isDone ? 'Done' : job.status === 'amazon_not_logged_in' ? 'Not logged in' : 'Error'}
                          </span>
                          {isDone && job.reportId && (
                            <a href={`/dashboard/report/${job.reportId}`} className="text-xs text-orange-500 font-semibold hover:underline">View report →</a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              {!loading && (
                <p className="text-[11px] text-neutral-400 mb-2">
                  Estimated time: <span className="font-medium text-neutral-500">2–4 minutes</span>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Paste Amazon URL or ASIN (e.g. B073JYC4XM)"
                  disabled={loading}
                  className="flex-1 px-4 py-3 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors bg-neutral-50 disabled:opacity-50"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="btn-press glow-orange px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 whitespace-nowrap shadow-sm"
                >
                  {loading ? '...' : 'Analyze →'}
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Spy Competitors ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowSpyPanel(p => !p)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <Crosshair size={15} className="text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">Spy Competitors</p>
              <p className="text-[11px] text-neutral-400">See exactly why a competitor outsells you</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-400 transition-transform ${showSpyPanel ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {showSpyPanel && (
          <div className="px-5 pb-5 pt-1 border-t border-neutral-100 space-y-3">
            {spyError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                <AlertTriangle size={13} />{spyError}
              </div>
            )}

            {userPlan === 'free' ? (
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-800">
                Competitor analysis is available on Growth and Pro plans.{' '}
                <a href="/#pricing" className="font-semibold underline">Upgrade →</a>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Competitor URL or ASIN</label>
                  <input
                    type="url"
                    value={spyUrl}
                    onChange={e => { setSpyUrl(e.target.value); setSpyError('') }}
                    placeholder="Paste competitor Amazon URL or ASIN"
                    disabled={spyLoading}
                    className="w-full px-4 py-3 text-sm border border-neutral-200 rounded-xl outline-none focus:border-purple-400 transition-colors bg-neutral-50 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Which of your products does this compete with?</label>
                  {ownReports.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">Analyze one of your own products first.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {ownReports.map(r => {
                        const used    = competitorCounts[r.id] ?? 0
                        const limit   = userPlan === 'pro' ? 10 : userPlan === 'growth' ? 3 : 1
                        const sel     = spyOwnReportId === r.id
                        const atLimit = used >= limit
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={spyLoading || atLimit}
                            onClick={() => { setSpyOwnReportId(r.id); setSpyError('') }}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors disabled:opacity-40 ${
                              sel ? 'border-purple-400 bg-purple-50' : 'border-neutral-200 hover:border-neutral-300 bg-white'
                            }`}
                          >
                            <p className="text-sm font-medium text-neutral-800 truncate">{r.product_name || 'Unnamed'}</p>
                            <span className={`text-xs flex-shrink-0 ${atLimit ? 'text-red-400' : 'text-neutral-400'}`}>{used}/{limit}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {ownReports.length > 0 && (
                  <button
                    onClick={handleSpyAnalyze}
                    disabled={spyLoading || !spyUrl.trim() || !spyOwnReportId}
                    className="w-full py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-40"
                  >
                    {spyLoading ? 'Analyzing competitor…' : 'Analyze competitor →'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Insights + Health Score ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-hidden">
        <div className="md:col-span-3 bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest truncate max-w-[180px] sm:max-w-xs">
              {latestReport ? `Latest: ${latestReport.product_name}` : 'What to expect'}
            </p>
            {latestReport && userPlan !== 'free' && (() => {
              const limit = userPlan === 'pro' ? 10 : userPlan === 'growth' ? 3 : 1
              const used  = userPlan === 'starter'
                ? Object.values(competitorCounts).reduce((a, b) => a + b, 0)
                : (competitorCounts[latestReport.id] ?? 0)
              const remaining = Math.max(0, limit - used)
              const isExhausted = remaining === 0
              return (
                <div className="relative group">
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full cursor-default select-none ${isExhausted ? 'bg-red-50 text-red-500' : 'bg-purple-50 text-purple-600'}`}>
                    {remaining}/{limit} spy slots
                  </span>
                  {isExhausted && (
                    <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-44 p-2 bg-neutral-800 text-white text-[10px] rounded-lg leading-snug">
                      Wait for next month to reset
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="space-y-2">
            {insightsToShow.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${showBlur && i > 0 ? 'blur-sm select-none' : ''}`}
                style={{ background: '#FAFAF9' }}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  {item.icon}
                </span>
                <p className="text-xs text-neutral-700 leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
          {latestReport && (
            <a href="/dashboard/history" className="mt-4 block text-xs text-orange-500 hover:text-orange-600 font-medium">
              View all past reports →
            </a>
          )}
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-4">Health Score</p>
          {latestReport ? (
            <>
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f5f5f4" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={latestReport.health_score > 65 ? '#22c55e' : latestReport.health_score > 37 ? '#f05a1e' : '#ef4444'}
                    strokeWidth="3" strokeDasharray={`${latestReport.health_score} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-neutral-800">{latestReport.health_score}</span>
                  <span className="text-[10px] text-neutral-400">/100</span>
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-3 max-w-[120px] leading-snug">{latestReport.product_name}</p>
            </>
          ) : (
            <>
              <div className="w-28 h-28 rounded-full border-4 border-dashed border-neutral-200 flex items-center justify-center">
                <Crosshair size={28} />
              </div>
              <p className="text-xs text-neutral-400 mt-3">Run an analysis to see your score</p>
            </>
          )}
        </div>
      </div>

      {/* ── Velocity + SC Scan cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Velocity card */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setVelocityExpanded(v => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-neutral-700">Review Velocity</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {velocityData.length > 0
                    ? `${[...new Set(velocityData.map((d: any) => d.asin))].length} product${[...new Set(velocityData.map((d: any) => d.asin))].length !== 1 ? 's' : ''} monitored`
                    : 'No watched products yet'}
                </p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-neutral-400 transition-transform flex-shrink-0 ${velocityExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {velocityExpanded && (
            <div className="px-4 pb-4 border-t border-neutral-100">
              {velocityData.length === 0 ? (
                <p className="text-xs text-neutral-400 mt-3 leading-relaxed">Add products to your watchlist via the extension to see daily review trends</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {[...new Set(velocityData.map((d: any) => d.asin))].map((asin: any) => {
                    const asinDays = velocityData
                      .filter((d: any) => d.asin === asin)
                      .slice(-14)
                    const maxVal = Math.max(...asinDays.map((d: any) => d.one_star || 0), 1)
                    return (
                      <div key={asin}>
                        <p className="text-[10px] font-semibold text-neutral-500 mb-2 font-mono">{asin}</p>
                        <div className="flex items-end gap-0.5 h-10">
                          {asinDays.map((d: any, i: number) => {
                            const h = Math.max(2, Math.round((d.one_star / maxVal) * 40))
                            const isSpike = d.one_star >= 5 || (i > 0 && asinDays[i-1] && d.one_star >= (asinDays[i-1].one_star || 0) * 2 + 2)
                            return (
                              <div key={d.date} className="flex flex-col items-center flex-1 group relative">
                                <div
                                  style={{ height: h }}
                                  className={`w-full rounded-sm ${isSpike ? 'bg-red-400' : 'bg-neutral-200'}`}
                                />
                                <span className="absolute bottom-full mb-1 text-[9px] bg-neutral-800 text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                  {d.date}: {d.one_star} ★
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-neutral-300">{asinDays[0]?.date?.slice(5)}</span>
                          <span className="text-[9px] text-neutral-300">{asinDays[asinDays.length - 1]?.date?.slice(5)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SC Scan card */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setScExpanded(v => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-neutral-700">Seller Central</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {scScanData.length > 0
                    ? `Last scan ${new Date(scScanData[0]?.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'No scans yet'}
                </p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-neutral-400 transition-transform flex-shrink-0 ${scExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {scExpanded && (
            <div className="px-4 pb-4 border-t border-neutral-100">
              {scScanData.length === 0 ? (
                <p className="text-xs text-neutral-400 mt-3 leading-relaxed">Visit your Seller Central pages with the extension installed to capture your account metrics</p>
              ) : (() => {
                const accountHealth = scScanData.find((s: any) => s.scan_type === 'account_health')
                const strandedInv   = scScanData.find((s: any) => s.scan_type === 'stranded_inventory')
                const h = accountHealth?.data || {}
                const metric = (label: string, val: any, threshold: number, unit = '%') => {
                  if (val == null) return null
                  const bad = val > threshold
                  return (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-neutral-50 last:border-0">
                      <span className="text-xs text-neutral-600">{label}</span>
                      <span className={`text-xs font-semibold ${bad ? 'text-red-600' : 'text-green-600'}`}>{val}{unit}</span>
                    </div>
                  )
                }
                return (
                  <div className="mt-3 space-y-0">
                    {metric('ODR', h.odr, 1)}
                    {metric('Late shipment', h.late_shipment_rate, 4)}
                    {metric('Cancellation rate', h.cancellation_rate, 2.5)}
                    {h.policy_violations != null && (
                      <div className="flex items-center justify-between py-1.5 border-b border-neutral-50">
                        <span className="text-xs text-neutral-600">Policy violations</span>
                        <span className={`text-xs font-semibold ${h.policy_violations > 0 ? 'text-red-600' : 'text-green-600'}`}>{h.policy_violations}</span>
                      </div>
                    )}
                    {strandedInv?.data?.stranded_units != null && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-neutral-600">Stranded units</span>
                        <span className={`text-xs font-semibold ${strandedInv.data.stranded_units > 0 ? 'text-orange-600' : 'text-green-600'}`}>{strandedInv.data.stranded_units}</span>
                      </div>
                    )}
                    {accountHealth && (
                      <p className="text-[10px] text-neutral-400 mt-2">Scanned {new Date(accountHealth.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Upgrade prompt for free users ── */}
      {userPlan === 'free' && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">Unlock the full picture</p>
              <p className="text-xs text-orange-100 leading-relaxed">Step-by-step fixes, SEO keywords, marketing copy, and unlimited analyses — all for less than a coffee a week.</p>
            </div>
            <a href="/#pricing" className="flex-shrink-0 px-4 py-2 bg-white text-orange-600 text-xs font-semibold rounded-xl hover:bg-orange-50 transition-colors whitespace-nowrap">
              See plans
            </a>
          </div>
        </div>
      )}

      {/* ── Footer links ── */}
      <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
        <p>© 2026 Voxrate</p>
        <div className="flex items-center gap-5">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Terms</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Privacy</a>
          <a href="mailto:info@voxrate.app" className="hover:text-black transition-colors">Contact</a>
        </div>
      </div>

    </div>
  )
}

export default function DashboardHome() {
  return (
    <Suspense fallback={null}>
      <DashboardHomeInner />
    </Suspense>
  )
}
