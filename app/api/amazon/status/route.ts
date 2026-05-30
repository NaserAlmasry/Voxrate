import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/amazon/status
// Returns whether the current user has connected their Amazon account via SP-API.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data } = await admin
    .from('users')
    .select('amazon_sp_selling_partner_id, amazon_sp_region, amazon_sp_connected_at, amazon_sp_last_sync')
    .eq('id', user.id)
    .single()

  const connected = !!data?.amazon_sp_selling_partner_id

  return NextResponse.json({
    connected,
    selling_partner_id: connected ? data.amazon_sp_selling_partner_id : null,
    region: connected ? data.amazon_sp_region : null,
    connected_at: connected ? data.amazon_sp_connected_at : null,
    last_sync: connected ? data.amazon_sp_last_sync : null,
  })
}
