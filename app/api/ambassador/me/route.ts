export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAmbassadorFromToken, adminSupa } from '@/app/lib/ambassador-auth'

export async function GET(request: NextRequest) {
  const amb = await getAmbassadorFromToken(request)
  if (!amb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supa = adminSupa()

  const [
    { count: clicksCount },
    { data: conversions },
    { data: payoutHistory },
  ] = await Promise.all([
    supa.from('ambassador_clicks').select('id', { count: 'exact', head: true }).eq('ambassador_id', amb.id),
    supa.from('ambassador_conversions').select('*').eq('ambassador_id', amb.id),
    supa.from('ambassador_payout_history').select('id, amount, paid_at, admin_note').eq('ambassador_id', amb.id).order('paid_at', { ascending: false }),
  ])

  const list = conversions || []
  const signupsCount = list.length
  const payingCustomers = list.filter(c => c.status === 'payable' || c.status === 'paid')
  const payableConversions = list.filter(c => c.status === 'payable')
  const payableBalance = Math.round(
    payableConversions.reduce((s, c) => s + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0), 0) * 100
  ) / 100

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthCommission = payingCustomers
    .filter(c => c.paid_at && new Date(c.paid_at) >= monthStart)
    .reduce((s, c) => s + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0), 0)

  const conversionRate = (clicksCount && clicksCount > 0)
    ? (payingCustomers.length / clicksCount) * 100
    : 0

  const last3Months: { period: string; total: number }[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = payingCustomers
      .filter(c => c.paid_at && new Date(c.paid_at) >= d && new Date(c.paid_at) < next)
      .reduce((s, c) => s + Number(c.commission_amount || 0) + Number(c.friend_bonus_amount || 0), 0)
    last3Months.push({ period, total })
  }

  const customers = payingCustomers.map(c => ({
    plan: c.plan || 'unknown',
    plan_price: Number(c.plan_price || 0),
    commission_amount: Number(c.commission_amount || 0),
  }))

  const msRemaining = new Date(amb.internship_end).getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
  const totalDays = Math.max(1, Math.ceil((new Date(amb.internship_end).getTime() - new Date(amb.internship_start).getTime()) / (24 * 60 * 60 * 1000)))
  const daysElapsed = Math.max(0, totalDays - daysRemaining)

  return NextResponse.json({
    ambassador: {
      id: amb.id,
      name: amb.name,
      email: amb.email,
      referralCode: amb.referral_code,
      commissionRate: Number(amb.commission_rate),
      status: amb.status,
      proAccess: amb.pro_access,
      internshipStart: amb.internship_start,
      internshipEnd: amb.internship_end,
      friendBonusActive: amb.friend_bonus_active,
      friendInvitedId: amb.friend_invited_id,
      payoutRequestStatus: amb.payout_request_status || 'none',
      payoutRequestedAt: amb.payout_requested_at || null,
    },
    payableBalance,
    payoutHistory: (payoutHistory || []).map((h: any) => ({
      id: h.id,
      amount: Number(h.amount),
      paid_at: h.paid_at,
      admin_note: h.admin_note,
    })),
    stats: {
      clicks: clicksCount || 0,
      signups: signupsCount,
      payingCustomers: payingCustomers.length,
      commissionThisMonth: Math.round(monthCommission * 100) / 100,
      conversionRate: Math.round(conversionRate * 10) / 10,
      daysRemaining,
      daysElapsed,
      totalDays,
    },
    customers,
    monthly: last3Months,
    milestones: {
      hasFirstClick: (clicksCount || 0) > 0,
      hasFirstSignup: signupsCount > 0,
      hasFirstCustomer: payingCustomers.length > 0,
      friendBonusActivated: !!amb.friend_bonus_active,
    },
  })
}
