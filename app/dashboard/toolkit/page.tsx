'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import {
  MessageSquare, AlertTriangle, Search, FileText, TrendingUp,
  Bell, Layers, ShoppingCart, BarChart2, RefreshCw,
  Zap, DollarSign, RotateCcw, Activity, Package,
  X, ChevronRight, Shield, Plus, Trash2, Copy, Check,
  ArrowRight, Lock,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  body: string
  asin: string | null
  data: Record<string, unknown> | null
  read: boolean
  created_at: string
}

interface MonitoredAsin {
  id: string
  asin: string
  marketplace: string
  product_name: string | null
  main_image: string | null
  is_own_product: boolean
  created_at: string
}

interface FeatureCard {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  status: 'active' | 'ready' | 'needs-sc'
  group: 'review' | 'listing' | 'sc'
}

// ─── Feature definitions ─────────────────────────────────────────

const FEATURES: FeatureCard[] = [
  {
    id: 'review-reply',
    icon: <MessageSquare size={20} />,
    title: 'Review Reply Generator',
    description: 'Paste any review and get 3 AI-crafted reply options in different tones.',
    status: 'active',
    group: 'review',
  },
  {
    id: 'attack-detector',
    icon: <AlertTriangle size={20} />,
    title: 'Review Attack Detector',
    description: 'Monitors your ASINs for sudden 1-star velocity spikes with daily chart.',
    status: 'active',
    group: 'review',
  },
  {
    id: 'fake-fingerprinter',
    icon: <Search size={20} />,
    title: 'Fake Review Fingerprinter',
    description: 'Analyzes an ASIN for suspicious patterns: unverified, new accounts, burst timing.',
    status: 'ready',
    group: 'review',
  },
  {
    id: 'evidence-builder',
    icon: <FileText size={20} />,
    title: 'Review Attack Evidence Builder',
    description: 'Packages attack evidence into a formatted report ready to submit to Amazon.',
    status: 'ready',
    group: 'review',
  },
  {
    id: 'sentiment-trend',
    icon: <TrendingUp size={20} />,
    title: 'Review Sentiment Trend',
    description: 'Charts sentiment score per month over time using your Voxrate analysis history.',
    status: 'active',
    group: 'review',
  },
  {
    id: 'listing-notifier',
    icon: <Bell size={20} />,
    title: 'Listing Change Notifier',
    description: 'Monitors title, bullets, price, and main image — alerts you when anything changes.',
    status: 'active',
    group: 'listing',
  },
  {
    id: 'competitor-overlay',
    icon: <Layers size={20} />,
    title: 'Competitor Sidebar Overlay',
    description: 'Toggle the Voxrate analysis panel on any Amazon product page in your browser.',
    status: 'active',
    group: 'listing',
  },
  {
    id: 'hijacker-alert',
    icon: <ShoppingCart size={20} />,
    title: 'Hijacker Alert',
    description: 'Monitors Buy Box on your watched ASINs. Alerts when a different seller takes it.',
    status: 'active',
    group: 'listing',
  },
  {
    id: 'variant-breakdown',
    icon: <BarChart2 size={20} />,
    title: 'Variant Performance Breakdown',
    description: 'Shows rating breakdown per variant (color/size) parsed from Amazon reviews.',
    status: 'ready',
    group: 'listing',
  },
  {
    id: 'variation-tracker',
    icon: <RefreshCw size={20} />,
    title: 'Review Variation Collapse Tracker',
    description: 'Monitors review count on variation families, alerts on drops greater than 10%.',
    status: 'ready',
    group: 'listing',
  },
  {
    id: 'reply-injector',
    icon: <Zap size={20} />,
    title: 'Review Reply Injector',
    description: 'Adds AI reply buttons inside your Seller Central reviews page.',
    status: 'needs-sc',
    group: 'sc',
  },
  {
    id: 'reimbursement-scanner',
    icon: <DollarSign size={20} />,
    title: 'FBA Reimbursement Scanner',
    description: 'Shows potential missed reimbursements from your SC inventory adjustment reports.',
    status: 'needs-sc',
    group: 'sc',
  },
  {
    id: 'return-analyzer',
    icon: <RotateCcw size={20} />,
    title: 'Return Reason Analyzer',
    description: 'Groups return reasons from your SC returns report into themes with AI.',
    status: 'needs-sc',
    group: 'sc',
  },
  {
    id: 'account-health',
    icon: <Activity size={20} />,
    title: 'Account Health Early Warning',
    description: 'Shows current account health metrics from SC with trend indicators.',
    status: 'needs-sc',
    group: 'sc',
  },
  {
    id: 'stranded-inventory',
    icon: <Package size={20} />,
    title: 'Stranded Inventory Alert',
    description: 'Shows stranded unit count and the daily storage cost accumulating.',
    status: 'needs-sc',
    group: 'sc',
  },
]

