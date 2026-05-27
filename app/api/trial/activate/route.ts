export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await admin.rpc('activate_free_trial', { p_user_id: user.id })
  if (error) {
    console.error('[Trial] activate_free_trial failed:', error.message)
    return NextResponse.json({ error: 'Could not activate trial' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
