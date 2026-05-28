// Runs daily — expires free trials and referral reward plans that have passed their window

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Expire free trials
  const { data: trialCount, error: trialError } = await supabase.rpc('expire_free_trials')
  if (trialError) {
    console.error('[ExpireTrials] RPC failed:', trialError.message)
    return NextResponse.json({ error: trialError.message }, { status: 500 })
  }

  // Downgrade referral reward plans that have expired
  const now = new Date().toISOString()
  const { data: expiredRewards, error: rewardError } = await supabase
    .from('users')
    .update({
      plan:                          'free',
      own_analyses_remaining:        0,
      competitor_analyses_remaining: 0,
      reward_expires_at:             null,
    })
    .not('reward_expires_at', 'is', null)
    .lt('reward_expires_at', now)
    .is('stripe_subscription_id', null)
    .select('id')

  if (rewardError) {
    console.error('[ExpireTrials] Reward expiry failed:', rewardError.message)
  }

  const expiredRewardCount = expiredRewards?.length ?? 0
  console.log(`[ExpireTrials] Expired ${trialCount} trial(s), ${expiredRewardCount} reward(s)`)
  return NextResponse.json({ expiredTrials: trialCount, expiredRewards: expiredRewardCount })
}
