export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { adminSupa } from '@/app/lib/ambassador-auth'
import { generateReferralCode } from '@/app/lib/ambassador-codes'
import { sendAmbassadorWelcome } from '@/app/lib/emails/ambassador'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = await checkRateLimit(ip, 'ip', 10)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({}))
    const code = String(body?.code || '').trim().toUpperCase()
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()

    if (!code || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const supa = adminSupa()

    const { data: codeRow } = await supa
      .from('ambassador_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (!codeRow) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    if (codeRow.type !== 'ambassador') return NextResponse.json({ error: 'Wrong code type' }, { status: 400 })
    if (codeRow.used) return NextResponse.json({ error: 'This code has already been used' }, { status: 400 })
    if (new Date(codeRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This code has expired' }, { status: 400 })
    }

    const { data: existing } = await supa
      .from('ambassadors')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'An ambassador with that email already exists' }, { status: 400 })

    let referralCode = ''
    for (let i = 0; i < 5; i++) {
      const candidate = generateReferralCode()
      const { data: clash } = await supa
        .from('ambassadors')
        .select('id')
        .eq('referral_code', candidate)
        .maybeSingle()
      if (!clash) { referralCode = candidate; break }
    }
    if (!referralCode) return NextResponse.json({ error: 'Could not allocate referral code' }, { status: 500 })

    const sessionToken = globalThis.crypto.randomUUID()
    const sessionExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data: amb, error: insertErr } = await supa
      .from('ambassadors')
      .insert({
        name,
        email,
        code_used: code,
        referral_code: referralCode,
        session_token: sessionToken,
        session_expires_at: sessionExpires,
      })
      .select()
      .single()

    if (insertErr || !amb) {
      console.error('[validate-code] insert failed', insertErr?.message)
      return NextResponse.json({ error: 'Failed to create ambassador' }, { status: 500 })
    }

    await supa.from('ambassador_codes').update({ used: true, used_by_ambassador_id: amb.id }).eq('id', codeRow.id)

    try { await sendAmbassadorWelcome(email, name, referralCode) } catch (e: any) {
      console.error('[validate-code] welcome email failed', e?.message)
    }

    const response = NextResponse.json({
      success: true,
      ambassador: {
        id: amb.id,
        name: amb.name,
        email: amb.email,
        referralCode: amb.referral_code,
        internshipEnd: amb.internship_end,
      },
    })
    response.cookies.set('ambassador_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 90, // 90 days
    })
    return response
  } catch (err: any) {
    console.error('[validate-code] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