// ─── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeatureCard['status'] }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Active
    </span>
  )
  if (status === 'ready') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
      Ready
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">
      <Lock size={10} />
      Needs SC
      <SCTooltip />
    </span>
  )
}

// ─── Icon container colors ────────────────────────────────────────

function IconBox({ group, children }: { group: FeatureCard['group']; children: React.ReactNode }) {
  const cls = group === 'review'
    ? 'bg-orange-100 text-orange-600'
    : group === 'listing'
    ? 'bg-blue-100 text-blue-600'
    : 'bg-purple-100 text-purple-600'
  return <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}>{children}</div>
}

// ─── Drawer content components ────────────────────────────────────

function ReviewReplyDrawer({ asins }: { asins: MonitoredAsin[] }) {
  const [reviewText, setReviewText] = useState('')
  const [productName, setProductName] = useState('')
  const [loading, setLoading] = useState(false)
  const [replies, setReplies] = useState<Array<{ tone: string; text: string }>>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)

  const generate = async () => {
    if (!reviewText.trim()) return
    setLoading(true)
    setError('')
    setReplies([])
    try {
      const res = await fetch('/api/toolkit/review-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_text: reviewText, product_name: productName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReplies(data.replies)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copyReply = async (index: number, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Product name (optional)</label>
        <input
          value={productName}
          onChange={e => setProductName(e.target.value)}
          placeholder="e.g. Premium Silicone Spatula Set"
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Paste the customer review</label>
        <textarea
          value={reviewText}
          onChange={e => setReviewText(e.target.value)}
          rows={5}
          placeholder="Paste the full review text here..."
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>
      <button
        onClick={generate}
        disabled={loading || !reviewText.trim()}
        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Generating replies...' : 'Generate 3 Replies'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {replies.length > 0 && (
        <div className="space-y-3">
          {replies.map((reply, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{reply.tone}</span>
                <button
                  onClick={() => copyReply(i, reply.text)}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-orange-500 transition-colors"
                >
                  {copied === i ? <Check size={13} /> : <Copy size={13} />}
                  {copied === i ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{reply.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AttackDetectorDrawer({ asins, alerts }: { asins: MonitoredAsin[]; alerts: Alert[] }) {
  const attackAlerts = alerts.filter(a => a.type === 'review_attack')

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 text-sm text-orange-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>The Voxrate extension monitors your watched ASINs daily. An alert fires when 5+ one-star reviews appear in 24 hours, or when the count is 3x above your rolling daily average.</p>
      </div>
      {asins.length === 0 ? (
        <p className="text-sm text-neutral-500">No monitored ASINs yet. Add ASINs to your watchlist above.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Monitored ASINs ({asins.length})</p>
          {asins.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-neutral-500">
                {a.asin.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 truncate">{a.product_name || a.asin}</p>
                <p className="text-xs text-neutral-400">{a.asin} · {a.marketplace}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {attackAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Recent Alerts</p>
          {attackAlerts.slice(0, 5).map(alert => (
            <div key={alert.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">{alert.title}</p>
              <p className="text-xs text-red-600 mt-0.5">{alert.body}</p>
              <p className="text-xs text-red-400 mt-1">{new Date(alert.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
      {attackAlerts.length === 0 && asins.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">No attacks detected</p>
          <p className="text-xs text-green-600 mt-1">Your monitored ASINs look healthy</p>
        </div>
      )}
    </div>
  )
}

function FakeFingerprinterDrawer() {
  const [asin, setAsin] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>The extension scans reviews on the product page and scores each one for suspicious signals: unverified purchase, account age, burst timing, and competitor mentions.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">ASIN to analyze</label>
        <input
          value={asin}
          onChange={e => setAsin(e.target.value.toUpperCase())}
          placeholder="e.g. B08N5WRWNW"
          maxLength={10}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <button
        onClick={() => setSubmitted(true)}
        disabled={asin.length !== 10}
        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Analyze Reviews
      </button>
      {submitted && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-sm font-semibold text-orange-800">Extension scan requested</p>
          <p className="text-xs text-orange-600 mt-1">Open Amazon.com/dp/{asin} with the Voxrate extension active to run the fingerprint analysis.</p>
        </div>
      )}
    </div>
  )
}

function EvidenceBuilderDrawer({ asins, alerts }: { asins: MonitoredAsin[]; alerts: Alert[] }) {
  const [selectedAsin, setSelectedAsin] = useState('')
  const [report, setReport] = useState('')
  const [noAttacksMsg, setNoAttacksMsg] = useState(false)

  const generateReport = () => {
    const attackAlerts = alerts.filter(a => a.type === 'review_attack' && (!selectedAsin || a.asin === selectedAsin))
    if (attackAlerts.length === 0) { setNoAttacksMsg(true); setReport(''); return }
    setNoAttacksMsg(false)

    const lines = [
      'VOXRATE REVIEW ATTACK EVIDENCE REPORT',
      '======================================',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'SUMMARY',
      '-------',
      `Total incidents detected: ${attackAlerts.length}`,
      '',
      'INCIDENTS',
      '---------',
    ]
    attackAlerts.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.title}`)
      lines.push(`   Date: ${new Date(a.created_at).toLocaleString()}`)
      lines.push(`   ASIN: ${a.asin || 'N/A'}`)
      lines.push(`   Details: ${a.body}`)
      lines.push('')
    })
    lines.push('This report was automatically generated by Voxrate.')
    lines.push('Submit to Amazon Seller Support: sellercentral.amazon.com/help')
    setReport(lines.join('\n'))
  }

  return (
    <div className="space-y-4">
      {asins.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Filter by ASIN (optional)</label>
          <select
            value={selectedAsin}
            onChange={e => setSelectedAsin(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All ASINs</option>
            {asins.map(a => <option key={a.id} value={a.asin}>{a.asin}{a.product_name ? ` — ${a.product_name}` : ''}</option>)}
          </select>
        </div>
      )}
      <button
        onClick={generateReport}
        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
      >
        Build Evidence Report
      </button>
      {noAttacksMsg && (
        <p className="text-sm text-neutral-500 text-center py-2">No review attack alerts found{selectedAsin ? ` for ${selectedAsin}` : ''}. Alerts appear automatically when the extension detects a spike.</p>
      )}
      {report && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Report Preview</span>
            <button
              onClick={() => {
                const blob = new Blob([report], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `voxrate-evidence-${Date.now()}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="text-xs text-orange-500 hover:text-orange-700 font-medium"
            >
              Download .txt
            </button>
          </div>
          <pre className="w-full p-3 rounded-xl border border-neutral-200 text-xs text-neutral-700 bg-neutral-50 overflow-auto max-h-72 whitespace-pre-wrap font-mono">
            {report}
          </pre>
        </div>
      )}
    </div>
  )
}

function SentimentTrendDrawer() {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<Array<{ month: string; avg_score: number; count: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: reports } = await supabase
        .from('reports')
        .select('created_at, sentiment_score')
        .eq('user_id', user.id)
        .not('sentiment_score', 'is', null)
        .order('created_at', { ascending: true })
        .limit(200)

      if (!reports) { setLoading(false); return }

      const byMonth: Record<string, { sum: number; count: number }> = {}
      reports.forEach(r => {
        const month = r.created_at.slice(0, 7)
        if (!byMonth[month]) byMonth[month] = { sum: 0, count: 0 }
        byMonth[month].sum += r.sentiment_score
        byMonth[month].count++
      })
      const trend = Object.entries(byMonth).map(([month, v]) => ({
        month,
        avg_score: Math.round((v.sum / v.count) * 10) / 10,
        count: v.count,
      }))
      setData(trend)
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="text-center py-8 text-sm text-neutral-400">Loading sentiment history...</div>
  if (data.length === 0) return (
    <div className="rounded-xl border border-neutral-200 p-6 text-center">
      <p className="text-sm text-neutral-500">No analysis history yet. Analyze some products to see sentiment trends.</p>
    </div>
  )

  const maxScore = Math.max(...data.map(d => d.avg_score))
  const minScore = Math.min(...data.map(d => d.avg_score))
  const range = maxScore - minScore || 1

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="flex items-end gap-2 min-w-0 h-40 pb-2">
          {data.slice(-12).map((d) => {
            const height = ((d.avg_score - minScore) / range) * 100 + 10
            const color = d.avg_score >= 70 ? 'bg-green-400' : d.avg_score >= 50 ? 'bg-orange-400' : 'bg-red-400'
            return (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1 min-w-[28px]">
                <span className="text-xs font-semibold text-neutral-600">{d.avg_score}</span>
                <div className={`w-full rounded-t-md ${color} transition-all`} style={{ height: `${height}%` }} title={`${d.month}: ${d.avg_score} avg (${d.count} reports)`} />
                <span className="text-[9px] text-neutral-400 rotate-0">{d.month.slice(5)}/{d.month.slice(2, 4)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{data[data.length - 1]?.avg_score ?? '—'}</p>
          <p className="text-xs text-neutral-500">Latest month</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{Math.round(data.reduce((s, d) => s + d.avg_score, 0) / data.length)}</p>
          <p className="text-xs text-neutral-500">All-time avg</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{data.reduce((s, d) => s + d.count, 0)}</p>
          <p className="text-xs text-neutral-500">Total analyses</p>
        </div>
      </div>
    </div>
  )
}

function ListingNotifierDrawer({ asins, alerts }: { asins: MonitoredAsin[]; alerts: Alert[] }) {
  const listingAlerts = alerts.filter(a => a.type === 'listing_change')

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>The Voxrate extension captures a snapshot of each monitored ASIN when you visit the listing. Changes to title, bullets, price, main image, or Buy Box trigger an alert here.</p>
      </div>
      {asins.length === 0 ? (
        <p className="text-sm text-neutral-500">No monitored ASINs yet. Add ASINs using the watchlist above.</p>
      ) : (
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Monitored ASINs ({asins.length})</p>
          <div className="space-y-2">
            {asins.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-500">
                  {a.asin.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{a.product_name || a.asin}</p>
                  <p className="text-xs text-neutral-400">{a.asin}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {listingAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Recent Changes</p>
          {listingAlerts.slice(0, 5).map(a => (
            <div key={a.id} className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="text-sm font-semibold text-orange-800">{a.title}</p>
              <p className="text-xs text-orange-600 mt-0.5">{a.body}</p>
              <p className="text-xs text-orange-400 mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
      {listingAlerts.length === 0 && asins.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">No changes detected</p>
          <p className="text-xs text-green-600 mt-1">Your listings appear unchanged since last snapshot</p>
        </div>
      )}
    </div>
  )
}

function CompetitorOverlayDrawer() {
  const [overlayEnabled, setOverlayEnabled] = useState(false)

  useEffect(() => {
    try {
      setOverlayEnabled(localStorage.getItem('voxrate_overlay_enabled') === 'true')
    } catch {}
  }, [])

  const toggle = () => {
    const next = !overlayEnabled
    setOverlayEnabled(next)
    // Send to extension via voxrate-bridge.js which has access to chrome.storage.local
    window.postMessage({ type: 'VOXRATE_OVERLAY_TOGGLE', enabled: next }, '*')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>When enabled, visiting any Amazon product page will show a collapsible Voxrate panel on the right side with cached analysis data, review velocity, and alerts for that ASIN.</p>
      </div>
      <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200">
        <div>
          <p className="text-sm font-semibold text-neutral-800">Competitor Sidebar Overlay</p>
          <p className="text-xs text-neutral-500 mt-0.5">{overlayEnabled ? 'Enabled — active on Amazon product pages' : 'Disabled'}</p>
        </div>
        <button
          onClick={toggle}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${overlayEnabled ? 'bg-orange-500' : 'bg-neutral-300'}`}
          role="switch"
          aria-checked={overlayEnabled}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${overlayEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      <p className="text-xs text-neutral-400">This setting is stored in your browser and controls the extension's overlay behavior on all Amazon product pages.</p>
    </div>
  )
}

function HijackerAlertDrawer({ asins, alerts }: { asins: MonitoredAsin[]; alerts: Alert[] }) {
  const hijackAlerts = alerts.filter(a => a.type === 'listing_change' && a.body.toLowerCase().includes('buy box'))

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>Every time the extension visits one of your monitored ASINs, it checks the Buy Box seller. If it changes from the last known seller, you get an alert here.</p>
      </div>
      {hijackAlerts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Buy Box Alerts</p>
          {hijackAlerts.slice(0, 5).map(a => (
            <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">{a.title}</p>
              <p className="text-xs text-red-600 mt-0.5">{a.body}</p>
              <p className="text-xs text-red-400 mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">No hijacker alerts</p>
          <p className="text-xs text-green-600 mt-1">{asins.length === 0 ? 'Add ASINs to your watchlist to start monitoring' : 'Your Buy Box looks clean on monitored ASINs'}</p>
        </div>
      )}
    </div>
  )
}

function VariantBreakdownDrawer() {
  const [asin, setAsin] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>Paste a parent ASIN and the extension will parse the reviews page to extract per-variant (color, size, style) rating distributions.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Parent ASIN</label>
        <input
          value={asin}
          onChange={e => setAsin(e.target.value.toUpperCase())}
          placeholder="e.g. B08N5WRWNW"
          maxLength={10}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <button
        onClick={() => setSubmitted(true)}
        disabled={asin.length !== 10}
        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Analyze Variants
      </button>
      {submitted && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-sm font-semibold text-orange-800">Extension scan requested</p>
          <p className="text-xs text-orange-600 mt-1">Open amazon.com/dp/{asin} with the Voxrate extension active to analyze variant performance.</p>
        </div>
      )}
    </div>
  )
}

function VariationTrackerDrawer({ asins, alerts }: { asins: MonitoredAsin[]; alerts: Alert[] }) {
  const dropAlerts = alerts.filter(a => a.type === 'review_count_drop')
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works</p>
        <p>The extension tracks total review count on variation families over time. A drop of more than 10% triggers an alert — this can indicate Amazon removing reviews in bulk.</p>
      </div>
      {dropAlerts.length > 0 ? (
        <div className="space-y-2">
          {dropAlerts.map(a => (
            <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">{a.title}</p>
              <p className="text-xs text-red-600 mt-0.5">{a.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">No review drops detected</p>
          <p className="text-xs text-green-600 mt-1">{asins.length === 0 ? 'Add ASINs to your watchlist to start monitoring' : 'Variation review counts are stable'}</p>
        </div>
      )}
    </div>
  )
}

function SCLockedDrawer({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-purple-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
          <Lock size={20} className="text-purple-500" />
        </div>
        <p className="text-sm font-semibold text-neutral-800 mb-1">Seller Central Required</p>
        <p className="text-sm text-neutral-500 mb-4">{title} reads data directly from your Seller Central account via the Voxrate extension.</p>
        <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-left mb-4 space-y-2">
          <p className="text-xs font-semibold text-purple-700">How to activate in 2 steps:</p>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p className="text-xs text-purple-700">Install or update the Voxrate Chrome extension</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p className="text-xs text-purple-700">Visit <strong>sellercentral.amazon.com</strong> while logged in — the extension reads the page silently and syncs your data here</p>
          </div>
          <p className="text-xs text-purple-500 pt-1">No credentials are stored. The extension reads your SC page the same way you do, from your browser.</p>
        </div>
        <a
          href="/dashboard/settings/extension"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
        >
          Get the extension
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}

function SCTooltip() {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="ml-1 w-4 h-4 rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold flex items-center justify-center hover:bg-purple-200 hover:text-purple-700 transition-colors focus:outline-none"
        aria-label="What is Seller Central?"
        type="button"
      >?</button>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-10 rounded-xl bg-neutral-900 text-white text-xs p-3 shadow-xl pointer-events-none">
          <span className="font-semibold block mb-1">Needs Seller Central access</span>
          This feature reads data from your Amazon Seller Central account. Install the Voxrate extension, then visit sellercentral.amazon.com to activate it — no passwords shared.
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
        </span>
      )}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function ToolkitPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [asins, setAsins] = useState<MonitoredAsin[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeFeature, setActiveFeature] = useState<FeatureCard | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Add ASIN form
  const [addAsinValue, setAddAsinValue] = useState('')
  const [addAsinName, setAddAsinName] = useState('')
  const [addAsinLoading, setAddAsinLoading] = useState(false)
  const [addAsinError, setAddAsinError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [alertsRes, asinsRes] = await Promise.all([
        fetch('/api/toolkit/alerts'),
        fetch('/api/toolkit/asins'),
      ])
      if (alertsRes.ok) {
        const d = await alertsRes.json()
        setAlerts(d.alerts || [])
        setUnreadCount(d.unreadCount || 0)
      }
      if (asinsRes.ok) {
        const d = await asinsRes.json()
        setAsins(d.asins || [])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openFeature = (feature: FeatureCard) => {
    setActiveFeature(feature)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => setActiveFeature(null), 300)
  }

  const markAllRead = async () => {
    await fetch('/api/toolkit/alerts', { method: 'PATCH' })
    setUnreadCount(0)
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const addAsin = async () => {
    if (!addAsinValue.trim()) return
    setAddAsinLoading(true)
    setAddAsinError('')
    try {
      const res = await fetch('/api/toolkit/asins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin: addAsinValue.trim(), product_name: addAsinName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setAddAsinError(data.error || 'Failed'); return }
      setAsins(prev => [data.asin, ...prev])
      setAddAsinValue('')
      setAddAsinName('')
      setShowAddForm(false)
    } catch {
      setAddAsinError('Network error. Please try again.')
    } finally {
      setAddAsinLoading(false)
    }
  }

  const removeAsin = async (asin: string) => {
    const res = await fetch(`/api/toolkit/asins?asin=${asin}`, { method: 'DELETE' })
    if (res.ok) setAsins(prev => prev.filter(a => a.asin !== asin))
  }

  const renderDrawerContent = (feature: FeatureCard) => {
    if (feature.group === 'sc') return <SCLockedDrawer title={feature.title} />
    switch (feature.id) {
      case 'review-reply': return <ReviewReplyDrawer asins={asins} />
      case 'attack-detector': return <AttackDetectorDrawer asins={asins} alerts={alerts} />
      case 'fake-fingerprinter': return <FakeFingerprinterDrawer />
      case 'evidence-builder': return <EvidenceBuilderDrawer asins={asins} alerts={alerts} />
      case 'sentiment-trend': return <SentimentTrendDrawer />
      case 'listing-notifier': return <ListingNotifierDrawer asins={asins} alerts={alerts} />
      case 'competitor-overlay': return <CompetitorOverlayDrawer />
      case 'hijacker-alert': return <HijackerAlertDrawer asins={asins} alerts={alerts} />
      case 'variant-breakdown': return <VariantBreakdownDrawer />
      case 'variation-tracker': return <VariationTrackerDrawer asins={asins} alerts={alerts} />
      default: return <p className="text-sm text-neutral-500">Feature coming soon.</p>
    }
  }

  const groups = [
    { label: 'Review Intelligence', ids: FEATURES.filter(f => f.group === 'review').map(f => f.id) },
    { label: 'Listing Protection', ids: FEATURES.filter(f => f.group === 'listing').map(f => f.id) },
    { label: 'Seller Central', ids: FEATURES.filter(f => f.group === 'sc').map(f => f.id) },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900">Toolkit</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {unreadCount} alert{unreadCount !== 1 ? 's' : ''} · Mark all read
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} />
          Add ASIN to watchlist
        </button>
      </div>

      {/* Add ASIN form */}
      {showAddForm && (
        <div className="mb-6 p-4 rounded-2xl border border-neutral-200 bg-white">
          <p className="text-sm font-semibold text-neutral-800 mb-3">Add ASIN to Watchlist</p>
          <div className="flex gap-3 flex-wrap">
            <input
              value={addAsinValue}
              onChange={e => setAddAsinValue(e.target.value.toUpperCase())}
              placeholder="ASIN (e.g. B08N5WRWNW)"
              maxLength={10}
              className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              value={addAsinName}
              onChange={e => setAddAsinName(e.target.value)}
              placeholder="Product name (optional)"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={addAsin}
              disabled={addAsinLoading || addAsinValue.length !== 10}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addAsinLoading ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addAsinError && <p className="mt-2 text-xs text-red-500">{addAsinError}</p>}
          {asins.length > 0 && (
            <div className="mt-3 space-y-1">
              {asins.map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-50">
                  <span className="text-sm text-neutral-700 font-mono">{a.asin}</span>
                  {a.product_name && <span className="text-xs text-neutral-400 flex-1 ml-2 truncate">{a.product_name}</span>}
                  <button onClick={() => removeAsin(a.asin)} className="text-neutral-300 hover:text-red-500 transition-colors ml-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feature grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded w-1/2" />
                  <div className="h-3 bg-neutral-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">{group.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FEATURES.filter(f => group.ids.includes(f.id)).map(feature => {
                  const featureAlertCount = alerts.filter(a => !a.read && (
                    (feature.id === 'attack-detector' && a.type === 'review_attack') ||
                    (feature.id === 'listing-notifier' && a.type === 'listing_change' && !a.body.includes('Buy Box')) ||
                    (feature.id === 'hijacker-alert' && a.type === 'listing_change' && a.body.includes('Buy Box')) ||
                    (feature.id === 'account-health' && a.type === 'account_health') ||
                    (feature.id === 'stranded-inventory' && a.type === 'stranded_inventory')
                  )).length

                  return (
                    <button
                      key={feature.id}
                      onClick={() => openFeature(feature)}
                      className="group relative text-left rounded-2xl border border-neutral-200 bg-white p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {feature.group === 'sc' && (
                        <div className="absolute top-3 right-3">
                          <Lock size={13} className="text-neutral-300" />
                        </div>
                      )}
                      {featureAlertCount > 0 && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {featureAlertCount}
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <IconBox group={feature.group}>{feature.icon}</IconBox>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base text-neutral-900 mb-1">{feature.title}</p>
                          <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <StatusBadge status={feature.status} />
                        <ChevronRight size={16} className="text-neutral-300 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label={activeFeature?.title ?? 'Feature drawer'}
      >
        {activeFeature && (
          <>
            <div className="flex items-center gap-4 px-6 py-5 border-b border-neutral-200 flex-shrink-0">
              <IconBox group={activeFeature.group}>{activeFeature.icon}</IconBox>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base text-neutral-900">{activeFeature.title}</p>
                <StatusBadge status={activeFeature.status} />
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors flex-shrink-0"
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {renderDrawerContent(activeFeature)}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
