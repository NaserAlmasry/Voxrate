// Sentiment Alerts API — Growth+ and Pro plans only.
// Credits are NOT deducted here; they are charged when the cron worker runs.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'

type Frequency = 'weekly' | 'biweekly' | 'triweekly' | 'monthly'

export const FREQUENCY_DAYS: Record<Frequency, number> = {
  weekly:    7,
  biweekly:  14,
  triweekly: 21,
  monthly:   30,
}

export const FREQUENCY_CREDITS: Record<Frequency, number> = {
  weekly:    5,
  biweekly:  10,
  triweekly: 12,
  monthly:   15,
}

const VALID_FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'triweekly', 'monthly']

function computeNextRun(freq: Frequency, from = new Date()): string {
  const ms = FREQUENCY_DAYS[freq] * 86_400_000
  return new Date(from.getTime() + ms).toISOString()
}

// GET — list current user's alerts
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sentiment_alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 })
  return NextResponse.json({ alerts: data || [] })
}

// POST — create alert  { asin, product_name, marketplace, frequency }
export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(user.id, 'user')
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const plan    = userData?.plan || 'free'
  const isAdmin = userData?.is_admin === true

  if (!isAdmin && plan !== 'growth' && plan !== 'pro') {
    return NextResponse.json(
      { error: 'Sentiment alerts are available on Growth and Pro plans.', upgradeRequired: true, upgradePrompt: 'growth' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const asin         = String(body?.asin || '').trim().toUpperCase()
  const product_name = body?.product_name ? String(body.product_name).slice(0, 200) : null
  const marketplace  = body?.marketplace ? String(body.marketplace).slice(0, 32) : 'amazon.com'
  const frequency    = String(body?.frequency || '') as Frequency

  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ error: 'Valid 10-character ASIN required.' }, { status: 400 })
  }
  if (!VALID_FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ error: 'Invalid frequency.' }, { status: 400 })
  }

  // Prevent duplicate alert for same ASIN+marketplace
  const { data: existing } = await supabase
    .from('sentiment_alerts')
    .select('id')
    .eq('user_id', user.id)
    .eq('asin', asin)
    .eq('marketplace', marketplace)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have an alert for this product.' }, { status: 409 })
  }

  const now = new Date()
  const { data: created, error } = await supabase
    .from('sentiment_alerts')
    .insert({
      user_id:      user.id,
      asin,
      product_name,
      marketplace,
      frequency,
      active:       false,
      next_run_at:  null,
    })
    .select()
    .single()

  if (error) {
    console.error('[SentimentAlerts] insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to create alert.' }, { status: 500 })
  }

  return NextResponse.json({ alert: created })
}

// DELETE ?id=xxx
export async function DELETE(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('sentiment_alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to delete alert.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH  { id, active }  — pause/resume
export async function PATCH(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id     = body?.id ? String(body.id) : null
  const active = typeof body?.active === 'boolean' ? body.active : null

  if (!id || active === null) {
    return NextResponse.json({ error: 'id and active (boolean) required' }, { status: 400 })
  }

  // When resuming, re-schedule next_run_at based on the alert's frequency
  let next_run_at: string | undefined
  if (active) {
    const { data: alert } = await supabase
      .from('sentiment_alerts')
      .select('frequency')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (alert?.frequency) {
      next_run_at = computeNextRun(alert.frequency as Frequency)
    }
  }

  const update: Record<string, unknown> = { active }
  if (next_run_at) update.next_run_at = next_run_at

  const { data, error } = await supabase
    .from('sentiment_alerts')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update alert.' }, { status: 500 })
  return NextResponse.json({ alert: data })
}
