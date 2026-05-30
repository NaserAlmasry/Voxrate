import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const asin = searchParams.get('asin')
  if (!asin) return NextResponse.json({ error: 'Missing asin' }, { status: 400 })

  const supabase = adminClient()
  const userId = session.user_id

  // Get latest snapshot for this ASIN
  const { data: snapshot } = await supabase
    .from('listing_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('asin', asin.toUpperCase())
    .order('captured_at', { ascending: false })
    .limit(1)
    .single()

  // Get recent velocity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: velocity } = await supabase
    .from('review_velocity')
    .select('date, one_star, total')
    .eq('user_id', userId)
    .eq('asin', asin.toUpperCase())
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: true })

  // Get unread alerts for this ASIN
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, type, severity, title, body, created_at')
    .eq('user_id', userId)
    .eq('asin', asin.toUpperCase())
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(5)

  // Detect if this is the user's own listing (has an 'own' type report for this ASIN)
  const { data: ownReport } = await supabase
    .from('reports')
    .select('id')
    .eq('user_id', userId)
    .eq('report_type', 'own')
    .eq('status', 'completed')
    .ilike('product_url', `%${asin.toUpperCase()}%`)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    asin: asin.toUpperCase(),
    is_own: !!ownReport,
    snapshot: snapshot || null,
    velocity: velocity || [],
    alerts: alerts || [],
  })
}
