export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkCsrf } from '@/app/lib/csrf'
import { createClient } from '@/app/lib/supabase/server'
import { adminSupa } from '@/app/lib/ambassador-auth'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const code = String(body?.code || '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

    const supa = adminSupa()
    const { data: codeRow } = await supa
      .from('ambassador_codes')
      .select('*')
      .eq('code', code)
      .is('used', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!codeRow) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    if (codeRow.type !== 'pro_access') return NextResponse.json({ error: 'Wrong code type' }, { status: 400 })
    if (!codeRow.assigned_email || codeRow.assigned_email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Code not assigned to your email' }, { status: 400 })
    }

    const { error } = await supa
      .from('users')
      .update({ plan: 'pro' })
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: 'Failed to grant pro' }, { status: 500 })

    const { error: usedError } = await supa.from('ambassador_codes').update({ used: true }).eq('id', codeRow.id)
    if (usedError) {
      console.error('[claim-pro] failed to mark code used — MANUAL REVIEW NEEDED:', usedError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[claim-pro] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
