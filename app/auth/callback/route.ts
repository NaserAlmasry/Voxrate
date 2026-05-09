// ============================================================
// app/auth/callback/route.ts
// Handles Google OAuth callback.
// If pendingPlan + pendingBilling are present in the URL,
// redirects straight to Stripe checkout after login.
// ============================================================

import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const origin   = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_URL
  const code           = searchParams.get('code')
  const pendingPlan    = searchParams.get('pendingPlan')
  const pendingBilling = searchParams.get('pendingBilling')
  const pendingPack    = searchParams.get('pendingPack')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (pendingPack && ['starter_pack', 'growth_pack', 'pro_pack'].includes(pendingPack)) {
    return NextResponse.redirect(`${origin}/dashboard?pack=${pendingPack}`)
  }

  if (
    pendingPlan &&
    pendingBilling &&
    ['starter', 'pro'].includes(pendingPlan) &&
    ['monthly'].includes(pendingBilling)
  ) {
    return NextResponse.redirect(
      `${origin}/dashboard?checkout=${pendingPlan}&billing=${pendingBilling}`
    )
  }

  // ── Check for pending URL analysis (existing flow) ────
  // This was previously handled via sessionStorage which
  // doesn't survive OAuth redirects — now handled via dashboard
  return NextResponse.redirect(`${origin}/dashboard`)
}
