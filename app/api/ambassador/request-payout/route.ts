export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAmbassadorFromToken, adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const amb = await getAmbassadorFromToken(request)
  if (!amb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check for already-pending request
  if (amb.payout_request_status === 'requested') {
    return NextResponse.json({ error: 'Payment already requested' }, { status: 409 })
  }

  const supa = adminSupa()

  // Calculate payable balance
  const { data: conversions } = await supa
    .from('ambassador_conversions')
    .select('commission_amount, friend_bonus_amount')
    .eq('ambassador_id', amb.id)
    .eq('status', 'payable')

  const balance = (conversions || []).reduce(
    (s: number, c: any) => s + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0),
    0
  )

  if (balance < 15) {
    return NextResponse.json({ error: 'Balance must be at least $15 to request payment' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await supa
    .from('ambassadors')
    .update({ payout_requested_at: now, payout_request_status: 'requested' })
    .eq('id', amb.id)

  if (error) return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })

  return NextResponse.json({ success: true, requested_at: now })
}
