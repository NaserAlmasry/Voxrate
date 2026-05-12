import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items = data || []

  // Fetch score history (gracefully skip if table doesn't exist)
  let historyMap: Record<string, number[]> = {}
  try {
    const { data: history } = await supabase
      .from('watchlist_history')
      .select('watchlist_id, score, checked_at')
      .in('watchlist_id', items.map((i: any) => i.id))
      .order('checked_at', { ascending: true })
    if (history) {
      for (const h of history) {
        if (!historyMap[h.watchlist_id]) historyMap[h.watchlist_id] = []
        historyMap[h.watchlist_id].push(h.score)
      }
    }
  } catch {}

  const itemsWithHistory = items.map((item: any) => ({
    ...item,
    history: historyMap[item.id] || [],
  }))

  return NextResponse.json({ items: itemsWithHistory })
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const plan    = userData?.plan    || 'free'
  const isAdmin = userData?.is_admin === true

  if (!isAdmin && plan === 'free') {
    return NextResponse.json(
      { error: 'Competitor watchlist is available on Starter and Pro plans.', upgradeRequired: true },
      { status: 403 },
    )
  }

  const body     = await request.json()
  const reportId = typeof body?.reportId === 'string' ? body.reportId : null
  const note     = typeof body?.note     === 'string' ? body.note.trim().slice(0, 300) : ''

  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, product_url, product_name, health_score, full_report, report_type')
    .eq('id', reportId)
    .single()

  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_url', report.product_url)
    .single()

  if (existing) {
    await supabase
      .from('watchlist')
      .update({ report_id: reportId, last_score: report.health_score, note, last_checked_at: new Date().toISOString() })
      .eq('id', existing.id)
    // Append to history
    try {
      await supabase.from('watchlist_history').insert({ watchlist_id: existing.id, score: report.health_score })
    } catch {}
    return NextResponse.json({ success: true, updated: true })
  }

  const topComplaint = report.full_report?.complaints?.[0]?.title || null
  const now = new Date().toISOString()

  const { data: inserted, error } = await supabase.from('watchlist').insert({
    user_id:         user.id,
    report_id:       reportId,
    product_url:     report.product_url,
    product_name:    report.product_name,
    last_score:      report.health_score,
    initial_score:   report.health_score,
    top_complaint:   topComplaint,
    note,
    last_checked_at: now,
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })

  // Seed initial history point
  try {
    if (inserted?.id) {
      await supabase.from('watchlist_history').insert({ watchlist_id: inserted.id, score: report.health_score })
    }
  } catch {}

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id       = typeof body?.id       === 'string' ? body.id       : null
  const note     = typeof body?.note     === 'string' ? body.note.trim().slice(0, 300) : undefined
  const reportId = typeof body?.reportId === 'string' ? body.reportId : undefined
  const newScore = typeof body?.newScore === 'number' ? body.newScore : undefined

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (note     !== undefined) updates.note             = note
  if (reportId !== undefined) updates.report_id        = reportId
  if (newScore !== undefined) { updates.last_score = newScore; updates.last_checked_at = new Date().toISOString() }

  const { error } = await supabase
    .from('watchlist')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  if (newScore !== undefined) {
    try {
      await supabase.from('watchlist_history').insert({ watchlist_id: id, score: newScore })
    } catch {}
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  await supabase.from('watchlist').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
