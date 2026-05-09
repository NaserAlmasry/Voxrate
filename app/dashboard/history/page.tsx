'use client'

// ============================================================
// HISTORY PAGE — voxrate/app/dashboard/history/page.tsx
// ============================================================

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

const SIMULATE_USER_KEY = 'voxrate_simulate_user'

function scoreColor(n: number) {
  if (n <= 37) return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' }
  if (n <= 65) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' }
  return { text: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100' }
}

export default function HistoryPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userPlan, setUserPlan] = useState('free')
  const [simulatingUser, setSimulatingUser] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Safety timeout — stop loading after 8s if auth hangs
    const timeout = setTimeout(() => setLoading(false), 8000)

    const init = async () => {
      try {
        const saved = localStorage.getItem(SIMULATE_USER_KEY)
        if (saved === 'true') setSimulatingUser(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          clearTimeout(timeout)
          return
        }

        setUserEmail(user.email ?? '')

        const { data: userData } = await supabase
          .from('users').select('plan, is_admin').eq('id', user.id).single()
        if (userData?.plan) setUserPlan(userData.plan)

        const isAdmin = userData?.is_admin === true
        const isSimulating = saved === 'true'
        const isFreeUser = !isAdmin || isSimulating

        const { data: reportData, error } = await supabase
          .from('reports')
          .select('id, product_name, product_url, health_score, top_complaint, top_strength, total_reviews_analyzed, created_at, status')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[History] Supabase error:', error)
          setLoading(false)
          clearTimeout(timeout)
          return
        }

        if (!reportData || reportData.length === 0) {
          setReports([])
          setLoading(false)
          clearTimeout(timeout)
          return
        }

        // Free users: deduplicate by listing ID — show only latest per product
        if (isFreeUser && userData?.plan === 'free') {
          const seen = new Set<string>()
          const deduped = reportData.filter(r => {
            const match = r.product_url?.match(/listing\/(\d+)/)
            const key = match ? match[1] : r.product_url
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setReports(deduped)
        } else {
          setReports(reportData)
        }

      } catch (err) {
        console.error('[History] Unexpected error:', err)
      } finally {
        setLoading(false)
        clearTimeout(timeout)
      }
    }

    init()

    return () => clearTimeout(timeout)
  }, [])

  const effectiveAdmin = userPlan !== 'free' && !simulatingUser

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Report history</h1>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="h-4 bg-neutral-100 rounded w-48 mb-2" />
                  <div className="h-3 bg-neutral-100 rounded w-32" />
                </div>
                <div className="h-12 w-16 bg-neutral-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Report history</h1>
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <svg className="mx-auto mb-3 text-neutral-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="text-sm text-neutral-400 mb-1">No reports yet</p>
          <p className="text-xs text-neutral-300 mb-4">Run your first analysis to see it here</p>
          <a href="/dashboard" className="text-xs text-orange-600 font-medium hover:underline">
            Go analyze a product →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Report history</h1>
        <p className="text-xs text-neutral-400">{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {reports.map(report => {
          const sc = scoreColor(report.health_score || 0)
          const isCsv = report.product_url?.startsWith('csv:')
          const date = new Date(report.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })
          return (
            <div
              key={report.id}
              onClick={() => router.push(`/dashboard/report/${report.id}`)}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:border-neutral-300 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isCsv && (
                      <span className="text-[10px] font-medium bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">CSV</span>
                    )}
                    <h3 className="font-medium text-sm truncate">{report.product_name || 'Unnamed product'}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                    <span>{date}</span>
                    {report.total_reviews_analyzed > 0 && (
                      <>
                        <span>·</span>
                        <span>{report.total_reviews_analyzed} reviews</span>
                      </>
                    )}
                  </div>
                  {report.top_complaint && (
                    <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
                      <span className="text-red-400">·</span>
                      Top issue: {report.top_complaint}
                    </p>
                  )}
                  {report.top_strength && (
                    <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                      <span className="text-green-400">·</span>
                      Top strength: {report.top_strength}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`text-center px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                    <p className="text-xs text-neutral-400">Health</p>
                    <p className={`text-lg font-bold ${sc.text}`}>{report.health_score || '—'}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/report/${report.id}`) }}
                    className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors">
                    View →
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!effectiveAdmin && userPlan === 'free' && reports.length > 0 && (
        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl text-center">
          <p className="text-xs text-orange-700 font-medium mb-1">Free plan shows latest report per product</p>
          <p className="text-xs text-orange-600 mb-2">Upgrade to see full history of all analyses</p>
          <a href="/#pricing" className="inline-block px-4 py-1.5 bg-black text-white text-xs font-medium rounded-xl hover:bg-neutral-800 transition-colors">
            Upgrade →
          </a>
        </div>
      )}
    </div>
  )
}