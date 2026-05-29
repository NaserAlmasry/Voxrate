export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supa = adminSupa()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: conversions } = await supa
    .from('ambassador_conversions')
    .select('id, ambassador_id, commission_amount, friend_bonus_amount')
    .eq('status', 'payable')
    .gte('paid_at', monthStart.toISOString())
    .lt('paid_at', monthEnd.toISOString())

  const totals: Record<string, number> = {}
  const ids: string[] = []
  for (const c of (conversions || []) as any[]) {
    totals[c.ambassador_id] = (totals[c.ambassador_id] || 0) + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0)
    ids.push(c.id)
  }

  for (const [ambassadorId, amount] of Object.entries(totals)) {
    await supa.from('ambassador_payouts').upsert({
      ambassador_id: ambassadorId,
      period,
      total_amount: Math.round(amount * 100) / 100,
      status: 'paid',
      paid_at: now.toISOString(),
    }, { onConflict: 'ambassador_id,period' })
  }

  if (ids.length) {
    await supa
      .from('ambassador_conversions')
      .update({ status: 'paid', paid_out_at: now.toISOString() })
      .in('id', ids)
  }

  return NextResponse.json({ success: true, period, paid_count: ids.length })
}
