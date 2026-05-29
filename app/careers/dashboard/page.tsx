'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, LogOut, DollarSign, MousePointer2, Users, TrendingUp, Gift, Calendar } from 'lucide-react'

type MeData = {
  ambassador: {
    id: string
    name: string
    email: string
    referralCode: string
    commissionRate: number
    status: string
    proAccess: boolean
    internshipStart: string
    internshipEnd: string
    friendBonusActive: boolean
    friendInvitedId: string | null
  }
  stats: {
    clicks: number
    signups: number
    payingCustomers: number
    commissionThisMonth: number
    conversionRate: number
    daysRemaining: number
    daysElapsed: number
    totalDays: number
  }
  customers: { plan: string; plan_price: number; commission_amount: number }[]
  monthly: { period: string; total: number }[]
  milestones: {
    hasFirstClick: boolean
    hasFirstSignup: boolean
    hasFirstCustomer: boolean
    friendBonusActivated: boolean
  }
}

const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://voxrate.app'

export default function AmbassadorDashboard() {
  const router = useRouter()
  const [data, setData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [friendCode, setFriendCode] = useState('')
  const [friendMsg, setFriendMsg] = useState('')

  const load = useCallback(async () => {
    const token = localStorage.getItem('voxrate_amb_token')
    if (!token) { router.push('/careers'); return }
    const res = await fetch('/api/ambassador/me', { headers: { 'x-ambassador-token': token } })
    if (res.status === 401) {
      localStorage.removeItem('voxrate_amb_token')
      router.push('/careers')
      return
    }
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  function logout() {
    localStorage.removeItem('voxrate_amb_token')
    router.push('/careers')
  }

  function copyLink() {
    if (!data) return
    const link = `${SITE}/?ref=${data.ambassador.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submitFriend(e: React.FormEvent) {
    e.preventDefault()
    setFriendMsg('')
    const token = localStorage.getItem('voxrate_amb_token')
    if (!token) return
    const res = await fetch('/api/ambassador/invite-friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'x-ambassador-token': token },
      body: JSON.stringify({ friendCode }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) { setFriendMsg(json.error || 'Failed'); return }
    setFriendMsg('Friend linked!')
    setFriendCode('')
    load()
  }

  if (loading || !data) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>Loading...</div>
  }

  const { ambassador, stats, customers, monthly, milestones } = data
  const link = `${SITE}/?ref=${ambassador.referralCode}`
  const maxMonth = Math.max(1, ...monthly.map(m => m.total))
  const progressPct = Math.min(100, Math.round((stats.daysElapsed / stats.totalDays) * 100))

  const nextStep =
    stats.clicks === 0
      ? 'Share your link in r/FulfillmentByAmazon, Amazon FBA Facebook groups, and LinkedIn. Search "Amazon seller" and connect.'
      : stats.payingCustomers === 0
        ? 'People are visiting! Try targeting Amazon sellers who already have products — they need analysis the most.'
        : 'Great work! Keep going — your commission compounds each month they stay subscribed.'

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="border-b border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold tracking-tight">Voxrate</Link>
          <span className="text-xs uppercase tracking-widest text-[#f05a1e] font-semibold">Ambassadors</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:inline">{ambassador.name}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-fadeIn">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: DollarSign, label: 'Commission this month', value: `$${stats.commissionThisMonth.toFixed(2)}` },
            { icon: MousePointer2, label: 'Link clicks', value: stats.clicks },
            { icon: Users, label: 'Paying customers', value: stats.payingCustomers },
            { icon: TrendingUp, label: 'Conversion rate', value: `${stats.conversionRate.toFixed(1)}%` },
          ].map((s, i) => (
            <div key={i} className="card-lift bg-white rounded-2xl border border-gray-100 p-5">
              <s.icon className="w-5 h-5 text-[#f05a1e] mb-2" />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Your referral link</div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 font-mono text-sm break-all">{link}</div>
            <button onClick={copyLink} className="px-5 py-3 rounded-xl bg-[#f05a1e] text-white font-bold flex items-center gap-2 justify-center hover:opacity-90 transition">
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">90-day cookie &middot; First-click attribution</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">Milestones</div>
          <div className="flex flex-wrap gap-3">
            {[
              { done: milestones.hasFirstClick, label: 'First click' },
              { done: milestones.hasFirstSignup, label: 'First signup' },
              { done: milestones.hasFirstCustomer, label: 'First paying customer' },
              { done: milestones.friendBonusActivated, label: 'Friend bonus activated' },
            ].map((m, i) => (
              <div key={i} className={`px-4 py-2 rounded-full text-sm font-semibold ${m.done ? 'bg-[#f05a1e] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {m.done ? '🎉 ' : ''}{m.label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">Monthly earnings</div>
            <div className="flex items-end gap-4 h-40">
              {monthly.map(m => {
                const h = Math.max(4, Math.round((m.total / maxMonth) * 140))
                return (
                  <div key={m.period} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs font-bold">${m.total.toFixed(0)}</div>
                    <div className="w-full bg-[#f05a1e] rounded-t-lg" style={{ height: `${h}px` }} />
                    <div className="text-xs text-gray-500">{m.period}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-4">Customers</div>
            {customers.length === 0 ? (
              <p className="text-sm text-gray-400">No paying customers yet. Your first sale is coming.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left py-2">Plan</th>
                    <th className="text-right py-2">Monthly</th>
                    <th className="text-right py-2">Your cut</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 font-semibold capitalize">{c.plan}</td>
                      <td className="py-2 text-right text-gray-600">${c.plan_price.toFixed(2)}</td>
                      <td className="py-2 text-right text-[#f05a1e] font-bold">${c.commission_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-[#f05a1e]" />
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Friend bonus</div>
          </div>
          {ambassador.friendBonusActive ? (
            <p className="text-sm text-gray-700">🎉 Bonus active! You&apos;re earning $2 extra on every sale.</p>
          ) : ambassador.friendInvitedId ? (
            <p className="text-sm text-gray-700">Friend joined — waiting for their first sale to activate your $2 bonus.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Your friend must apply using an ambassador code you got from Voxrate. Once they bring their first paying customer, you&apos;ll earn $2 extra on every sale you make.
              </p>
              <form onSubmit={submitFriend} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Friend's AMB code (the one they used to join)"
                  value={friendCode}
                  onChange={e => setFriendCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#f05a1e] focus:outline-none font-mono text-sm"
                />
                <button type="submit" className="px-5 py-3 rounded-xl bg-[#f05a1e] text-white font-bold hover:opacity-90 transition">
                  Link friend
                </button>
              </form>
              {friendMsg && <p className="text-sm mt-3 text-gray-600">{friendMsg}</p>}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-[#f05a1e]" />
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Internship progress</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
            <div className="bg-[#f05a1e] h-3 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-sm text-gray-600">{stats.daysRemaining} days remaining in your internship</p>
          <p className="text-xs text-gray-400 mt-1">Renewals are available for top performers.</p>
        </div>

        <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-2xl border border-orange-100 p-6">
          <div className="text-xs uppercase tracking-widest text-[#f05a1e] font-semibold mb-2">What to do next</div>
          <p className="text-sm text-gray-700">{nextStep}</p>
        </div>
      </div>
    </main>
  )
}
