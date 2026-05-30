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
    const now = new Date().toISOString()

    // Atomic update: set used=true only if currently used=false, not expired, correct type, and correct email
    const { data: claimedRows, error: claimError } = await supa
      .from('ambassador_codes')
      .update({ used: true })
      .eq('code', code)
      .eq('used', false)
      .eq('type', 'pro_access')
      .eq('assigned_email', user.email.toLowerCase())
      .gt('expires_at', now)
      .select('*')

    if (claimError) {
      console.error('[claim-pro] atomic update error:', claimError.message)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    const codeRow = claimedRows[0]

    const proExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const { error } = await supa
      .from('users')
      .update({ plan: 'pro', stripe_current_period_end: proExpiry })
      .eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: 'Failed to grant pro' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[claim-pro] error', err?.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
