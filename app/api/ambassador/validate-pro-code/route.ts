export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = await checkRateLimit(ip, 'ip', 10)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({}))
    const code = String(body?.code || '').trim().toUpperCase()
    const email = String(body?.email || '').trim().toLowerCase()
    if (!code || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supa = adminSupa()
    const { data: codeRow } = await supa
      .from('ambassador_codes')
      .select('*')
      .eq('code', code)
      .single()

    if (!codeRow) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    if (codeRow.type !== 'pro_access') return NextResponse.json({ error: 'Wrong code type' }, { status: 400 })
    if (codeRow.used) return NextResponse.json({ error: 'This code has already been used' }, { status: 400 })
    if (new Date(codeRow.expires_at) < new Date()) return NextResponse.json({ error: 'This code has expired' }, { status: 400 })
    if (!codeRow.assigned_email || codeRow.assigned_email.toLowerCase() !== email) {
      return NextResponse.json({ error: 'This code is not assigned to that email' }, { status: 400 })
    }

    return NextResponse.json({ success: true, grantProAccess: true, email })
  } catch (err: any) {
    console.error('[validate-pro-code] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
