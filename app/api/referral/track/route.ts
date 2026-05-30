export const dynamic = 'force-dynamic'

// ============================================================
// REFERRAL TRACK — voxrate/app/api/referral/track/route.ts
// Called from the dashboard on first load if the user was referred.
// Body: { referral_code: string }
// Links the signed-in user to the referrer in the referrals table.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const referralCode = typeof body?.referral_code === 'string' ? body.referral_code.trim() : ''
    if (!referralCode || !/^[a-zA-Z0-9]{4,32}$/.test(referralCode)) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Look up the referrer
    const { data: referrer } = await admin
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle()

    if (!referrer) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
    }

    // Don't allow self-referral
    if (referrer.id === user.id) {
      return NextResponse.json({ ok: true, skipped: 'self-referral' })
    }

    const { data: reverseReferral } = await admin
      .from('referrals')
      .select('id')
      .eq('referrer_id', user.id)
      .eq('referred_user_id', referrer.id)
      .maybeSingle()
    if (reverseReferral) {
      return NextResponse.json({ ok: true, skipped: 'referral-loop' })
    }

    // Idempotent insert — referred_user_id is unique, so duplicates fail cleanly
    const { error: insertErr } = await admin.from('referrals').insert({
      referrer_id: referrer.id,
      referred_user_id: user.id,
      converted: false,
    })

    if (insertErr && insertErr.code !== '23505') {
      console.error('[Referral track] insert failed:', insertErr.message)
      return NextResponse.json({ error: 'Failed to record referral' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Referral track] Error:', err?.message ?? err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
