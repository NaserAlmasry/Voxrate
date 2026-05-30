// Runs daily — sends day-3 feature spotlight, 2-day warning, and 24h final warning emails

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { sendOnboardingEmail, trialExpiringTodayEmail } from '@/app/lib/emails/onboarding'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()

  // Day-3 spotlight
  const day3Start = new Date(now)
  day3Start.setDate(day3Start.getDate() - 3)
  day3Start.setHours(0, 0, 0, 0)
  const day3End = new Date(day3Start)
  day3End.setHours(23, 59, 59, 999)

  // 2-day warning: window is [now+24h, now+48h] — mutually exclusive with the 24h final warning
  const endingSoonStart = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const endingSoonEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // 24h final warning
  const expiringTodayStart = new Date(now)
  expiringTodayStart.setHours(0, 0, 0, 0)
  const expiringTodayEnd = new Date(now)
  expiringTodayEnd.setHours(23, 59, 59, 999)
  // "expires today" = trial_ends_at is within next 24 hours
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [{ data: day3Users }, { data: endingSoonUsers }, { data: expiringTodayUsers }] = await Promise.all([
    admin.from('users')
      .select('id, email, full_name, trial_activated_at')
      .eq('trial_activated', true)
      .eq('plan', 'free')
      .gte('trial_activated_at', day3Start.toISOString())
      .lte('trial_activated_at', day3End.toISOString()),

    admin.from('users')
      .select('id, email, full_name, trial_ends_at')
      .eq('trial_activated', true)
      .eq('plan', 'free')
      .gte('trial_ends_at', endingSoonStart.toISOString())
      .lte('trial_ends_at', endingSoonEnd.toISOString()),

    // Trial ends within next 24 hours — final urgent email
    admin.from('users')
      .select('id, email, full_name, trial_ends_at')
      .eq('trial_activated', true)
      .eq('plan', 'free')
      .not('trial_ends_at', 'is', null)
      .gt('trial_ends_at', now.toISOString())
      .lte('trial_ends_at', in24h.toISOString()),
  ])

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

  for (const u of expiringTodayUsers ?? []) {
    if (!u.email) continue
    const firstName = (u.full_name as string | undefined)?.split(' ')[0] ?? ''
    try {
      const { subject, html } = trialExpiringTodayEmail(firstName)
      await resend.emails.send({
        from: 'Voxrate <hello@voxrate.app>',
        to: u.email,
        subject,
        html,
      })
      sent++
    } catch (err: any) {
      console.error(`[OnboardingEmails] expiring_today failed for ${u.id}:`, err?.message)
    }
  }

  console.log(`[OnboardingEmails] Sent ${sent} email(s)`)
  return NextResponse.json({ sent })
}
