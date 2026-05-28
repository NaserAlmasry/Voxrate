// Runs daily — sends day-3 feature spotlight and trial-ending nudge emails

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { sendOnboardingEmail } from '@/app/lib/emails/onboarding'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()

  // Users whose trial started exactly 3 days ago → day-3 email
  const day3Start = new Date(now)
  day3Start.setDate(day3Start.getDate() - 3)
  day3Start.setHours(0, 0, 0, 0)
  const day3End = new Date(day3Start)
  day3End.setHours(23, 59, 59, 999)

  // Users whose trial ends in 2 days → trial-ending email
  const endingSoonStart = new Date(now)
  endingSoonStart.setDate(endingSoonStart.getDate() + 2)
  endingSoonStart.setHours(0, 0, 0, 0)
  const endingSoonEnd = new Date(endingSoonStart)
  endingSoonEnd.setHours(23, 59, 59, 999)

  const { data: day3Users } = await admin
    .from('users')
    .select('id, email, full_name, trial_activated_at')
    .eq('trial_activated', true)
    .eq('plan', 'trial')
    .gte('trial_activated_at', day3Start.toISOString())
    .lte('trial_activated_at', day3End.toISOString())

  const { data: endingSoonUsers } = await admin
    .from('users')
    .select('id, email, full_name, trial_ends_at')
    .eq('trial_activated', true)
    .eq('plan', 'trial')
    .gte('trial_ends_at', endingSoonStart.toISOString())
    .lte('trial_ends_at', endingSoonEnd.toISOString())

  let sent = 0

  for (const u of day3Users ?? []) {
    if (!u.email) continue
    const firstName = (u.full_name as string | undefined)?.split(' ')[0] ?? ''
    try {
      await sendOnboardingEmail(process.env.RESEND_API_KEY!, u.email, 'day3', firstName)
      sent++
    } catch (err: any) {
      console.error(`[OnboardingEmails] day3 failed for ${u.id}:`, err?.message)
    }
  }

  for (const u of endingSoonUsers ?? []) {
    if (!u.email) continue
    const firstName = (u.full_name as string | undefined)?.split(' ')[0] ?? ''
    const msLeft = new Date(u.trial_ends_at).getTime() - now.getTime()
    const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
    try {
      await sendOnboardingEmail(process.env.RESEND_API_KEY!, u.email, 'trial_ending', firstName, daysLeft)
      sent++
    } catch (err: any) {
      console.error(`[OnboardingEmails] trial_ending failed for ${u.id}:`, err?.message)
    }
  }

  console.log(`[OnboardingEmails] Sent ${sent} email(s)`)
  return NextResponse.json({ sent })
}
