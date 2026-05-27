// Runs daily — expires free trials that have passed their 14-day window

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authHeader = request.headers.get('authorization') || ''
  const expected   = Buffer.from(`Bearer ${cronSecret}`)
  const actual     = Buffer.from(authHeader)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: count, error } = await supabase.rpc('expire_free_trials')
  if (error) {
    console.error('[ExpireTrials] RPC failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[ExpireTrials] Expired ${count} trial(s)`)
  return NextResponse.json({ expired: count })
}
