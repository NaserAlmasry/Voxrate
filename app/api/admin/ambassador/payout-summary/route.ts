export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supa = adminSupa()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: conversions } = await supa
    .from('ambassador_conversions')
    .select('ambassador_id, commission_amount, friend_bonus_amount, paid_at, status')
    .in('status', ['payable', 'paid'])
    .gte('paid_at', monthStart.toISOString())

  const totals: Record<string, number> = {}
  for (const c of (conversions || []) as any[]) {
    totals[c.ambassador_id] = (totals[c.ambassador_id] || 0) + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0)
  }

  const ids = Object.keys(totals)
  const { data: ambs } = ids.length
    ? await supa.from('ambassadors').select('id, name, email, paypal_email').in('id', ids)
    : { data: [] }

  const ambMap = new Map<string, any>()
  for (const a of (ambs || []) as any[]) ambMap.set(a.id, a)

  const summary = Object.entries(totals)
    .filter(([, amount]) => amount >= 15)
    .map(([id, amount]) => {
      const a = ambMap.get(id)
      return {
        ambassador_id: id,
        name: a?.name || 'Unknown',
        email: a?.email || '',
        paypal_email: a?.paypal_email || '',
        amount: Math.round(amount * 100) / 100,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  const total = summary.reduce((s, r) => s + r.amount, 0)

  return NextResponse.json({ period, summary, total: Math.round(total * 100) / 100 })
}
