import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  const origin   = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_URL

  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type')

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    if (error) {
      console.error('[Auth Confirm] Password reset token invalid:', error.message)
      return NextResponse.redirect(`${origin}/?error=reset_failed`)
    }
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}/`)
}
