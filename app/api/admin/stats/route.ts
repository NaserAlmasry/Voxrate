import { createClient } from '@/app/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin via user-scoped client (safe — can't be spoofed)
  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Use service role to bypass RLS for admin reads
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [
    { data: users },
    { data: ratings },
    { count: totalReports },
    { count: totalUsers },
    { count: paidUsers },
  ] = await Promise.all([
    service.from('users')
      .select('id, email, plan, credits, analyses_count, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(200),
    service.from('ratings')
      .select('id, rating, feedback, source, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(500),
    service.from('reports').select('id', { count: 'exact', head: true }),
    service.from('users').select('id', { count: 'exact', head: true }),
    service.from('users').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
  ])

  return NextResponse.json({
    users:        users        || [],
    ratings:      ratings      || [],
    totalReports: totalReports || 0,
    totalUsers:   totalUsers   || 0,
    paidUsers:    paidUsers    || 0,
  })
}
