export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/lib/admin-check'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supa = adminSupa()
  const { data: ambassadors } = await supa
    .from('ambassadors')
    .select('*')
    .order('created_at', { ascending: false })

  const list = ambassadors || []
  const ids = list.map(a => a.id)

  const [{ data: clickRows }, { data: conversionRows }] = await Promise.all([
    ids.length ? supa.from('ambassador_clicks').select('ambassador_id').in('ambassador_id', ids) : { data: [] },
    ids.length ? supa.from('ambassador_conversions').select('ambassador_id, status, commission_amount, friend_bonus_amount, paid_at').in('ambassador_id', ids) : { data: [] },
  ])

  const clicksByAmb: Record<string, number> = {}
  for (const c of (clickRows || []) as any[]) clicksByAmb[c.ambassador_id] = (clicksByAmb[c.ambassador_id] || 0) + 1

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const payingByAmb: Record<string, number> = {}
  const monthByAmb: Record<string, number> = {}
  for (const c of (conversionRows || []) as any[]) {
    if (c.status === 'payable' || c.status === 'paid') {
      payingByAmb[c.ambassador_id] = (payingByAmb[c.ambassador_id] || 0) + 1
      if (c.paid_at && new Date(c.paid_at) >= monthStart) {
        monthByAmb[c.ambassador_id] = (monthByAmb[c.ambassador_id] || 0) + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0)
      }
    }
  }

  const result = list.map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    referral_code: a.referral_code,
    status: a.status,
    pro_access: a.pro_access,
    commission_rate: Number(a.commission_rate),
    internship_end: a.internship_end,
    notes: a.notes,
    clicks: clicksByAmb[a.id] || 0,
    paying: payingByAmb[a.id] || 0,
    this_month: Math.round((monthByAmb[a.id] || 0) * 100) / 100,
    payout_request_status: a.payout_request_status || 'none',
  })).sort((a, b) => b.this_month - a.this_month)

  return NextResponse.json({ ambassadors: result })
}
