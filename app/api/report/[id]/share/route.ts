import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkCsrf } from '@/app/lib/csrf'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const { id: reportId } = await params

  if (!UUID_REGEX.test(reportId)) {
    return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const isPublic = body?.public === true

  // Ownership check — users can only share their own reports
  const { data: report } = await supabase
    .from('reports')
    .select('user_id')
    .eq('id', reportId)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  await supabase
    .from('reports')
    .update({ is_public: isPublic })
    .eq('id', reportId)

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  return NextResponse.json({
    success: true,
    isPublic,
    shareUrl: isPublic ? `${SITE_URL}/report/${reportId}` : null,
  })
}
