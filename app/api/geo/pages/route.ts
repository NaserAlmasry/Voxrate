import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('public_geo_pages')
    .select('id, slug, product_title, health_score, published, published_at, last_snapshot_at, view_count, asin, report_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ pages: data || [] })
}
