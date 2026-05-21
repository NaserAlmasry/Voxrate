'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'

type PlanKey = 'starter' | 'growth' | 'pro'

type RevenueData = {
  mrr: number
  newThisMonth: number
  churnedThisMonth: number
  byPlan: Record<PlanKey, { count: number; mrr: number }>
  totalActive: number
}

function StatCard({ label, value, sub, color = 'text-neutral-900' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const PLAN_STYLES: Record<PlanKey, { dot: string; pill: string }> = {
  starter: { dot: 'bg-blue-400',   pill: 'bg-blue-50 text-blue-600' },
  growth:  { dot: 'bg-green-400',  pill: 'bg-green-50 text-green-700' },
  pro:     { dot: 'bg-orange-400', pill: 'bg-orange-50 text-orange-600' },
}

export default function AdminRevenuePage() {
  const [loading, setLoading]         = useState(true)
  const [authorized, setAuthorized]   = useState(false)
  const [data, setData]               = useState<RevenueData | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const res = await fetch('/api/admin/revenue', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      if (!res.ok) {
        if (res.status === 403) { router.push('/dashboard'); return }
        setError(`Failed to load revenue (${res.status})`)
        setLoading(false)
        return
      }
      const json = (await res.json()) as RevenueData
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-40 bg-neutral-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-neutral-100 rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
    </div>
  )

  if (!authorized) return null

  if (error || !data) return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-sm text-red-500">{error ?? 'No data'}</p>
      </div>
    </div>
  )

  const plans: PlanKey[] = ['starter', 'growth', 'pro']
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Revenue dashboard</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Live Stripe data — visible to admins only</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/admin"
            className="px-3 py-1 bg-white border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-full hover:bg-neutral-50 transition-colors"
          >
            ← Admin
          </a>
          <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full border border-red-200">ADMIN</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="MRR"                value={fmtUSD(data.mrr)}     color="text-green-600" sub="recurring monthly" />
        <StatCard label="Active subscribers" value={data.totalActive}                              sub="all plans" />
        <StatCard label={`New in ${monthName}`}  value={data.newThisMonth} color="text-orange-500" sub="this calendar month" />
        <StatCard label={`Churned in ${monthName}`} value={data.churnedThisMonth} color="text-red-500" sub="cancelled this month" />
      </div>

      {/* Plan breakdown table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Plan breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Plan</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Subscribers</th>
                <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">MRR contribution</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase text-right">Share of MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {plans.map(p => {
                const row = data.byPlan[p]
                const share = data.mrr > 0 ? Math.round((row.mrr / data.mrr) * 100) : 0
                const styles = PLAN_STYLES[p]
                return (
                  <tr key={p} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${styles.pill}`}>{p}</span>
                    </td>
                    <td className="px-3 py-3 font-medium text-neutral-800">{row.count}</td>
                    <td className="px-3 py-3 text-neutral-600">{fmtUSD(row.mrr)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="w-32 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${styles.dot}`} style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-xs text-neutral-400 w-10 text-right">{share}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-neutral-50">
                <td className="px-5 py-3 text-[11px] font-semibold text-neutral-500 uppercase">Total</td>
                <td className="px-3 py-3 font-bold text-neutral-800">{data.totalActive}</td>
                <td className="px-3 py-3 font-bold text-green-600">{fmtUSD(data.mrr)}</td>
                <td className="px-5 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
