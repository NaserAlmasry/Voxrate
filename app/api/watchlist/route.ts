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

  return NextResponse.json({ items: data || [] })
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

  const body       = await request.json()
  const reportId   = typeof body?.reportId   === 'string' ? body.reportId   : null
  const note       = typeof body?.note       === 'string' ? body.note.trim().slice(0, 300) : ''

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
      .update({ report_id: reportId, last_score: report.health_score, note })
      .eq('id', existing.id)
    return NextResponse.json({ success: true, updated: true })
  }

  const topComplaint = report.full_report?.complaints?.[0]?.title || null

  const { error } = await supabase.from('watchlist').insert({
    user_id:        user.id,
    report_id:      reportId,
    product_url:    report.product_url,
    product_name:   report.product_name,
    last_score:     report.health_score,
    top_complaint:  topComplaint,
    note,
    last_checked_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('watchlist').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
