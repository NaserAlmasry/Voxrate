import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const origin   = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_URL

  const code           = searchParams.get('code')
  const tokenHash      = searchParams.get('token_hash')
  const type           = searchParams.get('type')
  const pendingPlan    = searchParams.get('pendingPlan')
  const pendingBilling = searchParams.get('pendingBilling')
  const pendingPack    = searchParams.get('pendingPack')

  // Password reset flow — verify the token then send to reset page
  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    if (error) {
      console.error('[Auth Callback] Password reset token invalid:', error.message)
      return NextResponse.redirect(`${origin}/?error=reset_failed`)
    }
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  // Track whether this was an email verification (signup confirmation)
  let isEmailVerification = false

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth Callback] exchangeCodeForSession failed:', error.message)
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }
    // Supabase sets the AMR claim to 'otp' for email link sign-ins (signup confirmation)
    const amr = data?.session?.user?.amr ?? (data?.session as any)?.amr
    const verifiedViaLink = Array.isArray(amr)
      ? amr.some((a: any) => a.method === 'otp')
      : false
    if (verifiedViaLink) isEmailVerification = true
  }

  if (pendingPack && ['starter_pack', 'growth_pack', 'pro_pack'].includes(pendingPack)) {
    return NextResponse.redirect(`${origin}/dashboard?pack=${pendingPack}${isEmailVerification ? '&verified=true' : ''}`)
  }

  if (
    pendingPlan &&
    pendingBilling &&
    ['starter', 'growth', 'pro'].includes(pendingPlan) &&
    ['monthly', 'annual'].includes(pendingBilling)
  ) {
    return NextResponse.redirect(`${origin}/dashboard?checkout=${pendingPlan}&billing=${pendingBilling}${isEmailVerification ? '&verified=true' : ''}`)
  }

  if (isEmailVerification) {
    return NextResponse.redirect(`${origin}/dashboard?verified=true`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
