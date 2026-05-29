export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { adminSupa } from '@/app/lib/ambassador-auth'
import {
  sendAmbassadorDay2,
  sendAmbassadorDay5,
  sendAmbassadorDay10,
  sendAmbassadorDay20,
} from '@/app/lib/emails/ambassador'

const DAYS = [2, 5, 10, 20]

export async function GET(request: NextRequest) {
  const authErr = verifyCronBearer(request)
  if (authErr) return authErr

  const supa = adminSupa()
  const { data: ambassadors } = await supa
    .from('ambassadors')
    .select('id, name, email, referral_code, created_at, last_email_day')
    .eq('status', 'active')

  let sent = 0
  const now = Date.now()

  for (const a of ambassadors || []) {
    const ageDays = Math.floor((now - new Date(a.created_at).getTime()) / (24 * 60 * 60 * 1000))
    const lastDay = a.last_email_day || 0
    const due = DAYS.filter(d => d <= ageDays && d > lastDay)
    if (due.length === 0) continue
    const day = due[0]

    try {
      if (day === 2) await sendAmbassadorDay2(a.email, a.name)
      else if (day === 5) await sendAmbassadorDay5(a.email, a.name, a.referral_code)
      else if (day === 10) await sendAmbassadorDay10(a.email, a.name)
      else if (day === 20) await sendAmbassadorDay20(a.email, a.name)
      await supa.from('ambassadors').update({ last_email_day: day }).eq('id', a.id)
      sent++
    } catch (e: any) {
      console.error('[ambassador cron] email failed', a.email, e?.message)
    }
  }

  return NextResponse.json({ sent })
}
