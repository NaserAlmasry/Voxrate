'use client'

// ============================================================
// DASHBOARD HOME — voxrate/app/dashboard/page.tsx
// ============================================================

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'

export const SIMULATE_USER_KEY = 'voxrate_simulate_user'

// ── SVG Icon Components ──────────────────────────────────────
function IconWarning({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function IconBulb({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  )
}
function IconTrending({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}
function IconTarget({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  )
}
function IconStrength({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
      <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
      <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
      <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
    </svg>
  )
}
function IconChart({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
function IconHeart({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

const PRODUCT_CATEGORIES = [
  { value: '', label: 'Select a category...' },
  { value: 'home_decor', label: 'Home Decor' },
  { value: 'jewelry', label: 'Jewelry & Accessories' },
  { value: 'clothing', label: 'Clothing & Apparel' },
  { value: 'art_prints', label: 'Art & Prints' },
  { value: 'handmade_crafts', label: 'Handmade Crafts' },
  { value: 'candles_bath', label: 'Candles & Bath' },
  { value: 'stationery', label: 'Stationery & Paper' },
  { value: 'toys_games', label: 'Toys & Games' },
  { value: 'food_drink', label: 'Food & Drink' },
  { value: 'other', label: 'Other' },
]

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
  const [latestReport, setLatestReport] = useState<any>(null)
  const [simulatingUser, setSimulatingUser] = useState(false)
  const [userPlan, setUserPlan] = useState('free')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [showSpyPanel, setShowSpyPanel] = useState(false)
  const [spyUrl, setSpyUrl] = useState('')
  const [spyOwnReportId, setSpyOwnReportId] = useState('')
  const [spyLoading, setSpyLoading] = useState(false)
  const [spyError, setSpyError] = useState('')
  const [ownReports, setOwnReports] = useState<{ id: string; product_name: string }[]>([])
  const [competitorCounts, setCompetitorCounts] = useState<Record<string, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Abort any in-flight request on unmount
  useEffect(() => () => { controllerRef.current?.abort() }, [])
  const [showCancelWarning, setShowCancelWarning] = useState(false)
  const [isCsv, setIsCsv] = useState(false)
  const cancelledRef = useRef(false)

  // ── Product info modal (CSV upload) ──────────────────────
  const [showProductModal, setShowProductModal] = useState(false)
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null)
  const [csvProductName, setCsvProductName] = useState('')
  const [csvCategory, setCsvCategory] = useState('')
  const [csvDescription, setCsvDescription] = useState('')
  const [csvPrice, setCsvPrice] = useState('')
  const [csvProductNameError, setCsvProductNameError] = useState('')
  const [csvCategoryError, setCsvCategoryError] = useState('')

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

  useEffect(() => {
    const saved = localStorage.getItem(SIMULATE_USER_KEY)
    if (saved === 'true') setSimulatingUser(true)

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
        setUserName(name)
      }
    })

    // Auto-analyze URL saved before auth (user pasted URL on landing page while logged out)
    const pendingUrl = localStorage.getItem('pendingUrl')
    if (pendingUrl) {
      localStorage.removeItem('pendingUrl')
      setUrl(pendingUrl)
      // Small delay so state settles before triggering
      const pendingTimer = setTimeout(() => {
        if (!pendingUrl.includes('amazon.com') && !/^[A-Z0-9]{10}$/i.test(pendingUrl.trim())) return
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

    const csvContent = localStorage.getItem('pendingCsvContent')
    const csvName    = localStorage.getItem('pendingCsvName')
    const csvProdName = localStorage.getItem('pendingCsvProductName')
    const csvProdCat  = localStorage.getItem('pendingCsvProductCategory')
    const csvProdPrice = localStorage.getItem('pendingCsvPrice')
    const csvProdDesc  = localStorage.getItem('pendingCsvProductDescription')

    if (csvContent && csvName) {
      localStorage.removeItem('pendingCsvContent')
      localStorage.removeItem('pendingCsvName')
      localStorage.removeItem('pendingCsvProductName')
      localStorage.removeItem('pendingCsvProductCategory')
      localStorage.removeItem('pendingCsvPrice')
      localStorage.removeItem('pendingCsvProductDescription')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const file = new File([blob], csvName, { type: 'text/csv' })

      if (csvProdName) {
        const runLandingCsv = async () => {
          cancelledRef.current = false
          setLoading(true); setIsCsv(true)
          const controller = new AbortController()
          controllerRef.current = controller
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('productName', csvProdName)
            if (csvProdCat) fd.append('productCategory', csvProdCat)
            if (csvProdPrice) fd.append('price', csvProdPrice)
            if (csvProdDesc) fd.append('productDescription', csvProdDesc)

            const res = await fetch('/api/analyze-csv', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' }, signal: controller.signal })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'CSV analysis failed.'); setLoading(false); setIsCsv(false); return }
            window.location.href = `/dashboard/report/${data.reportId}`
          } catch (err: any) {
            if (!cancelledRef.current && err?.name !== 'AbortError') { setError('Something went wrong. Please try again.') }
            setLoading(false); setIsCsv(false)
          }
        }
        runLandingCsv()
      }
    }
  }, [])

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) { setLoading(false); return }

        const { data: userData } = await supabase
          .from('users').select('analyses_count, plan, is_admin, credits').eq('id', user.id).single()

        if (userData) {
          setAnalysesCount(userData.analyses_count || 0)
          setCredits(userData.credits ?? 0)
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
    if (!url.includes('amazon.com') && !/^[A-Z0-9]{10}$/i.test(url.trim())) { setError('Please paste a valid Amazon URL or ASIN (e.g. B073JYC4XM)'); return }
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
    setIsCsv(false)
    setError('Analysis cancelled.')
  }

  const handleCsvFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file'); return }
    setError('')
    setCsvProductName(''); setCsvCategory(''); setCsvDescription(''); setCsvPrice('')
    setCsvProductNameError(''); setCsvCategoryError('')
    setPendingCsvFile(file)
    setShowProductModal(true)
  }

  const submitCsvAnalysis = async () => {
    let hasError = false
    if (!csvProductName.trim()) { setCsvProductNameError('Product name is required'); hasError = true }
    if (!csvCategory) { setCsvCategoryError('Please select a category'); hasError = true }
    if (hasError || !pendingCsvFile) return

    setShowProductModal(false); setLoading(true); setIsCsv(true)
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const fd = new FormData()
      fd.append('file', pendingCsvFile)
      fd.append('productName', csvProductName.trim())
      fd.append('productCategory', csvCategory)
      if (csvDescription.trim()) fd.append('productDescription', csvDescription.trim())
      if (csvPrice.trim()) fd.append('price', csvPrice.trim())
      const res = await fetch('/api/analyze-csv', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'XMLHttpRequest' }, signal: controller.signal })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Analysis failed.'); setLoading(false); setIsCsv(false); return }
      window.location.href = `/dashboard/report/${data.reportId}`
    } catch {
      setLoading(false); setIsCsv(false)
    }
  }

  const getLoadingMessage = (secs: number) => {
    if (isCsv) return secs < 10 ? 'Reading CSV...' : secs < 30 ? 'Analyzing your reviews...' : 'Building your report...'
    return secs < 20 ? 'Connecting to Amazon...' : secs < 60 ? 'Reading customer reviews...' : secs < 120 ? 'Finding patterns...' : 'Building your report...'
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60); const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const insightsToShow = latestReport ? [
    { icon: <IconTrending size={14} />, color: 'text-green-600 bg-green-50', text: `Health score: ${latestReport.health_score}/100` },
    { icon: <IconWarning size={14} />, color: 'text-red-500 bg-red-50', text: latestReport.top_complaint || 'No major complaints found' },
    { icon: <IconHeart size={14} />, color: 'text-orange-500 bg-orange-50', text: latestReport.top_strength || 'No strengths found' },
    { icon: <IconChart size={14} />, color: 'text-blue-500 bg-blue-50', text: `${latestReport.total_reviews_analyzed} reviews analyzed` },
  ] : [
    { icon: <IconWarning size={14} />, color: 'text-red-500 bg-red-50', text: 'Most products have 2–4 fixable complaints' },
    { icon: <IconBulb size={14} />, color: 'text-amber-500 bg-amber-50', text: 'Sellers who fix top complaints see faster growth' },
    { icon: <IconTrending size={14} />, color: 'text-green-600 bg-green-50', text: 'Better listing copy can double click-through rate' },
    { icon: <IconTarget size={14} />, color: 'text-blue-500 bg-blue-50', text: 'Paste your URL above to see real insights' },
  ]

  const showBlur = userPlan === 'free' && analysesCount === 0 && !simulatingUser

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="max-w-2xl mx-auto pb-20 space-y-5">

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
      {userPlan === 'free' && !simulatingUser && credits !== null && credits < 20 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-orange-800">
              <span className="font-semibold">You're out of free credits.</span> Get more to keep analyzing.
            </p>
          </div>
          <a href="/#pricing" className="flex-shrink-0 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-colors">
            Get credits →
          </a>
        </div>
      )}

      {/* ── Main Input ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">New analysis</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              <IconWarning size={13} />
              {error}
            </div>
          )}

          {cachedReport && !loading && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              You already analyzed <strong>{cachedReport.productName}</strong>.{' '}
              <a href={`/dashboard/report/${cachedReport.id}`} className="underline font-medium">View that report →</a>
            </div>
          )}

          {loading && !showCancelWarning && (
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

          {showCancelWarning && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs">
              <p className="font-medium text-red-700 mb-2">Cancel this analysis?</p>
              <div className="flex gap-2">
                <button onClick={confirmCancel} className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium">Yes, cancel</button>
                <button onClick={() => setShowCancelWarning(false)} className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-600">Keep going</button>
              </div>
            </div>
          )}

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
              className="px-5 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {loading ? '...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* CSV Drop Zone */}
        <div
          onClick={() => !loading && document.getElementById('csv-dash')?.click()}
          className={`mx-5 my-4 border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer select-none ${loading ? 'opacity-40 cursor-not-allowed' : 'border-neutral-200 hover:border-orange-300 hover:bg-orange-50/30'}`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-600">Drop CSV or <span className="text-orange-500">Browse</span></p>
              <p className="text-xs text-neutral-400 mt-0.5">Upload your Amazon reviews export — analysis in under 60 seconds</p>
            </div>
          </div>
          <input id="csv-dash" type="file" accept=".csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">Spy Competitors</p>
              <p className="text-[11px] text-neutral-400">See exactly why a competitor outsells you</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-neutral-400 transition-transform ${showSpyPanel ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showSpyPanel && (
          <div className="px-5 pb-5 pt-1 border-t border-neutral-100 space-y-3">
            {spyError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                <IconWarning size={13} />{spyError}
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
                    <select
                      value={spyOwnReportId}
                      onChange={e => { setSpyOwnReportId(e.target.value); setSpyError('') }}
                      disabled={spyLoading}
                      className="w-full px-4 py-3 text-sm border border-neutral-200 rounded-xl outline-none focus:border-purple-400 transition-colors bg-white disabled:opacity-50"
                    >
                      <option value="">Select your product…</option>
                      {ownReports.map(r => {
                        const used  = competitorCounts[r.id] ?? 0
                        const limit = userPlan === 'pro' ? 10 : userPlan === 'growth' ? 3 : 1
                        return (
                          <option key={r.id} value={r.id}>
                            {r.product_name} — {used}/{limit} this month
                          </option>
                        )
                      })}
                    </select>
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
      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
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
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={latestReport.health_score > 65 ? '#22c55e' : latestReport.health_score > 37 ? '#f97316' : '#ef4444'}
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
                <IconTarget size={28} />
              </div>
              <p className="text-xs text-neutral-400 mt-3">Run an analysis to see your score</p>
            </>
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

      {/* ── CSV Product Info Modal ── */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">Tell us about your product</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">More detail = a more accurate SEO score and better fixes</p>
                </div>
                <button onClick={() => setShowProductModal(false)} className="text-neutral-300 hover:text-black transition-colors ml-4 text-lg leading-none">✕</button>
              </div>
              {pendingCsvFile && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-100 text-xs text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {pendingCsvFile.name} · {Math.round(pendingCsvFile.size / 1024)}KB
                </div>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Product name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  Product name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={csvProductName}
                  onChange={e => { setCsvProductName(e.target.value); setCsvProductNameError('') }}
                  onKeyDown={e => e.key === 'Enter' && submitCsvAnalysis()}
                  placeholder="e.g. Handmade Ceramic Coffee Mug"
                  autoFocus
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors ${csvProductNameError ? 'border-red-300 bg-red-50' : 'border-neutral-200 focus:border-orange-400'}`}
                />
                {csvProductNameError && <p className="text-xs text-red-500 mt-1">{csvProductNameError}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  Product category <span className="text-red-500">*</span>
                </label>
                <select
                  value={csvCategory}
                  onChange={e => { setCsvCategory(e.target.value); setCsvCategoryError('') }}
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors bg-white ${csvCategoryError ? 'border-red-300 bg-red-50' : 'border-neutral-200 focus:border-orange-400'}`}
                >
                  {PRODUCT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {csvCategoryError && <p className="text-xs text-red-500 mt-1">{csvCategoryError}</p>}
                <p className="text-[10px] text-neutral-400 mt-1">Helps the AI benchmark against similar products and write accurate SEO suggestions</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  Product description <span className="text-neutral-400 font-normal">(optional — strongly improves SEO accuracy)</span>
                </label>
                <textarea
                  value={csvDescription}
                  onChange={e => setCsvDescription(e.target.value)}
                  placeholder="Briefly describe your product — materials, size, use case, what makes it special..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors resize-none"
                />
                {csvDescription.length > 900 && (
                  <p className="text-[10px] text-neutral-400 mt-0.5 text-right">{csvDescription.length}/1000</p>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  Listing price <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={csvPrice}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '' || /^\d{0,6}(\.\d{0,2})?$/.test(v)) setCsvPrice(v)
                    }}
                    placeholder="29.99"
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">Used to benchmark perceived value against competitors at the same price point</p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-2.5 text-sm border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors text-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={submitCsvAnalysis}
                className="flex-1 py-2.5 text-sm font-semibold bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Start analysis →
              </button>
            </div>
          </div>
        </div>
      )}
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
