export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { adminSupa } from '@/app/lib/ambassador-auth'

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = await checkRateLimit(ip, 'ip', 30)
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({}))
    const referralCode = String(body?.referralCode || '').trim().toUpperCase()
    if (!referralCode) return NextResponse.json({ ok: true })

    const supa = adminSupa()
    const { data: amb } = await supa
      .from('ambassadors')
      .select('id, status')
      .eq('referral_code', referralCode)
      .maybeSingle()

    if (!amb || amb.status !== 'active') return NextResponse.json({ ok: true })

    const ua = request.headers.get('user-agent') || ''
    await supa.from('ambassador_clicks').insert({
      ambassador_id: amb.id,
      ip_hash: hash(ip),
      user_agent_hash: hash(ua),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
