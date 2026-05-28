export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'
import { sendOnboardingEmail } from '@/app/lib/emails/onboarding'

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

  const { data: existing } = await admin
    .from('users')
    .select('trial_activated')
    .eq('id', user.id)
    .single()

  if (existing?.trial_activated) {
    return NextResponse.json({ error: 'Trial already activated' }, { status: 409 })
  }

  const { error } = await admin.rpc('activate_free_trial', { p_user_id: user.id })
  if (error) {
    console.error('[Trial] activate_free_trial failed:', error.message)
    return NextResponse.json({ error: 'Could not activate trial' }, { status: 500 })
  }

  // Send welcome email — fire and forget, never block the response
  if (process.env.RESEND_API_KEY && user.email) {
    const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? ''
    sendOnboardingEmail(process.env.RESEND_API_KEY, user.email, 'welcome', firstName).catch(
      (err) => console.error('[Trial] Welcome email failed:', err?.message),
    )
  }

  return NextResponse.json({ ok: true })
}
