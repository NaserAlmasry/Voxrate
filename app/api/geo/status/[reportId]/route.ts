import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reportId } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(reportId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const admin = adminClient()
  const { data: page } = await admin
    .from('public_geo_pages')
    .select('id, slug, published, published_at, view_count, last_snapshot_at')
    .eq('report_id', reportId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!page) return NextResponse.json({ published: false, slug: null, pageUrl: null })

  // Referrer breakdown (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: views } = await admin
    .from('geo_page_views')
    .select('source')
    .eq('page_id', page.id)
    .gte('viewed_at', thirtyDaysAgo)
    .limit(5000)

  const sourceCounts: Record<string, number> = {}
  for (const v of views || []) {
    const src = v.source || 'direct'
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
  }

  return NextResponse.json({
    published:       page.published,
    slug:            page.slug,
    pageUrl:         page.published ? `https://voxrate.app/product/${page.slug}` : null,
    publishedAt:     page.published_at,
    lastSnapshotAt:  page.last_snapshot_at,
    viewCount:       page.view_count,
    sourceCounts,
  })
}
