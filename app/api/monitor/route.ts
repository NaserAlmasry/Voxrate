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

  // Fetch attack events per listing (last 90 days)
  const attackMap: Record<string, any[]> = {}
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
    const { data: attacks } = await supabase
      .from('attack_events')
      .select('listing_id, id, detected_at, new_negative_count, is_coordinated, shared_phrases, severity')
      .in('listing_id', items.map((i: any) => i.id))
      .gte('detected_at', ninetyDaysAgo)
      .order('detected_at', { ascending: false })
    if (attacks) {
      for (const a of attacks) {
        if (!attackMap[a.listing_id]) attackMap[a.listing_id] = []
        attackMap[a.listing_id].push(a)
      }
    }
  } catch {}

  const itemsWithHistory = items.map((item: any) => ({
    ...item,
    history:      historyMap[item.id] || [],
    attackEvents: attackMap[item.id]  || [],
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

  if (!isAdmin && plan !== 'pro') {
    return NextResponse.json(
      { error: 'Review monitoring is available on Pro plan only.', upgradeRequired: true, upgradePrompt: 'pro' },
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

  // 10 product limit
  const { count } = await supabase
    .from('monitored_listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Check existing monitor for this URL
  const { data: existing } = await supabase
    .from('monitored_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_url', report.product_url)
    .single()

  const asinMatch = report.product_url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || report.product_url.match(/^([A-Z0-9]{10})$/i)
  const asin = asinMatch ? asinMatch[1].toUpperCase() : null
  const marketplace = report.product_url.match(/amazon\.([a-z.]+)/)
    ? 'amazon.' + report.product_url.match(/amazon\.([a-z.]+)/)![1]
    : 'amazon.com'

  if (existing) {
    // Update frequency instead
    await supabase
      .from('monitored_listings')
      .update({
        check_frequency: checkFrequency,
        is_active: true,
        report_id: reportId,
        last_score: report.health_score,
        asin,
        marketplace,
        next_check_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      })
      .eq('id', existing.id)
    return NextResponse.json({ success: true, updated: true })
  }

  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'You can monitor up to 10 products on the Pro plan.' },
      { status: 403 },
    )
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
    asin,
    marketplace,
    next_check_at:   new Date(Date.now() + 7 * 86_400_000).toISOString(),
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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await supabase
    .from('monitored_listings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
