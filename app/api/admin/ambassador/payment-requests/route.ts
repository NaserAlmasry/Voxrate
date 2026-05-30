export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supa = adminSupa()

  // Get ambassadors with a pending request
  const { data: ambs } = await supa
    .from('ambassadors')
    .select('id, name, email, payout_requested_at')
    .eq('payout_request_status', 'requested')

  if (!ambs || ambs.length === 0) {
    return NextResponse.json({ requests: [] })
  }

  const ids = ambs.map((a: any) => a.id)

  // Sum payable balance per ambassador
  const { data: conversions } = await supa
    .from('ambassador_conversions')
    .select('ambassador_id, commission_amount, friend_bonus_amount')
    .in('ambassador_id', ids)
    .eq('status', 'payable')

  const totals: Record<string, number> = {}
  for (const c of (conversions || []) as any[]) {
    totals[c.ambassador_id] = (totals[c.ambassador_id] || 0) + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0)
  }

  const requests = ambs.map((a: any) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    amount: Math.round((totals[a.id] || 0) * 100) / 100,
    requested_at: a.payout_requested_at,
  }))

  return NextResponse.json({ requests })
}
