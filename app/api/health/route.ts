import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}
  let ok = true

  // Supabase connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase.from('users').select('id').limit(1)
    checks.supabase = error ? 'error' : 'ok'
    if (error) ok = false
  } catch {
    checks.supabase = 'error'
    ok = false
  }

  // Resend API key present
  checks.resend = process.env.RESEND_API_KEY ? 'ok' : 'error'
  if (!process.env.RESEND_API_KEY) ok = false

  // Stripe key present
  checks.stripe = process.env.STRIPE_SECRET_KEY ? 'ok' : 'error'
  if (!process.env.STRIPE_SECRET_KEY) ok = false

  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  )
}
