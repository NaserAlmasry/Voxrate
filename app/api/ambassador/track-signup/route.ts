export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = await checkRateLimit(ip, 'ip', 30)
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({}))
    const referralCode = String(body?.referralCode || '').trim().toUpperCase()
    const email = String(body?.email || '').trim().toLowerCase()
    if (!referralCode || !email) return NextResponse.json({ ok: true })

    const supa = adminSupa()

    const { data: existing } = await supa
      .from('ambassador_attribution')
      .select('id')
      .eq('subscriber_email', email)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true })

    const { data: amb } = await supa
      .from('ambassadors')
      .select('id, email, status')
      .eq('referral_code', referralCode)
      .maybeSingle()

    if (!amb || amb.status !== 'active') return NextResponse.json({ ok: true })
    if (amb.email.toLowerCase() === email) return NextResponse.json({ ok: true })

    await supa.from('ambassador_attribution').insert({
      subscriber_email: email,
      referral_code: referralCode,
      ambassador_id: amb.id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
