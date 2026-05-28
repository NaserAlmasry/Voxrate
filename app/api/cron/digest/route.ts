// Vercel cron — runs every Monday at 9am UTC
// Sends each active monitoring user a weekly digest of their listings

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { sendWeeklyDigest } from '@/app/lib/email'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Get all active monitored listings, grouped by user
  const { data: listings } = await supabase
    .from('monitored_listings')
    .select('*, users(email, plan)')
    .eq('is_active', true)
    .order('user_id')
    .limit(2000)

  if (!listings || listings.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // Group by user
  const byUser = new Map<string, typeof listings>()
  for (const l of listings) {
    const arr = byUser.get(l.user_id) || []
    arr.push(l)
    byUser.set(l.user_id, arr)
  }

  let sent = 0

  for (const [, userListings] of byUser) {
    const user = (userListings[0] as any).users
    if (!user?.email) continue
    if (user.plan === 'free') continue

    // For each listing, grab its current report to get top complaint
    const digestItems = await Promise.all(
      userListings.map(async l => {
        let topComplaint: string | null = null
        let previousScore: number | null = null

        if (l.report_id) {
          const { data: report } = await supabase
            .from('reports')
            .select('full_report')
            .eq('id', l.report_id)
            .single()

          topComplaint = report?.full_report?.complaints?.[0]?.title || null

          // Find the previous report for this product to show trend
          const { data: prevReports } = await supabase
            .from('reports')
            .select('health_score, created_at')
            .eq('user_id', l.user_id)
            .eq('product_url', l.product_url)
            .order('created_at', { ascending: false })
            .limit(2)

          if (prevReports && prevReports.length === 2) {
            previousScore = prevReports[1].health_score
          }
        }

        return {
          productName:   l.product_name || 'Unnamed product',
          currentScore:  l.last_score   || 0,
          previousScore,
          topComplaint,
          reportId:      l.report_id as string | null,
        }
      })
    )

    // Skip listings with no report yet — their email link would be broken
    const validItems = digestItems.filter(item => typeof item.reportId === 'string')
    if (validItems.length === 0) continue

    try {
      await sendWeeklyDigest({ to: user.email, listings: validItems as any })
      sent++
    } catch (err: any) {
      console.error(`[Digest] Failed to send to ${user.email}:`, err.message)
    }
  }

  return NextResponse.json({ sent, users: byUser.size })
}
