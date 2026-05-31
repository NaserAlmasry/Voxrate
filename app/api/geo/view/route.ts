import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST — called client-side on every public page visit
export async function POST(request: NextRequest) {
  try {
    const { pageId } = await request.json()
    if (!pageId) return NextResponse.json({ ok: false }, { status: 400 })

    const admin = adminClient()
    await admin.rpc('increment_geo_view', { p_page_id: pageId })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
