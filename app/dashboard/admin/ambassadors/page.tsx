'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'

type Ambassador = {
  id: string
  name: string
  email: string
  referral_code: string
  status: string
  pro_access: boolean
  commission_rate: number
  internship_end: string
  notes: string | null
  clicks: number
  paying: number
  this_month: number
}

type CodeRow = {
  id: string
  code: string
  type: string
  assigned_name: string | null
  assigned_email: string | null
  used: boolean
  expires_at: string
  status: 'used' | 'expired' | 'unused'
  created_at: string
}

type PayoutRow = {
  ambassador_id: string
  name: string
  email: string
  paypal_email: string
  amount: number
}

export default function AdminAmbassadorsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([])
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [payout, setPayout] = useState<{ period: string; summary: PayoutRow[]; total: number } | null>(null)
  const [generated, setGenerated] = useState<{ codes: string[]; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadAll = useCallback(async () => {
    const h = { 'X-Requested-With': 'XMLHttpRequest' }
    const [a, c, p] = await Promise.all([
      fetch('/api/admin/ambassador/list', { headers: h }).then(r => r.json()),
      fetch('/api/admin/ambassador/codes', { headers: h }).then(r => r.json()),
      fetch('/api/admin/ambassador/payout-summary', { headers: h }).then(r => r.json()),
    ])
    setAmbassadors(a.ambassadors || [])
    setCodes(c.codes || [])
    setPayout(p)
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      if (!me?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)
      loadAll()
    })()
  }, [router, supabase, loadAll])

  async function generateCode(type: 'ambassador' | 'pro_access', count = 1) {
    const assignedName = window.prompt(`Assigned to (your reference label):`) || ''
    let assignedEmail: string | null = null
    if (type === 'pro_access') {
      assignedEmail = window.prompt('PRO codes are email-locked. Enter the email this code will work for:') || ''
      if (!assignedEmail) return
    }
    setBusy(true)
    const res = await fetch('/api/admin/ambassador/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ type, assignedName, assignedEmail, count }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { alert(json.error || 'Failed'); return }
    setGenerated({ codes: json.codes, expiresAt: json.expiresAt })
    loadAll()
  }

  async function bulkGenerateCsv() {
    setBusy(true)
    const res = await fetch('/api/admin/ambassador/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ type: 'ambassador', count: 10 }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { alert(json.error || 'Failed'); return }
    const csv = 'code,expires_at\n' + json.codes.map((c: string) => `${c},${json.expiresAt}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'amb-codes.csv'; a.click()
    URL.revokeObjectURL(url)
    loadAll()
  }

  async function ambassadorAction(id: string, action: string, extra?: any) {
    if (action === 'delete' && !confirm('Delete this ambassador and all their data?')) return
    setBusy(true)
    const res = await fetch('/api/admin/ambassador/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id, action, ...extra }),
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Failed'); return }
    loadAll()
  }

  async function exportPayoutCsv() {
    if (!payout) return
    const csv = 'name,email,paypal_email,amount\n' + payout.summary.map(r => `${r.name},${r.email},${r.paypal_email},${r.amount}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payout-${payout.period}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function markAllPaid() {
    if (!confirm('Mark current month as paid for all ambassadors?')) return
    setBusy(true)
    const res = await fetch('/api/admin/ambassador/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json(); alert(j.error || 'Failed'); return }
    loadAll()
  }

  if (!authorized) return null
  if (loading) return <div className="max-w-6xl mx-auto p-6 text-neutral-400">Loading...</div>

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ambassadors</h1>
        <a href="/dashboard/admin" className="text-xs text-neutral-500 hover:text-neutral-900">&larr; Admin</a>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Generate code</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => generateCode('ambassador')} disabled={busy} className="px-4 py-2 bg-[#f05a1e] text-white rounded-lg font-semibold text-sm disabled:opacity-50">Generate AMB code</button>
          <button onClick={() => generateCode('pro_access')} disabled={busy} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50">Generate PRO code</button>
          <button onClick={bulkGenerateCsv} disabled={busy} className="px-4 py-2 border border-neutral-300 rounded-lg font-semibold text-sm disabled:opacity-50">Generate 10 AMB codes (CSV)</button>
        </div>
        {generated && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-neutral-600 mb-2">New codes (expire {new Date(generated.expiresAt).toLocaleString()}):</p>
            {generated.codes.map(c => (
              <code key={c} className="block font-mono text-sm bg-white px-2 py-1 rounded my-1 select-all">{c}</code>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Recent codes</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase">
                <th className="text-left py-2">Code</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Assigned</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.slice(0, 20).map(c => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td className="py-2">{c.type}</td>
                  <td className="py-2">{c.assigned_name || c.assigned_email || '-'}</td>
                  <td className="py-2 text-xs text-neutral-500">{new Date(c.expires_at).toLocaleString()}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      c.status === 'used' ? 'bg-neutral-100 text-neutral-500' :
                      c.status === 'expired' ? 'bg-red-50 text-red-600' :
                      'bg-green-50 text-green-600'
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Ambassadors</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Email</th>
                <th className="text-right py-2">Clicks</th>
                <th className="text-right py-2">Paying</th>
                <th className="text-right py-2">This month</th>
                <th className="text-left py-2 pl-3">Status</th>
                <th className="text-left py-2">Pro</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ambassadors.map(a => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="py-2 font-semibold">{a.name}</td>
                  <td className="py-2 text-xs text-neutral-500">{a.email}</td>
                  <td className="py-2 text-right">{a.clicks}</td>
                  <td className="py-2 text-right">{a.paying}</td>
                  <td className="py-2 text-right font-bold text-[#f05a1e]">${a.this_month.toFixed(2)}</td>
                  <td className="py-2 pl-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      a.status === 'active' ? 'bg-green-50 text-green-600' :
                      a.status === 'paused' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>{a.status}</span>
                  </td>
                  <td className="py-2">{a.pro_access ? '✓' : '-'}</td>
                  <td className="py-2 text-xs space-x-2">
                    <button onClick={() => ambassadorAction(a.id, 'toggle-pro')} className="text-blue-600 hover:underline">Pro</button>
                    <button onClick={() => ambassadorAction(a.id, a.status === 'paused' ? 'unpause' : 'pause')} className="text-yellow-600 hover:underline">{a.status === 'paused' ? 'Unpause' : 'Pause'}</button>
                    <button onClick={() => {
                      const notes = window.prompt('Notes:', a.notes || '')
                      if (notes !== null) ambassadorAction(a.id, 'update-notes', { notes })
                    }} className="text-neutral-600 hover:underline">Notes</button>
                    <button onClick={() => ambassadorAction(a.id, 'delete')} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {ambassadors.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-neutral-400">No ambassadors yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Monthly payout summary {payout?.period}</p>
          <div className="flex gap-2">
            <button onClick={exportPayoutCsv} disabled={!payout || payout.summary.length === 0} className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold disabled:opacity-50">Export CSV</button>
            <button onClick={markAllPaid} disabled={busy || !payout || payout.summary.length === 0} className="px-3 py-1.5 bg-[#f05a1e] text-white rounded-lg text-xs font-semibold disabled:opacity-50">Mark all paid</button>
          </div>
        </div>
        {payout && payout.summary.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 uppercase">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">PayPal</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payout.summary.map(r => (
                  <tr key={r.ambassador_id} className="border-t border-neutral-100">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-xs text-neutral-500">{r.email}</td>
                    <td className="py-2 text-xs text-neutral-500">{r.paypal_email || '-'}</td>
                    <td className="py-2 text-right font-bold">${r.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-right text-sm mt-3 font-bold">Total: ${payout.total.toFixed(2)}</p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">No payable ambassadors this period (min $15).</p>
        )}
      </div>
    </div>
  )
}
