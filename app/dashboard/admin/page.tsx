'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'

function StatCard({ label, value, sub, color = 'text-neutral-900' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}

function Badge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    free:    'bg-neutral-100 text-neutral-500',
    trial:   'bg-orange-50 text-orange-500',
    starter: 'bg-blue-50 text-blue-600',
    growth:  'bg-teal-50 text-teal-600',
    pro:     'bg-orange-50 text-orange-600',
    agency:  'bg-purple-50 text-purple-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[plan] || styles.free}`}>
      {plan}
    </span>
  )
}

export default function AdminPage() {
  const [loading, setLoading]     = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats]         = useState<any>(null)
  const [users, setUsers]         = useState<any[]>([])
  const [ratings, setRatings]     = useState<any[]>([])
  const [tab, setTab]             = useState<'overview' | 'users' | 'ratings'>('overview')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      // Parallel data fetch
      // Use server-side API to bypass RLS — client queries only return own data
      const res = await fetch('/api/admin/stats', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      if (!res.ok) { router.push('/dashboard'); return }
      const json = await res.json()
      const { users: usersData, ratings: ratingsData, totalReports, totalUsers, paidUsers } = json

      const ratingsList = ratingsData || []
      const avgRating   = ratingsList.length
        ? (ratingsList.reduce((s: number, r: any) => s + r.rating, 0) / ratingsList.length).toFixed(1)
        : '—'

      const planCounts = (usersData || []).reduce((acc: any, u: any) => {
        acc[u.plan] = (acc[u.plan] || 0) + 1
        return acc
      }, {})

      setStats({
        totalUsers:   totalUsers  || 0,
        paidUsers:    paidUsers   || 0,
        totalReports: totalReports || 0,
        avgRating,
        totalRatings: ratingsList.length,
        planCounts,
      })
      setUsers(usersData || [])
      setRatings(ratingsList)
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

  const conversionRate = stats.totalUsers > 0
    ? ((stats.paidUsers / stats.totalUsers) * 100).toFixed(1)
    : '0'

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin dashboard</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Internal view — visible to admins only</p>
        </div>
        <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full border border-red-200">ADMIN</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users"       value={stats.totalUsers}   sub={`${conversionRate}% conversion`} />
        <StatCard label="Paid users"        value={stats.paidUsers}    color="text-orange-500" sub={`${stats.totalUsers - stats.paidUsers} on free`} />
        <StatCard label="Total reports run" value={stats.totalReports} sub="all time" />
        <StatCard label="Avg rating"        value={stats.avgRating}    color="text-green-600" sub={`from ${stats.totalRatings} ratings`} />
      </div>

      {/* Plan breakdown */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Plan breakdown</p>
        <div className="flex items-end gap-4 flex-wrap">
          {['free', 'starter', 'pro', 'agency'].map(plan => {
            const count = stats.planCounts[plan] || 0
            const pct   = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0
            return (
              <div key={plan} className="flex-1 min-w-[80px]">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-neutral-500 capitalize">{plan}</span>
                  <span className="text-xs font-bold text-neutral-800">{count}</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${plan === 'free' ? 'bg-neutral-300' : plan === 'starter' ? 'bg-blue-400' : plan === 'pro' ? 'bg-orange-400' : 'bg-purple-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-0.5">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        {(['overview', 'users', 'ratings'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {t === 'overview' ? 'Recent activity' : t}
          </button>
        ))}
      </div>
      <a
        href="/dashboard/admin/blog"
        className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Manage blog
      </a>
      </div>

      {/* Tab: Recent activity */}
      {tab === 'overview' && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Latest signups</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {users.slice(0, 10).map(u => {
              const date = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{u.email || '—'}</p>
                    <p className="text-xs text-neutral-400">{date} · {u.analyses_count ?? 0} analyses</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge plan={u.plan || 'free'} />
                    <span className="text-xs text-neutral-400">{u.credits ?? 0} credits</span>
                  </div>
                </div>
              )
            })}
            {users.length === 0 && (
              <p className="px-5 py-8 text-sm text-neutral-400 text-center">No users yet</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Users */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">All users ({users.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Email</th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Plan</th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Analyses</th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Credits</th>
                  <th className="px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-neutral-800 max-w-[220px] truncate">
                      {u.email || '—'}
                      {u.is_admin && <span className="ml-2 text-[10px] text-red-500 font-bold">ADMIN</span>}
                    </td>
                    <td className="px-3 py-3"><Badge plan={u.plan || 'free'} /></td>
                    <td className="px-3 py-3 text-neutral-600">{u.analyses_count ?? 0}</td>
                    <td className="px-3 py-3 text-neutral-600">{u.credits ?? 0}</td>
                    <td className="px-3 py-3 text-neutral-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-sm text-neutral-400 text-center">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Ratings */}
      {tab === 'ratings' && (
        <div className="space-y-3">
          {/* Rating distribution */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">Rating distribution</p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratings.filter(r => r.rating === star).length
                const pct   = ratings.length > 0 ? Math.round((count / ratings.length) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-8 text-right">{star} ★</span>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-neutral-400 w-8">{count}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-neutral-400 mt-3">{ratings.length} total ratings · avg {stats.avgRating} ★</p>
          </div>

          {/* Feedback with text */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                Written feedback ({ratings.filter(r => r.feedback).length})
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {ratings.filter(r => r.feedback).map(r => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span className="text-[11px] text-neutral-400">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed">"{r.feedback}"</p>
                </div>
              ))}
              {ratings.filter(r => r.feedback).length === 0 && (
                <p className="px-5 py-8 text-sm text-neutral-400 text-center">No written feedback yet</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
