import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'
import { checkRateLimit } from '@/app/lib/rate-limit'

// GET — list user's monitored listings
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('monitored_listings')
    .select('id, user_id, report_id, product_url, product_name, last_score, check_frequency, last_checked_at, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items = data || []

  // Fetch score history per listing
  const historyMap: Record<string, number[]> = {}
  try {
    const { data: history } = await supabase
      .from('monitor_history')
      .select('listing_id, score, checked_at')
      .in('listing_id', items.map((i: any) => i.id))
      .order('checked_at', { ascending: true })
    if (history) {
      for (const h of history) {
        if (!historyMap[h.listing_id]) historyMap[h.listing_id] = []
        historyMap[h.listing_id].push(h.score)
      }
    }
  } catch {}

  const itemsWithHistory = items.map((item: any) => ({
    ...item,
    history: historyMap[item.id] || [],
  }))

  return NextResponse.json({ listings: itemsWithHistory })
}

// POST — add a listing to monitor
export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(user.id, 'user')
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const plan    = userData?.plan || 'free'
  const isAdmin = userData?.is_admin === true

  if (!isAdmin && !['growth', 'pro'].includes(plan)) {
    return NextResponse.json(
      { error: 'Review monitoring is available on Growth and Pro plans.', upgradeRequired: true, upgradePrompt: 'growth' },
      { status: 403 },
    )
  }

  const body           = await request.json()
  const reportId       = body?.reportId
  const checkFrequency = body?.checkFrequency || 'weekly'

  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })
  if (!['daily', 'weekly'].includes(checkFrequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  }

  // Fetch report to get product info
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, product_url, product_name, health_score')
    .eq('id', reportId)
    .single()

  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Check existing monitor for this URL
  const { data: existing } = await supabase
    .from('monitored_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_url', report.product_url)
    .single()

  if (existing) {
    // Update frequency instead
    await supabase
      .from('monitored_listings')
      .update({ check_frequency: checkFrequency, is_active: true, report_id: reportId, last_score: report.health_score })
      .eq('id', existing.id)
    return NextResponse.json({ success: true, updated: true })
  }

  const { error } = await supabase.from('monitored_listings').insert({
    user_id:         user.id,
    report_id:       reportId,
    product_url:     report.product_url,
    product_name:    report.product_name,
    last_score:      report.health_score,
    check_frequency: checkFrequency,
    last_checked_at: new Date().toISOString(),
    is_active:       true,
  })

  if (error) return NextResponse.json({ error: 'Failed to add monitor' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove a monitored listing
export async function DELETE(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(user.id, 'user')
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase
    .from('monitored_listings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
