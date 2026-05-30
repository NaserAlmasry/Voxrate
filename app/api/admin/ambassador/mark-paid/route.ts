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

  const body = await request.json()
  const { ambassadorId, adminNote } = body as { ambassadorId: string; adminNote?: string }

  if (!ambassadorId) {
    return NextResponse.json({ error: 'ambassadorId is required' }, { status: 400 })
  }

  // FIX 5: Sanitize adminNote
  const safeNote = adminNote ? String(adminNote).replace(/[<>"']/g, '').slice(0, 500) : null

  const supa = adminSupa()

  // Fetch ambassador and verify they have a pending request
  const { data: amb } = await supa
    .from('ambassadors')
    .select('id, name, payout_request_status')
    .eq('id', ambassadorId)
    .single()

  if (!amb) return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 })
  if (amb.payout_request_status !== 'requested') {
    return NextResponse.json({ error: 'No pending payment request for this ambassador' }, { status: 409 })
  }

  // Sum payable balance
  const { data: conversions } = await supa
    .from('ambassador_conversions')
    .select('id, commission_amount, friend_bonus_amount')
    .eq('ambassador_id', ambassadorId)
    .eq('status', 'payable')

  const list = (conversions || []) as any[]
  const amount = Math.round(
    list.reduce((s, c) => s + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0), 0) * 100
  ) / 100

  // FIX 4: Guard $0 payout edge case
  if (amount === 0) {
    await supa.from('ambassadors')
      .update({ payout_request_status: 'none', payout_requested_at: null, payout_admin_note: null })
      .eq('id', ambassadorId)
    return NextResponse.json({ success: true, amount: 0, note: 'No payable balance — request cleared.' })
  }

  // FIX 1: Replace three separate DB writes with a single atomic RPC call
  const now = new Date().toISOString()
  const { error: rpcErr } = await supa.rpc('mark_ambassador_paid', {
    p_ambassador_id: ambassadorId,
    p_amount: amount,
    p_admin_note: safeNote || null,
    p_paid_at: now,
  })
  if (rpcErr) {
    console.error('[MarkPaid] RPC failed:', rpcErr.message)
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 })
  }

  return NextResponse.json({ success: true, amount, ambassador_name: amb.name })
}
