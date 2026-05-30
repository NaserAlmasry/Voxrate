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
    const ipHash = hash(ip)
    const today = new Date().toISOString().split('T')[0]

    // One click per IP per ambassador per day
    const { data: existingClick } = await supa
      .from('ambassador_clicks')
      .select('id')
      .eq('ambassador_id', amb.id)
      .eq('ip_hash', ipHash)
      .gte('created_at', `${today}T00:00:00Z`)
      .limit(1)
      .maybeSingle()

    if (!existingClick) {
      await supa.from('ambassador_clicks').insert({
        ambassador_id: amb.id,
        ip_hash: ipHash,
        user_agent_hash: hash(ua),
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
