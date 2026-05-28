export const dynamic = 'force-dynamic'

// ============================================================
// REFERRAL API — voxrate/app/api/referral/route.ts
// GET  → returns referral_code, referral_count, referral_link
// POST { action: 'claim' } → redeems the reward (free month)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: row } = await supabase
      .from('users')
      .select('referral_code, referral_count')
      .eq('id', user.id)
      .single()

    let code = row?.referral_code as string | null | undefined
    if (!code) {
      // Generate a short code. Retry once on the (very unlikely) collision.
      for (let attempt = 0; attempt < 3 && !code; attempt++) {
        const candidate = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)
        const { error } = await supabase.from('users').update({ referral_code: candidate }).eq('id', user.id)
        if (!error) { code = candidate; break }
      }
    }

    return NextResponse.json({
      referral_code: code ?? null,
      referral_count: row?.referral_count ?? 0,
      referral_link: code ? `${SITE_URL}/?ref=${code}` : null,
    })
  } catch (err: any) {
    console.error('[Referral GET] Error:', err?.message ?? err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const limit = await checkRateLimit(user.id, 'user')
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'claim') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    // Use the service-role client for the privileged update + insert below
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: row, error: fetchErr } = await admin
      .from('users')
      .select('referral_count')
      .eq('id', user.id)
      .single()
    if (fetchErr) {
      console.error('[Referral claim] fetch failed:', fetchErr.message)
      return NextResponse.json({ error: 'Could not load referral count' }, { status: 500 })
    }

    const count = row?.referral_count ?? 0
    if (count < 3) {
      return NextResponse.json({ error: 'Not enough referrals yet. You need at least 3 paid referrals to claim a reward.' }, { status: 400 })
    }

    const rewardPlan: 'starter' | 'growth' | 'pro' = count >= 15 ? 'pro' : count >= 5 ? 'growth' : 'starter'
    const periodEndUnix = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

    // Atomic update: only proceeds if referral_count is still >= 3, preventing double-claim
    const { error: updateErr, count: rowsUpdated } = await admin
      .from('users')
      .update({
        plan: rewardPlan,
        stripe_current_period_end: periodEndUnix,
        reward_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        referral_count: 0,
      })
      .eq('id', user.id)
      .gte('referral_count', 3)
      .select()
    if (updateErr) {
      console.error('[Referral claim] user update failed:', updateErr.message)
      return NextResponse.json({ error: 'Failed to apply reward' }, { status: 500 })
    }
    if (!rowsUpdated || (rowsUpdated as unknown as any[])?.length === 0) {
      return NextResponse.json({ error: 'Reward already claimed or referral count changed.' }, { status: 409 })
    }

    const { error: logErr } = await admin.from('referral_claims').insert({
      user_id: user.id,
      reward_plan: rewardPlan,
      referrals_used: count,
      period_end: new Date(periodEndUnix * 1000).toISOString(),
    })
    if (logErr) {
      // Non-fatal — reward already granted
      console.warn('[Referral claim] log insert failed:', logErr.message)
    }

    return NextResponse.json({
      ok: true,
      reward_plan: rewardPlan,
      period_end: periodEndUnix,
      message: `Reward applied — your plan has been upgraded to ${rewardPlan} for 1 month.`,
    })
  } catch (err: any) {
    console.error('[Referral POST] Error:', err?.message ?? err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
